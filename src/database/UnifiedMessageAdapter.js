/**
 * 统一消息适配器
 * 这是一个过渡期的适配器，内部使用 MessageRepository 但保持与原 MessageAdapter 相同的接口
 * 目的：确保平滑迁移，零风险升级到 MessageRepository
 * 
 * @author QuickTalk Team
 * @version 1.0.0 - 迁移过渡版本
 */

const MessageRepository = require('./message-repository');

class UnifiedMessageAdapter {
    constructor(database) {
        console.log('🔄 初始化统一消息适配器 (使用 MessageRepository)');
        
        // 使用 MessageRepository 作为底层实现
        this.messageRepo = new MessageRepository(database);
        this.db = database;
        
        // 标记这是过渡版本
        this.isTransitionVersion = true;
    }

    /**
     * 添加消息 - 兼容 MessageAdapter 接口
     * 直接使用旧表结构，避免 conversation_id 字段问题
     */
    async addMessage(data) {
        try {
            console.log('🔄 [统一适配器] addMessage - 使用旧表结构直接插入');
            
            const {
                conversationId,
                senderType,
                senderId,
                content,
                messageType = 'text',
                fileId = null
            } = data;

            // 从 conversationId 中解析 shop_id 和 user_id (兼容旧格式)
            const userIndex = conversationId.lastIndexOf('_user_');
            if (userIndex === -1) {
                console.error('❌ 无效的conversationId格式:', conversationId);
                throw new Error('无效的conversationId格式');
            }
            
            const shopId = conversationId.substring(0, userIndex);
            const userId = conversationId.substring(userIndex + '_user_'.length); // 正确跳过 '_user_'

            console.log(`🔍 解析conversationId: "${conversationId}" -> shopId: "${shopId}", userId: "${userId}"`);

            // 映射 senderType 到数据库的 sender 字段
            let sender;
            if (senderType === 'customer') {
                sender = 'user';
            } else if (senderType === 'admin' || senderType === 'staff') {
                sender = 'admin';
            } else if (senderType === 'system') {
                sender = 'system';
            } else {
                sender = 'user'; // 默认值
            }

            console.log(`🔍 解析结果: shopId=${shopId}, userId=${userId}, sender=${sender}`);

            // 使用旧表结构直接插入 (兼容现有数据库)
            const messageId = this.generateId();
            const sql = `
                INSERT INTO messages (
                    id, shop_id, user_id, message, message_type, file_id, sender, is_read
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.runAsync(sql, [
                messageId,
                shopId,
                userId,
                content,
                messageType,
                fileId,
                sender,
                false // is_read
            ]);

            console.log(`✅ [统一适配器] 消息已保存到旧表结构: ${messageId}`);

            // 确保对话记录存在 (使用原有的 ensureConversationExists 逻辑)
            await this.ensureConversationExists(shopId, userId, content);

            return messageId;

        } catch (error) {
            console.error('❌ [统一适配器] addMessage 失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息 - 兼容 MessageAdapter 接口
     * 直接使用旧表结构查询
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            console.log('🔄 [统一适配器] getConversationMessages - 使用旧表结构查询');
            
            const {
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'ASC'
            } = options;

            // 从 conversationId 中解析 shop_id 和 user_id
            const userIndex = conversationId.lastIndexOf('_user_');
            if (userIndex === -1) {
                console.error('❌ 无效的conversationId格式:', conversationId);
                throw new Error('无效的conversationId格式');
            }
            
            const shopId = conversationId.substring(0, userIndex);
            const userId = conversationId.substring(userIndex + '_user_'.length); // 正确跳过 '_user_'

            console.log(`🔍 查询消息: conversationId="${conversationId}" -> shopId="${shopId}", userId="${userId}"`);

            // 使用旧表结构查询
            const sql = `
                SELECT 
                    id,
                    shop_id,
                    user_id,
                    admin_id,
                    message as content,
                    message_type,
                    file_id,
                    sender,
                    is_read,
                    created_at,
                    read_at
                FROM messages
                WHERE shop_id = ? AND user_id = ?
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT ? OFFSET ?
            `;

            const messages = await this.db.getAllAsync(sql, [shopId, userId, limit, offset]);
            
            console.log(`✅ [统一适配器] 查询到 ${messages.length} 条消息`);

            // 确保返回格式与 MessageAdapter 兼容
            return {
                messages: messages || [],
                total: messages ? messages.length : 0,
                hasMore: messages ? messages.length === limit : false
            };

        } catch (error) {
            console.error('❌ [统一适配器] getConversationMessages 失败:', error);
            throw error;
        }
    }

    /**
     * 确保对话存在 - 兼容 MessageAdapter 接口
     * 使用旧表结构的 conversations 表
     */
    async ensureConversationExists(shopId, userId, lastMessage) {
        try {
            console.log('🔄 [统一适配器] ensureConversationExists - 检查/创建对话记录');
            
            const conversationId = `${shopId}_${userId}`;
            const userName = `用户_${userId}`;
            const now = new Date().toISOString();
            
            // 检查对话是否已存在
            const existing = await this.db.getAsync(
                'SELECT * FROM conversations WHERE shop_id = ? AND user_id = ?',
                [shopId, userId]
            );

            if (existing) {
                // 更新现有对话
                await this.db.runAsync(`
                    UPDATE conversations 
                    SET 
                        updated_at = ?,
                        last_message_at = ?,
                        last_message = ?
                    WHERE shop_id = ? AND user_id = ?
                `, [now, now, lastMessage, shopId, userId]);
                
                console.log(`🔄 [统一适配器] 更新对话: ${conversationId}`);
            } else {
                // 创建新对话 (使用正确的字段名)
                await this.db.runAsync(`
                    INSERT INTO conversations (
                        id, shop_id, user_id, user_name, 
                        last_message, created_at, updated_at, 
                        unread_count, status, last_message_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    conversationId,
                    shopId,
                    userId,
                    userName,
                    lastMessage,
                    now,
                    now,
                    1, // 新对话有1条未读消息
                    'active',
                    now
                ]);
                
                console.log(`🆕 [统一适配器] 创建新对话: ${conversationId} (用户: ${userName})`);
            }
        } catch (error) {
            console.error('❌ [统一适配器] ensureConversationExists 失败:', error);
            // 不抛出错误，避免影响消息保存
        }
    }

    /**
     * 生成ID - 兼容 MessageAdapter 接口
     */
    generateId() {
        return this.messageRepo.generateId();
    }

    /**
     * 获取底层 MessageRepository 实例（用于高级功能）
     */
    getRepository() {
        return this.messageRepo;
    }

    /**
     * 检查是否为过渡版本
     */
    isTransition() {
        return this.isTransitionVersion;
    }
}

module.exports = UnifiedMessageAdapter;