/**
 * 消息数据访问层
 * 负责消息和对话相关的所有数据库操作
 */
const DatabaseCore = require('./database-core');

class MessageRepository {
    constructor(databaseCore) {
        this.db = databaseCore;
        this.legacyMode = false; // 是否使用兼容模式
    }

    /**
     * 初始化消息相关表
     */
    async initializeTables() {
        // 检查现有表结构
        const existingTables = await this.checkExistingTables();
        
        if (existingTables.hasLegacyMessages) {
            console.log('🔄 检测到旧版消息表结构，使用兼容模式');
            this.legacyMode = true;
            await this.initializeLegacyCompatibleTables();
        } else {
            console.log('🆕 初始化新版消息表结构');
            this.legacyMode = false;
            await this.initializeNewTables();
        }
        
        console.log('✅ 消息相关表初始化完成');
    }

    /**
     * 检查现有表结构
     */
    async checkExistingTables() {
        try {
            // 检查是否存在旧版messages表
            const legacyMessages = await this.db.get(`
                SELECT sql FROM sqlite_master 
                WHERE type='table' AND name='messages'
            `);
            
            const hasLegacyMessages = legacyMessages && 
                legacyMessages.sql.includes('shop_id') && 
                legacyMessages.sql.includes('user_id') && 
                !legacyMessages.sql.includes('conversation_id');
            
            return { hasLegacyMessages };
        } catch (error) {
            console.log('检查表结构失败，将使用新表结构:', error.message);
            return { hasLegacyMessages: false };
        }
    }

    /**
     * 初始化兼容旧版的表结构
     */
    async initializeLegacyCompatibleTables() {
        // 使用现有的messages表，不创建conversations表
        // 创建一个虚拟的对话ID映射表
        await this.db.createTableIfNotExists('conversation_mapping', `
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shop_id, user_id)
        `);

        // 创建索引
        await this.db.createIndexIfNotExists('idx_conversation_mapping_shop_user', 'conversation_mapping', 'shop_id, user_id');
        
        console.log('✅ 兼容模式表初始化完成');
    }

