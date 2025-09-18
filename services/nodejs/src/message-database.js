/**
 * 消息模块数据库架构
 * 支持多店铺客服系统的对话和消息管理
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 */

const SearchHistoryManager = require('./search-history-manager');

class MessageDatabase {
    constructor(db) {
        this.db = db;
        this.searchManager = new SearchHistoryManager(db);
        console.log('📊 消息数据库模块初始化');
    }

    /**
     * 初始化消息相关表结构
     */
    async initializeTables() {
        try {
            console.log('🚀 开始初始化消息数据库表...');

            // 创建对话表
            await this.createConversationsTable();
            
            // 创建消息表
            await this.createMessagesTable();
            
            // 创建未读计数表
            await this.createUnreadCountsTable();
            
            // 创建索引以提高查询性能
            await this.createIndexes();
            
            // 初始化搜索和历史管理表
            await this.searchManager.initializeTables();
            
            console.log('✅ 消息数据库表初始化完成');
            
        } catch (error) {
            console.error('❌ 消息数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建对话表
     */
    async createConversationsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                shop_id INTEGER NOT NULL,
                customer_id TEXT NOT NULL,
                customer_name TEXT,
                customer_email TEXT,
                customer_phone TEXT,
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'archived')),
                priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
                assigned_to INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_message_at DATETIME,
                last_message_content TEXT,
                unread_count INTEGER DEFAULT 0,
                metadata TEXT, -- JSON格式存储额外信息
                
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
            )
        `;

        await this.db.run(sql);
        console.log('📋 对话表创建完成');
    }

    /**
     * 创建消息表
     */
    async createMessagesTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_type TEXT NOT NULL CHECK(sender_type IN ('customer', 'staff', 'system')),
                sender_id TEXT,
                sender_name TEXT,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'file', 'audio', 'video', 'emoji', 'system')),
                file_url TEXT,
                file_name TEXT,
                file_size INTEGER,
                file_type TEXT,
                file_metadata TEXT, -- JSON格式存储文件相关信息(尺寸、时长等)
                thumbnail_url TEXT, -- 缩略图URL
                is_read BOOLEAN DEFAULT FALSE,
                read_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT, -- JSON格式存储额外信息
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('💬 消息表创建完成');
    }

    /**
     * 创建未读计数表
     */
    async createUnreadCountsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS unread_counts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                shop_id INTEGER NOT NULL,
                conversation_id TEXT NOT NULL,
                count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                
                UNIQUE(user_id, conversation_id)
            )
        `;

