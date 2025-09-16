/**
 * MessageRepository 重构脚本
 * 目标：简化消息仓库，移除冗余的Legacy方法，但保持与现有数据库的兼容性
 */

const fs = require('fs');
const path = require('path');

class MessageRepositoryRefactor {
    constructor() {
        this.originalFile = 'src/database/message-repository.js';
        this.backupFile = 'src/database/message-repository.js.backup';
    }

    async refactor() {
        console.log('🔄 开始重构 MessageRepository...');
        
        try {
            // 1. 备份原文件
            await this.createBackup();
            
            // 2. 生成简化版本
            await this.generateSimplifiedVersion();
            
            console.log('✅ MessageRepository 重构完成');
            
        } catch (error) {
            console.error('❌ 重构失败:', error);
            await this.restoreBackup();
        }
    }

    async createBackup() {
        const content = fs.readFileSync(this.originalFile, 'utf8');
        fs.writeFileSync(this.backupFile, content);
        console.log('📁 原文件已备份');
    }

    async restoreBackup() {
        if (fs.existsSync(this.backupFile)) {
            const content = fs.readFileSync(this.backupFile, 'utf8');
            fs.writeFileSync(this.originalFile, content);
            console.log('🔄 已恢复备份文件');
        }
    }

    async generateSimplifiedVersion() {
        const simplifiedCode = `/**
 * 消息数据访问层 - 简化重构版本
 * 负责消息和对话相关的所有数据库操作
 * 直接使用现有数据库表结构，移除不必要的兼容性复杂度
 */
const DatabaseCore = require('./database-core');

class MessageRepository {
    constructor(databaseCore) {
        this.db = databaseCore;
        console.log('📨 MessageRepository 初始化 (简化版本)');
    }

    /**
     * 初始化消息相关表 - 使用现有表结构
     */
    async initializeTables() {
        // 现有数据库已有表结构，无需创建
        console.log('✅ 使用现有消息表结构');
    }

    /**
     * 添加消息 - 使用现有表结构
     */
    async addMessage(messageData) {
        try {
            const {
                conversationId,
                senderType,
                senderId,
                senderName,
                message,
                messageType = 'text',
                metadata = {}
            } = messageData;

            // 解析conversationId获取shopId和userId
            const [shopId, userId] = conversationId.split('_');
            
            // 使用现有消息表结构
            const sql = \`
                INSERT INTO messages (
                    id, shop_id, user_id, admin_id, message, sender, 
                    message_type, file_url, file_name, is_read, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            \`;

            const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const sender = senderType === 'user' ? 'user' : 'admin';
            const adminId = senderType === 'staff' ? senderId : null;
            const timestamp = new Date().toISOString();

            await this.db.run(sql, [
                messageId,
                shopId,
                userId,
                adminId,
                message,
                sender,
                messageType,
                metadata.fileUrl || null,
                metadata.fileName || null,
                false,
                timestamp
            ]);

            console.log(\`✅ 消息已保存: \${messageId}\`);
            return { id: messageId, success: true };

        } catch (error) {
            console.error('❌ 添加消息失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            const [shopId, userId] = conversationId.split('_');
            const { limit = 50, offset = 0 } = options;

            const sql = \`
                SELECT 
                    id,
                    shop_id,
                    user_id,
                    admin_id,
                    message,
                    sender,
                    message_type,
                    file_url,
                    file_name,
                    is_read,
                    timestamp
                FROM messages 
                WHERE shop_id = ? AND user_id = ?
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            \`;

            const messages = await this.db.allAsync(sql, [shopId, userId, limit, offset]);
            
            // 转换为标准格式
            return messages.map(msg => ({
                id: msg.id,
                conversationId: \`\${msg.shop_id}_\${msg.user_id}\`,
                senderType: msg.sender === 'user' ? 'user' : 'staff',
                senderId: msg.sender === 'user' ? msg.user_id : msg.admin_id,
                content: msg.message,
                messageType: msg.message_type,
                fileUrl: msg.file_url,
                fileName: msg.file_name,
                isRead: msg.is_read,
                timestamp: msg.timestamp
            }));

        } catch (error) {
            console.error('❌ 获取对话消息失败:', error);
            throw error;
        }
    }

    /**
     * 创建或获取对话
     */
    async createOrGetConversation(shopId, userId, userData = {}) {
        try {
            const conversationId = \`\${shopId}_\${userId}\`;
            
            // 检查是否存在对话记录
            const existing = await this.db.getAsync(
                'SELECT * FROM conversations WHERE shop_id = ? AND user_id = ?',
                [shopId, userId]
            );

            if (existing) {
                return {
                    id: conversationId,
                    shopId: existing.shop_id,
                    userId: existing.user_id,
                    lastMessageAt: existing.last_message_at,
                    unreadCount: existing.unread_count || 0
                };
            }

            // 创建新对话记录
            const now = new Date().toISOString();
            await this.db.runAsync(\`
                INSERT INTO conversations (
                    id, shop_id, user_id, user_name, last_message_at, unread_count
                ) VALUES (?, ?, ?, ?, ?, ?)
            \`, [conversationId, shopId, userId, userData.name || \`用户_\${userId}\`, now, 0]);

            return {
                id: conversationId,
                shopId,
                userId,
                lastMessageAt: now,
                unreadCount: 0
            };

        } catch (error) {
            console.error('❌ 创建/获取对话失败:', error);
            throw error;
        }
    }

    /**
     * 标记消息为已读
     */
    async markMessagesAsRead(conversationId, userType, messageIds = null) {
        try {
            const [shopId, userId] = conversationId.split('_');
            
            let sql = \`
                UPDATE messages 
                SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
                WHERE shop_id = ? AND user_id = ?
            \`;
            const params = [shopId, userId];

            // 只标记对方发送的消息为已读
            if (userType === 'user') {
                sql += " AND sender = 'admin'";
            } else if (userType === 'staff') {
                sql += " AND sender = 'user'";
            }

            if (messageIds && messageIds.length > 0) {
                sql += \` AND id IN (\${messageIds.map(() => '?').join(',')})\`;
                params.push(...messageIds);
            }

            await this.db.run(sql, params);
            console.log(\`✅ 消息已标记为已读: \${conversationId}\`);

        } catch (error) {
            console.error('❌ 标记消息已读失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺对话列表
     */
    async getShopConversations(shopId, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const sql = \`
                SELECT 
                    c.*,
                    COUNT(m.id) as message_count,
                    MAX(m.timestamp) as last_message_time
                FROM conversations c
                LEFT JOIN messages m ON c.shop_id = m.shop_id AND c.user_id = m.user_id
                WHERE c.shop_id = ?
                GROUP BY c.id
                ORDER BY last_message_time DESC
                LIMIT ? OFFSET ?
            \`;

            const conversations = await this.db.allAsync(sql, [shopId, limit, offset]);
            
            return conversations.map(conv => ({
                id: \`\${conv.shop_id}_\${conv.user_id}\`,
                shopId: conv.shop_id,
                userId: conv.user_id,
                userName: conv.user_name,
                lastMessageAt: conv.last_message_time || conv.last_message_at,
                unreadCount: conv.unread_count || 0,
                messageCount: conv.message_count || 0
            }));

        } catch (error) {
            console.error('❌ 获取店铺对话列表失败:', error);
            throw error;
        }
    }

    // ===== MessageAdapter 兼容性方法 =====
    // 为了保持与现有代码的兼容性

    /**
     * 兼容方法：ensureConversationExists
     */
    async ensureConversationExists(shopId, userId, lastMessage) {
        console.log(\`🔄 兼容模式：ensureConversationExists -> createOrGetConversation\`);
        return await this.createOrGetConversation(shopId, userId, { name: lastMessage });
    }

    /**
     * 兼容方法：generateId
     */
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

module.exports = MessageRepository;`;

        fs.writeFileSync(this.originalFile, simplifiedCode);
        console.log('📝 简化版本已生成');
    }
}

// 执行重构
if (require.main === module) {
    const refactor = new MessageRepositoryRefactor();
    refactor.refactor().catch(console.error);
}

module.exports = MessageRepositoryRefactor;