    /**
     * 初始化新版表结构 - 重构后使用统一的数据库模式管理器
     */
    async initializeNewTables() {
        try {
            // 使用统一的数据库模式管理器
            const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');
            const MessageRepositorySchemaConfig = require('../schemas/MessageRepositorySchemaConfig');
            
            const schemaManager = new DatabaseSchemaManager(this.db);
            
            // 批量创建表
            const tableDefinitions = MessageRepositorySchemaConfig.getTableDefinitions();
            await schemaManager.createTables(tableDefinitions);
            
            // 批量创建索引
            const indexDefinitions = MessageRepositorySchemaConfig.getIndexDefinitions();
            await schemaManager.createIndexes(indexDefinitions);
            
            console.log('✅ 新版消息表结构初始化完成');
            
        } catch (error) {
            console.error('❌ 新版消息表初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建或获取对话
     */
    async createOrGetConversation(shopId, userId, userData = {}) {
        // 先尝试获取现有对话
        let conversation = await this.getConversationByUserId(shopId, userId);
        
        if (!conversation) {
            // 创建新对话
            const conversationId = `${shopId}_${userId}`;
            const sql = `
                INSERT INTO conversations (
                    id, shop_id, user_id, user_name, user_email, user_ip
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            await this.db.run(sql, [
                conversationId,
                shopId,
                userId,
                userData.name || null,
                userData.email || null,
                userData.ip || null
            ]);
            
            conversation = await this.getConversationById(conversationId);
            console.log(`💬 新对话创建: ${conversationId}`);
        }
        
        return conversation;
    }

    /**
     * 根据ID获取对话
     */
    async getConversationById(conversationId) {
        const sql = 'SELECT * FROM conversations WHERE id = ?';
        const conversation = await this.db.get(sql, [conversationId]);
        
        if (conversation) {
            conversation.tags = JSON.parse(conversation.tags || '[]');
        }
        
        return conversation;
    }

    /**
     * 根据用户ID获取对话
     */
    async getConversationByUserId(shopId, userId) {
        const sql = 'SELECT * FROM conversations WHERE shop_id = ? AND user_id = ?';
        const conversation = await this.db.get(sql, [shopId, userId]);
        
        if (conversation) {
            conversation.tags = JSON.parse(conversation.tags || '[]');
        }
        
        return conversation;
    }

    /**
     * 获取店铺的所有对话
     */
    async getConversationsByShop(shopId, options = {}) {
        const {
            status = null,
            limit = 50,
            offset = 0,
            orderBy = 'updated_at',
            orderDirection = 'DESC'
        } = options;

        let sql = `
            SELECT c.*, 
                   COUNT(m.id) as message_count,
                   MAX(m.created_at) as last_message_time
            FROM conversations c
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.shop_id = ?
        `;
        
        const params = [shopId];
        
        if (status) {
            sql += ' AND c.status = ?';
            params.push(status);
        }
        
        sql += ` 
            GROUP BY c.id
            ORDER BY c.${orderBy} ${orderDirection}
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const conversations = await this.db.query(sql, params);
        
        return conversations.map(conv => {
            conv.tags = JSON.parse(conv.tags || '[]');
            return conv;
        });
    }

    /**
     * 添加消息
     */
    async addMessage(messageData) {
        const {
            conversationId,
            senderType,
            senderId,
            senderName,
            message,
            messageType = 'text',
            attachments = [],
            metadata = {}
        } = messageData;

        const sql = `
            INSERT INTO messages (
                conversation_id, sender_type, sender_id, sender_name,
                message, message_type, attachments, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.db.run(sql, [
            conversationId,
            senderType,
            senderId,
            senderName,
            message,
            messageType,
            JSON.stringify(attachments),
            JSON.stringify(metadata)
        ]);

        // 更新对话的最后消息时间
        await this.updateConversationLastMessage(conversationId);

        // 更新未读计数
        if (senderType === 'user') {
            await this.incrementUnreadCount(conversationId, 'staff');
        } else if (senderType === 'staff') {
            await this.incrementUnreadCount(conversationId, 'user');
        }

        console.log(`📨 消息已添加: ${conversationId} (${senderType})`);
        return { ...result, id: result.lastID };
    }

    /**
     * 获取对话的消息
     */
    async getMessages(conversationId, options = {}) {
        const {
            limit = 50,
            offset = 0,
            afterId = null,
            beforeId = null,
            orderBy = 'created_at',
            orderDirection = 'ASC'
        } = options;

        let sql = `
            SELECT * FROM messages 
            WHERE conversation_id = ?
        `;
        const params = [conversationId];

        if (afterId) {
            sql += ' AND id > ?';
            params.push(afterId);
        }

        if (beforeId) {
            sql += ' AND id < ?';
            params.push(beforeId);
        }

        sql += ` ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const messages = await this.db.query(sql, params);
        
        return messages.map(msg => {
            msg.attachments = JSON.parse(msg.attachments || '[]');
            msg.metadata = JSON.parse(msg.metadata || '{}');
            return msg;
        });
    }

    /**
     * 获取新消息（在指定ID之后）
     */
    async getNewMessages(conversationId, lastMessageId = 0) {
        const sql = `
            SELECT * FROM messages 
            WHERE conversation_id = ? AND id > ?
            ORDER BY created_at ASC
        `;

        const messages = await this.db.query(sql, [conversationId, lastMessageId]);
        
        return messages.map(msg => {
            msg.attachments = JSON.parse(msg.attachments || '[]');
            msg.metadata = JSON.parse(msg.metadata || '{}');
            return msg;
        });
    }

    /**
     * 获取用户的新消息
     */
    async getUserNewMessages(shopId, userId, lastMessageId = 0) {
        const conversation = await this.getConversationByUserId(shopId, userId);
        if (!conversation) {
            return [];
        }

        return await this.getNewMessages(conversation.id, lastMessageId);
    }

    /**
     * 标记消息为已读
     */
    async markMessagesAsRead(conversationId, userType, messageIds = null) {
        let sql = `
            UPDATE messages 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
            WHERE conversation_id = ?
        `;
        const params = [conversationId];

        // 只标记对方发送的消息为已读
        if (userType === 'user') {
            sql += " AND sender_type = 'staff'";
        } else if (userType === 'staff') {
            sql += " AND sender_type = 'user'";
        }

        if (messageIds && messageIds.length > 0) {
            sql += ` AND id IN (${messageIds.map(() => '?').join(',')})`;
            params.push(...messageIds);
        }

        await this.db.run(sql, params);

        // 重置未读计数
        await this.resetUnreadCount(conversationId, userType);
    }

    /**
     * 更新对话最后消息时间
     */
    async updateConversationLastMessage(conversationId) {
        const sql = `
            UPDATE conversations 
            SET last_message_at = CURRENT_TIMESTAMP, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        await this.db.run(sql, [conversationId]);
    }

    /**
     * 增加未读计数
     */
    async incrementUnreadCount(conversationId, userType) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) return;

        const sql = `
            INSERT INTO unread_counts (shop_id, conversation_id, user_type, count)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(shop_id, conversation_id, user_type) 
            DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP
        `;

        await this.db.run(sql, [conversation.shop_id, conversationId, userType]);
    }

    /**
     * 重置未读计数
     */
    async resetUnreadCount(conversationId, userType) {
        const sql = `
            UPDATE unread_counts 
            SET count = 0, updated_at = CURRENT_TIMESTAMP
            WHERE conversation_id = ? AND user_type = ?
        `;

        await this.db.run(sql, [conversationId, userType]);
    }

    /**
     * 获取未读计数
     */
    async getUnreadCount(conversationId, userType) {
        const sql = `
            SELECT count FROM unread_counts 
            WHERE conversation_id = ? AND user_type = ?
        `;

        const result = await this.db.get(sql, [conversationId, userType]);
        return result ? result.count : 0;
    }

    /**
     * 获取店铺的总未读计数
     */
    async getShopUnreadCount(shopId, userType) {
        const sql = `
            SELECT SUM(count) as total_unread 
            FROM unread_counts 
            WHERE shop_id = ? AND user_type = ?
        `;

        const result = await this.db.get(sql, [shopId, userType]);
        return result ? (result.total_unread || 0) : 0;
    }

    /**
     * 更新对话状态
     */
    async updateConversationStatus(conversationId, status) {
        const sql = `
            UPDATE conversations 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;

        await this.db.run(sql, [status, conversationId]);
        console.log(`💬 对话状态更新: ${conversationId} -> ${status}`);
    }

    /**
     * 添加对话标签
     */
    async addConversationTag(conversationId, tag) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) return;

        const tags = conversation.tags || [];
        if (!tags.includes(tag)) {
            tags.push(tag);
            
            const sql = `
                UPDATE conversations 
                SET tags = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            
            await this.db.run(sql, [JSON.stringify(tags), conversationId]);
        }
    }

    /**
     * 删除对话标签
     */
    async removeConversationTag(conversationId, tag) {
        const conversation = await this.getConversationById(conversationId);
        if (!conversation) return;

        const tags = conversation.tags || [];
        const newTags = tags.filter(t => t !== tag);
        
        const sql = `
            UPDATE conversations 
            SET tags = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        await this.db.run(sql, [JSON.stringify(newTags), conversationId]);
    }

    /**
     * 创建或获取对话（兼容模式）
     */
    async createOrGetConversationLegacy(shopId, userId, userData = {}) {
        // 在兼容模式下，直接返回虚拟对话ID
        const conversationId = `${shopId}_${userId}`;
        
        // 确保映射记录存在
        try {
            await this.db.run(`
                INSERT OR IGNORE INTO conversation_mapping (id, shop_id, user_id)
                VALUES (?, ?, ?)
            `, [conversationId, shopId, userId]);
        } catch (error) {
            console.log('创建对话映射失败:', error.message);
        }
        
        return {
            id: conversationId,
            shop_id: shopId,
            user_id: userId,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * 添加消息（兼容模式）
     */
    async addMessageLegacy(messageData) {
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
        
        // 使用旧版消息表结构
        const sql = `
            INSERT INTO messages (
                id, shop_id, user_id, admin_id, message, sender, is_read
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const sender = senderType === 'user' ? 'user' : 'admin';
        const adminId = senderType === 'staff' ? senderId : null;

        const result = await this.db.run(sql, [
            messageId,
            shopId,
            userId,
            adminId,
            message.trim(),
            sender,
            false
        ]);

        console.log(`📨 消息已添加（兼容模式）: ${conversationId} (${senderType})`);
        return { id: messageId, lastID: messageId };
    }

    /**
     * 获取用户的新消息（兼容模式）
     */
    async getUserNewMessagesLegacy(shopId, userId, lastMessageId = 0) {
        // 在兼容模式下，从旧版messages表获取消息
        const sql = `
            SELECT 
                id,
                message,
                sender,
                admin_id,
                created_at,
                is_read
            FROM messages 
            WHERE shop_id = ? AND user_id = ? 
            AND rowid > (
                SELECT COALESCE(rowid, 0) FROM messages 
                WHERE id = ? AND shop_id = ? AND user_id = ?
            )
            ORDER BY created_at ASC
        `;

        const messages = await this.db.query(sql, [shopId, userId, lastMessageId, shopId, userId]);
        
        return messages.map(msg => ({
            id: msg.id,
            type: msg.sender === 'user' ? 'user_message' : 'staff_message',
            message: msg.message,
            sender_type: msg.sender === 'user' ? 'user' : 'staff',
            sender_id: msg.sender === 'user' ? userId : (msg.admin_id || 'admin'),
            sender_name: msg.sender === 'user' ? userId : 'Customer Service',
            created_at: msg.created_at,
            message_type: 'text',
            attachments: [],
            metadata: {}
        }));
    }

    /**
     * 标记消息为已读（兼容模式）
     */
    async markMessagesAsReadLegacy(conversationId, userType, messageIds = null) {
        const [shopId, userId] = conversationId.split('_');
        
        let sql = `
            UPDATE messages 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
            WHERE shop_id = ? AND user_id = ?
        `;
        const params = [shopId, userId];

        // 只标记对方发送的消息为已读
        if (userType === 'user') {
            sql += " AND sender = 'admin'";
        } else if (userType === 'staff') {
            sql += " AND sender = 'user'";
        }

        if (messageIds && messageIds.length > 0) {
            sql += ` AND id IN (${messageIds.map(() => '?').join(',')})`;
            params.push(...messageIds);
        }

        await this.db.run(sql, params);
    }

    /**
     * 根据用户ID获取对话（兼容模式）
     */
    async getConversationByUserIdLegacy(shopId, userId) {
        const conversationId = `${shopId}_${userId}`;
        
        // 检查是否有消息记录
        const hasMessages = await this.db.get(`
            SELECT 1 FROM messages 
            WHERE shop_id = ? AND user_id = ?
            LIMIT 1
        `, [shopId, userId]);

        if (!hasMessages) {
            return null;
        }

        return {
            id: conversationId,
            shop_id: shopId,
            user_id: userId,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            tags: []
        };
    }

    /**
     * 删除对话及其所有消息
     */
    async deleteConversation(conversationId) {
        if (this.legacyMode) {
            const [shopId, userId] = conversationId.split('_');
            
            await this.db.transaction(async () => {
                // 删除消息
                await this.db.run('DELETE FROM messages WHERE shop_id = ? AND user_id = ?', [shopId, userId]);
                
                // 删除对话映射
                await this.db.run('DELETE FROM conversation_mapping WHERE id = ?', [conversationId]);
            });
        } else {
            await this.db.transaction(async () => {
                // 删除消息
                await this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
                
                // 删除未读计数
                await this.db.run('DELETE FROM unread_counts WHERE conversation_id = ?', [conversationId]);
                
                // 删除对话
                await this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
            });
        }

        console.log(`🗑️ 对话已删除: ${conversationId}`);
    }

    // ===== MessageAdapter 兼容性方法 =====
    // 为了平滑迁移，提供与 MessageAdapter 相同的接口

    /**
     * 兼容方法：getConversationMessages (对应 MessageAdapter.getConversationMessages)
     * 此方法提供与 MessageAdapter 相同的接口，内部调用 getMessages
     */
    async getConversationMessages(conversationId, options = {}) {
        console.log(`🔄 兼容模式：getConversationMessages -> getMessages`);
        return await this.getMessages(conversationId, options);
    }

    /**
     * 兼容方法：ensureConversationExists (对应 MessageAdapter.ensureConversationExists)
     * 此方法提供与 MessageAdapter 相同的接口，内部调用 createOrGetConversation
     */
    async ensureConversationExists(shopId, userId, lastMessage) {
        console.log(`🔄 兼容模式：ensureConversationExists -> createOrGetConversation`);
        
        // 构造用户数据
        const userData = {
            name: `用户_${userId}`,
            lastMessage: lastMessage
        };
        
        return await this.createOrGetConversation(shopId, userId, userData);
    }

    /**
     * 兼容方法：generateId (对应 MessageAdapter.generateId)
     * 提供简单的ID生成功能
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

module.exports = MessageRepository;