        await this.db.run(sql);
        console.log('🔢 未读计数表创建完成');
    }

    /**
     * 创建数据库索引
     */
    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_conversations_shop_id ON conversations(shop_id)',
            'CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations(customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)',
            'CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)',
            'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
            'CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type)',
            'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read)',
            'CREATE INDEX IF NOT EXISTS idx_unread_counts_user_shop ON unread_counts(user_id, shop_id)',
            'CREATE INDEX IF NOT EXISTS idx_unread_counts_conversation ON unread_counts(conversation_id)'
        ];

        for (const indexSql of indexes) {
            await this.db.run(indexSql);
        }
        
        console.log('📌 数据库索引创建完成');
    }

    /**
     * 获取用户的店铺未读消息统计
     */
    async getUnreadCounts(userId) {
        try {
            const sql = `
                SELECT 
                    s.id as shop_id,
                    s.name as shop_name,
                    COALESCE(SUM(uc.count), 0) as unread_count
                FROM shops s
                LEFT JOIN unread_counts uc ON s.id = uc.shop_id AND uc.user_id = ?
                WHERE s.owner_id = ?
                GROUP BY s.id, s.name
                ORDER BY unread_count DESC, s.name ASC
            `;

            const rows = await this.db.all(sql, [userId, userId]);
            
            // 转换为对象格式便于前端使用
            const counts = {};
            rows.forEach(row => {
                counts[row.shop_id] = row.unread_count;
            });

            return { counts, details: rows };
        } catch (error) {
            console.error('❌ 获取未读统计失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺的对话列表
     */
    async getShopConversations(shopId, options = {}) {
        try {
            const {
                status = 'active',
                limit = 50,
                offset = 0,
                orderBy = 'updated_at',
                orderDirection = 'DESC'
            } = options;

            const sql = `
                SELECT 
                    c.*,
                    uc.count as unread_count,
                    (
                        SELECT content 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        ORDER BY m.created_at DESC 
                        LIMIT 1
                    ) as last_message_content,
                    (
                        SELECT created_at 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        ORDER BY m.created_at DESC 
                        LIMIT 1
                    ) as last_message_time
                FROM conversations c
                LEFT JOIN unread_counts uc ON c.id = uc.conversation_id
                WHERE c.shop_id = ? AND c.status = ?
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT ? OFFSET ?
            `;

            const rows = await this.db.all(sql, [shopId, status, limit, offset]);
            
            return {
                conversations: rows,
                total: rows.length,
                hasMore: rows.length === limit
            };
        } catch (error) {
            console.error('❌ 获取对话列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话消息
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                orderBy = 'created_at',
                orderDirection = 'ASC'
            } = options;

            const sql = `
                SELECT 
                    id,
                    conversation_id,
                    sender_type,
                    sender_id,
                    sender_name,
                    content,
                    message_type,
                    file_url,
                    file_name,
                    is_read,
                    created_at
                FROM messages
                WHERE conversation_id = ?
                ORDER BY ${orderBy} ${orderDirection}
                LIMIT ? OFFSET ?
            `;

            const messages = await this.db.all(sql, [conversationId, limit, offset]);
            
            return {
                messages,
                total: messages.length,
                hasMore: messages.length === limit
            };
        } catch (error) {
            console.error('❌ 获取对话消息失败:', error);
            throw error;
        }
    }

    /**
     * 创建新对话
     */
    async createConversation(data) {
        try {
            const conversationId = this.generateId();
            const {
                shopId,
                customerId,
                customerName,
                customerEmail = null,
                customerPhone = null,
                priority = 'normal',
                assignedTo = null,
                metadata = null
            } = data;

            const sql = `
                INSERT INTO conversations (
                    id, shop_id, customer_id, customer_name, customer_email, 
                    customer_phone, priority, assigned_to, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(sql, [
                conversationId,
                shopId,
                customerId,
                customerName,
                customerEmail,
                customerPhone,
                priority,
                assignedTo,
                metadata ? JSON.stringify(metadata) : null
            ]);

            console.log(`✅ 创建对话成功: ${conversationId}`);
            return { id: conversationId, ...data };
        } catch (error) {
            console.error('❌ 创建对话失败:', error);
            throw error;
        }
    }

    /**
     * 添加消息
     */
    async addMessage(data) {
        try {
            const messageId = this.generateId();
            const {
                conversationId,
                senderType,
                senderId = null,
                senderName = null,
                content,
                messageType = 'text',
                fileUrl = null,
                fileName = null,
                fileSize = null,
                fileType = null,
                fileMetadata = null,
                thumbnailUrl = null,
                metadata = null
            } = data;

            // 插入消息
            const messageSql = `
                INSERT INTO messages (
                    id, conversation_id, sender_type, sender_id, sender_name,
                    content, message_type, file_url, file_name, file_size, 
                    file_type, file_metadata, thumbnail_url, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(messageSql, [
                messageId,
                conversationId,
                senderType,
                senderId,
                senderName,
                content,
                messageType,
                fileUrl,
                fileName,
                fileSize,
                fileType,
                fileMetadata ? JSON.stringify(fileMetadata) : null,
                thumbnailUrl,
                metadata ? JSON.stringify(metadata) : null
            ]);

            // 更新对话的最后消息信息
            const updateConversationSql = `
                UPDATE conversations 
                SET 
                    updated_at = CURRENT_TIMESTAMP,
                    last_message_at = CURRENT_TIMESTAMP,
                    last_message_content = ?
                WHERE id = ?
            `;

            // 根据消息类型生成合适的预览文本
            let previewContent = content;
            if (messageType === 'image') {
                previewContent = '[图片]';
            } else if (messageType === 'file') {
                previewContent = `[文件] ${fileName || '未知文件'}`;
            } else if (messageType === 'audio') {
                previewContent = '[语音消息]';
            } else if (messageType === 'video') {
                previewContent = '[视频]';
            } else if (messageType === 'emoji') {
                previewContent = '[表情]';
            }

            await this.db.run(updateConversationSql, [previewContent, conversationId]);

            // 如果是客户发送的消息，增加未读计数
            if (senderType === 'customer') {
                await this.incrementUnreadCount(conversationId);
            }

            console.log(`✅ 添加消息成功: ${messageId} (${messageType})`);
            return { id: messageId, ...data, created_at: new Date().toISOString() };
        } catch (error) {
            console.error('❌ 添加消息失败:', error);
            throw error;
        }
    }

    /**
     * 标记消息为已读
     */
    async markMessagesAsRead(conversationId, userId) {
        try {
            // 标记消息为已读
            const updateMessagesSql = `
                UPDATE messages 
                SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
                WHERE conversation_id = ? AND is_read = FALSE AND sender_type = 'customer'
            `;

            await this.db.run(updateMessagesSql, [conversationId]);

            // 重置未读计数
            const updateUnreadSql = `
                UPDATE unread_counts 
                SET count = 0, updated_at = CURRENT_TIMESTAMP
                WHERE conversation_id = ? AND user_id = ?
            `;

            await this.db.run(updateUnreadSql, [conversationId, userId]);

            console.log(`✅ 标记消息已读: ${conversationId}`);
        } catch (error) {
            console.error('❌ 标记消息已读失败:', error);
            throw error;
        }
    }

    /**
     * 增加未读计数
     */
    async incrementUnreadCount(conversationId) {
        try {
            // 获取对话信息
            const conversation = await this.db.get(
                'SELECT shop_id FROM conversations WHERE id = ?',
                [conversationId]
            );

            if (!conversation) {
                throw new Error('对话不存在');
            }

            // 获取店铺所有者
            const shop = await this.db.get(
                'SELECT owner_id FROM shops WHERE id = ?',
                [conversation.shop_id]
            );

            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 先尝试更新现有记录
            const updateSql = `
                UPDATE unread_counts 
                SET count = count + 1, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND conversation_id = ?
            `;

            const updateResult = await this.db.run(updateSql, [shop.owner_id, conversationId]);

            // 如果没有更新任何行，说明记录不存在，需要插入新记录
            if (updateResult.changes === 0) {
                const insertSql = `
                    INSERT INTO unread_counts (user_id, shop_id, conversation_id, count)
                    VALUES (?, ?, ?, 1)
                `;

                await this.db.run(insertSql, [shop.owner_id, conversation.shop_id, conversationId]);
            }

            console.log(`✅ 增加未读计数: ${conversationId}`);
        } catch (error) {
            console.error('❌ 增加未读计数失败:', error);
            throw error;
        }
    }

    /**
     * 查找或创建对话
     */
    async findOrCreateConversation(shopId, customerId, customerName) {
        try {
            // 查找现有对话
            let conversation = await this.db.get(`
                SELECT * FROM conversations 
                WHERE shop_id = ? AND customer_id = ? AND status = 'active'
                ORDER BY updated_at DESC 
                LIMIT 1
            `, [shopId, customerId]);

            // 如果不存在则创建新对话
            if (!conversation) {
                const newConversation = await this.createConversation({
                    shopId,
                    customerId,
                    customerName
                });
                
                conversation = await this.db.get(
                    'SELECT * FROM conversations WHERE id = ?',
                    [newConversation.id]
                );
            }

            return conversation;
        } catch (error) {
            console.error('❌ 查找或创建对话失败:', error);
            throw error;
        }
    }

    /**
     * 获取对话详情
     */
    async getConversation(conversationId) {
        try {
            const sql = `
                SELECT 
                    c.*,
                    s.name as shop_name,
                    s.domain as shop_domain
                FROM conversations c
                LEFT JOIN shops s ON c.shop_id = s.id
                WHERE c.id = ?
            `;

            const conversation = await this.db.get(sql, [conversationId]);
            
            if (!conversation) {
                throw new Error('对话不存在');
            }

            return conversation;
        } catch (error) {
            console.error('❌ 获取对话详情失败:', error);
            throw error;
        }
    }

    /**
     * 生成唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 清理过期数据
     */
    async cleanupOldData(daysToKeep = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            // 删除过期的已关闭对话
            const deleteConversationsSql = `
                DELETE FROM conversations 
                WHERE status = 'closed' AND updated_at < ?
            `;

            const result = await this.db.run(deleteConversationsSql, [cutoffDate.toISOString()]);
            
            console.log(`🧹 清理了 ${result.changes} 个过期对话`);
            
            return result.changes;
        } catch (error) {
            console.error('❌ 清理过期数据失败:', error);
            throw error;
        }
    }
}

module.exports = MessageDatabase;
