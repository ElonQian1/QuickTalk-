/**
 * 消息数据库适配器
 * 将新的MessageDatabase接口适配到现有的SQLite表结构
 */

class MessageAdapter {
    constructor(database) {
        this.db = database;
    }

    /**
     * 添加消息 - 适配现有messages表结构
     */
    async addMessage(data) {
        try {
            const messageId = this.generateId();
            const {
                conversationId,
                senderType,
                senderId,
                content
            } = data;

            // 从conversationId中提取shop_id (格式: shop_1757591780450_1_user_67bi6gybb_1757684317815)
            const userIndex = conversationId.lastIndexOf('_user_');
            if (userIndex === -1) {
                console.error('❌ 无效的conversationId格式:', conversationId);
                throw new Error('无效的conversationId格式');
            }
            
            const shopId = conversationId.substring(0, userIndex);
            const userId = senderId;
            const sender = senderType === 'customer' ? 'user' : senderType;

            console.log(`🔍 调试信息: conversationId=${conversationId}, shopId=${shopId}, userId=${userId}, content=${content}`);

            // 插入到现有messages表
            const sql = `
                INSERT INTO messages (
                    id, shop_id, user_id, message, sender, is_read
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            console.log(`🔍 执行SQL: ${sql}`);
            console.log(`🔍 参数: [${messageId}, ${shopId}, ${userId}, ${content}, ${sender}, false]`);

            await this.db.runAsync(sql, [
                messageId,
                shopId,
                userId,
                content,
                sender,
                false // is_read
            ]);

            console.log(`✅ 消息已保存: ${messageId}`);

            // 自动创建或更新对话记录
            await this.ensureConversationExists(shopId, userId, content);

            return messageId;

        } catch (error) {
            console.error('❌ 添加消息失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息 - 适配现有messages表结构
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'ASC'
            } = options;

            // 从conversationId中提取shop_id和user_id
            // conversationId 格式: shop_1757591780450_1_user_67bi6gybb_1757684317815
            const userIndex = conversationId.lastIndexOf('_user_');
            if (userIndex === -1) {
                console.error('❌ 无效的conversationId格式:', conversationId);
                return [];
            }
            
            const shopId = conversationId.substring(0, userIndex);
            const userId = conversationId.substring(userIndex + 1); // 去掉前面的下划线

            console.log(`🔍 解析conversationId: ${conversationId} -> shopId: ${shopId}, userId: ${userId}`);

            const sql = `
                SELECT 
                    id,
                    shop_id,
                    user_id,
                    message as content,
                    sender as sender_type,
                    is_read,
                    created_at
                FROM messages
                WHERE shop_id = ? AND user_id = ?
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT ? OFFSET ?
            `;

            const messages = await this.db.getAllAsync(sql, [shopId, userId, limit, offset]);
            
            console.log(`✅ 获取到 ${messages ? messages.length : 0} 条消息`);
            return messages || [];

        } catch (error) {
            console.error('❌ 获取对话消息失败:', error);
            return [];
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return Math.random().toString(36).substr(2, 15) + Date.now().toString(36);
    }

    /**
     * 确保对话记录存在 - 自动创建或更新对话
     */
    async ensureConversationExists(shopId, userId, lastMessage) {
        try {
            const conversationId = `${shopId}_${userId}`;
            
            // 检查对话是否已存在
            const existing = await this.db.getAsync(
                'SELECT id FROM conversations WHERE shop_id = ? AND user_id = ?',
                [shopId, userId]
            );

            const now = new Date().toISOString();
            const userName = userId.includes('test_') || userId.includes('customer_') || userId.includes('final_') || userId.includes('user_correct_') 
                ? `测试用户${userId}` 
                : `匿名客户${userId.split('_').pop()}`;

            if (existing) {
                // 更新现有对话
                await this.db.runAsync(`
                    UPDATE conversations 
                    SET last_message = ?, 
                        last_message_at = ?, 
                        unread_count = unread_count + 1,
                        updated_at = ?
                    WHERE shop_id = ? AND user_id = ?
                `, [lastMessage, now, now, shopId, userId]);
                
                console.log(`🔄 更新对话: ${conversationId}`);
            } else {
                // 创建新对话
                await this.db.runAsync(`
                    INSERT INTO conversations (
                        id, shop_id, user_id, user_name, 
                        last_message, last_message_at, 
                        unread_count, status, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    conversationId,
                    shopId,
                    userId,
                    userName,
                    lastMessage,
                    now,
                    1, // 新对话有1条未读消息
                    'active',
                    now,
                    now
                ]);
                
                console.log(`🆕 创建新对话: ${conversationId} (用户: ${userName})`);
            }
        } catch (error) {
            console.error('❌ 确保对话存在失败:', error);
            // 不抛出错误，避免影响消息保存
        }
    }
}

module.exports = MessageAdapter;
