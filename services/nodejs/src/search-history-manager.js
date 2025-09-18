/**
 * 消息搜索和历史管理模块
 * 
 * 功能包括：
 * - 全文搜索
 * - 高级过滤
 * - 对话归档
 * - 数据导出
 * - 搜索历史
 * 
 * @author QuickTalk Team
 * @version 2.0.0
 */

class SearchHistoryManager {
    constructor(db) {
        this.db = db;
        console.log('🔍 搜索历史管理模块初始化');
    }

    /**
     * 初始化搜索相关表结构
     */
    async initializeTables() {
        try {
            console.log('🚀 开始初始化搜索相关数据表...');
            
            // 创建搜索历史表
            await this.createSearchHistoryTable();
            
            // 创建对话归档表
            await this.createConversationArchiveTable();
            
            // 创建全文搜索索引
            await this.createFullTextIndexes();
            
            // 创建搜索标签表
            await this.createSearchTagsTable();
            
            console.log('✅ 搜索历史管理表初始化完成');
            
        } catch (error) {
            console.error('❌ 搜索模块初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建搜索历史表
     */
    async createSearchHistoryTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS search_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                search_query TEXT NOT NULL,
                search_type TEXT NOT NULL CHECK(search_type IN ('text', 'user', 'date', 'file', 'advanced')),
                search_filters TEXT, -- JSON格式存储搜索过滤条件
                result_count INTEGER DEFAULT 0,
                search_time REAL, -- 搜索耗时(毫秒)
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
            )
        `;

        await this.db.run(sql);
        console.log('🔍 搜索历史表创建完成');
    }

    /**
     * 创建对话归档表
     */
    async createConversationArchiveTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS conversation_archives (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                archived_by TEXT NOT NULL,
                archive_reason TEXT,
                archive_data TEXT, -- JSON格式存储完整对话数据
                message_count INTEGER DEFAULT 0,
                file_count INTEGER DEFAULT 0,
                total_size INTEGER DEFAULT 0, -- 总文件大小(字节)
                start_time DATETIME,
                end_time DATETIME,
                archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL
            )
        `;

        await this.db.run(sql);
        console.log('📦 对话归档表创建完成');
    }

    /**
     * 创建搜索标签表
     */
    async createSearchTagsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS search_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag_name TEXT UNIQUE NOT NULL,
                tag_color TEXT DEFAULT '#007bff',
                usage_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await this.db.run(sql);
        console.log('🏷️ 搜索标签表创建完成');
    }

    /**
     * 创建全文搜索索引
     */
    async createFullTextIndexes() {
        const indexes = [
            // 消息内容全文搜索索引
            'CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages(content)',
            'CREATE INDEX IF NOT EXISTS idx_messages_sender_name ON messages(sender_name)',
            'CREATE INDEX IF NOT EXISTS idx_messages_file_name ON messages(file_name)',
            
            // 对话搜索索引
            'CREATE INDEX IF NOT EXISTS idx_conversations_customer_name ON conversations(customer_name)',
            'CREATE INDEX IF NOT EXISTS idx_conversations_customer_email ON conversations(customer_email)',
            
            // 搜索历史索引
            'CREATE INDEX IF NOT EXISTS idx_search_history_user_shop ON search_history(user_id, shop_id)',
            'CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(search_query)',
            'CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at)',
            
            // 归档索引
            'CREATE INDEX IF NOT EXISTS idx_archives_shop_time ON conversation_archives(shop_id, archived_at)',
            'CREATE INDEX IF NOT EXISTS idx_archives_conversation ON conversation_archives(conversation_id)'
        ];

        for (const indexSql of indexes) {
            await this.db.run(indexSql);
        }
        
        console.log('📇 全文搜索索引创建完成');
    }

    /**
     * 全文搜索消息
     * @param {Object} searchParams - 搜索参数
     * @returns {Object} 搜索结果
     */
    async searchMessages(searchParams) {
        const startTime = Date.now();
        const {
            query,
            shopId,
            userId,
            dateFrom,
            dateTo,
            senderType,
            messageType,
            conversationId,
            limit = 50,
            offset = 0
        } = searchParams;

        try {
            let sql = `
                SELECT 
                    m.id,
                    m.conversation_id,
                    m.sender_type,
                    m.sender_name,
                    m.content,
                    m.message_type,
                    m.file_name,
                    m.file_url,
                    m.created_at,
                    c.customer_name,
                    c.customer_email,
                    -- 高亮匹配的内容片段
                    CASE 
                        WHEN m.content LIKE '%' || ? || '%' THEN 
                            SUBSTR(m.content, 
                                MAX(1, INSTR(LOWER(m.content), LOWER(?)) - 30),
                                100
                            )
                        ELSE m.content
                    END as highlighted_content
                FROM messages m
                LEFT JOIN conversations c ON m.conversation_id = c.id
                WHERE 1=1
            `;

            const params = [query, query];

            // 构建搜索条件
            if (shopId) {
                sql += ` AND c.shop_id = ?`;
                params.push(shopId);
            }

            if (query && query.trim()) {
                sql += ` AND (
                    m.content LIKE '%' || ? || '%' 
                    OR m.sender_name LIKE '%' || ? || '%'
                    OR m.file_name LIKE '%' || ? || '%'
                    OR c.customer_name LIKE '%' || ? || '%'
                    OR c.customer_email LIKE '%' || ? || '%'
                )`;
                params.push(query, query, query, query, query);
            }

            if (dateFrom) {
                sql += ` AND m.created_at >= ?`;
                params.push(dateFrom);
            }

            if (dateTo) {
                sql += ` AND m.created_at <= ?`;
                params.push(dateTo);
            }

            if (senderType) {
                sql += ` AND m.sender_type = ?`;
                params.push(senderType);
            }

            if (messageType) {
                sql += ` AND m.message_type = ?`;
                params.push(messageType);
            }

            if (conversationId) {
                sql += ` AND m.conversation_id = ?`;
                params.push(conversationId);
            }

            // 排序和分页
            sql += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const messages = await this.db.all(sql, params);
            
            // 获取总数
            const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
            const countParams = params.slice(0, -2); // 移除 limit 和 offset
            const countResult = await this.db.get(countSql, countParams);
            const total = countResult.total;

            const searchTime = Date.now() - startTime;

            // 记录搜索历史
            await this.saveSearchHistory({
                userId,
                shopId,
                query,
                searchType: 'text',
                filters: JSON.stringify(searchParams),
                resultCount: total,
                searchTime
            });

            return {
                messages,
                total,
                searchTime,
                hasMore: offset + messages.length < total,
                currentPage: Math.floor(offset / limit) + 1,
                totalPages: Math.ceil(total / limit)
            };

        } catch (error) {
            console.error('❌ 搜索消息失败:', error);
            throw error;
        }
    }

    /**
     * 高级搜索对话
     * @param {Object} searchParams - 高级搜索参数
     * @returns {Object} 搜索结果
     */
    async advancedSearchConversations(searchParams) {
        const startTime = Date.now();
        const {
            query,
            shopId,
            userId,
            status,
            priority,
            assignedTo,
            dateFrom,
            dateTo,
            hasUnread,
            messageCountMin,
            messageCountMax,
            tags,
            limit = 20,
            offset = 0
        } = searchParams;

        try {
            let sql = `
                SELECT 
                    c.*,
                    COUNT(m.id) as message_count,
                    MAX(m.created_at) as last_message_time,
                    SUM(CASE WHEN m.is_read = 0 THEN 1 ELSE 0 END) as unread_count,
                    GROUP_CONCAT(DISTINCT m.message_type) as message_types
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE 1=1
            `;

            const params = [];

            // 构建搜索条件
            if (shopId) {
                sql += ` AND c.shop_id = ?`;
                params.push(shopId);
            }

            if (query && query.trim()) {
                sql += ` AND (
                    c.customer_name LIKE '%' || ? || '%' 
                    OR c.customer_email LIKE '%' || ? || '%'
                    OR EXISTS (
                        SELECT 1 FROM messages m2 
                        WHERE m2.conversation_id = c.id 
                        AND m2.content LIKE '%' || ? || '%'
                    )
                )`;
                params.push(query, query, query);
            }

            if (status) {
                sql += ` AND c.status = ?`;
                params.push(status);
            }

            if (priority) {
                sql += ` AND c.priority = ?`;
                params.push(priority);
            }

            if (assignedTo) {
                sql += ` AND c.assigned_to = ?`;
                params.push(assignedTo);
            }

            if (dateFrom) {
                sql += ` AND c.created_at >= ?`;
                params.push(dateFrom);
            }

            if (dateTo) {
                sql += ` AND c.created_at <= ?`;
                params.push(dateTo);
            }

            sql += ` GROUP BY c.id`;

            // HAVING 条件
            const havingConditions = [];
            
            if (hasUnread) {
                havingConditions.push('unread_count > 0');
            }

            if (messageCountMin) {
                havingConditions.push(`message_count >= ${messageCountMin}`);
            }

            if (messageCountMax) {
                havingConditions.push(`message_count <= ${messageCountMax}`);
            }

            if (havingConditions.length > 0) {
                sql += ` HAVING ${havingConditions.join(' AND ')}`;
            }

            // 排序和分页
            sql += ` ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const conversations = await this.db.all(sql, params);
            
            // 获取总数
            const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]*$/, '');
            const countParams = params.slice(0, -2);
            const countResult = await this.db.get(countSql, countParams);
            const total = countResult.total;

            const searchTime = Date.now() - startTime;

            // 记录搜索历史
            await this.saveSearchHistory({
                userId,
                shopId,
                query,
                searchType: 'advanced',
                filters: JSON.stringify(searchParams),
                resultCount: total,
                searchTime
            });

            return {
                conversations,
                total,
                searchTime,
                hasMore: offset + conversations.length < total,
                currentPage: Math.floor(offset / limit) + 1,
                totalPages: Math.ceil(total / limit)
            };

        } catch (error) {
            console.error('❌ 高级搜索对话失败:', error);
            throw error;
        }
    }

    /**
     * 保存搜索历史
     * @param {Object} searchData - 搜索数据
     */
    async saveSearchHistory(searchData) {
        try {
            // 检查表是否存在
            const tableExists = await this.db.get(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='search_history'
            `);
            
            if (!tableExists) {
                console.log('搜索历史表不存在，跳过保存');
                return;
            }

            const id = 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            await this.db.run(`
                INSERT INTO search_history (
                    id, user_id, shop_id, search_query, search_type,
                    search_filters, result_count, search_time, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                id,
                searchData.userId,
                searchData.shopId,
                searchData.query,
                searchData.searchType,
                searchData.filters,
                searchData.resultCount,
                searchData.searchTime
            ]);

        } catch (error) {
            console.error('❌ 保存搜索历史失败:', error);
        }
    }

    /**
     * 获取搜索历史
     * @param {string} userId - 用户ID
     * @param {string} shopId - 店铺ID
     * @param {number} limit - 限制数量
     * @returns {Array} 搜索历史列表
     */
    async getSearchHistory(userId, shopId, limit = 20) {
        try {
            // 检查表是否存在
            const tableExists = await this.db.get(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='search_history'
            `);
            
            if (!tableExists) {
                console.log('搜索历史表不存在，返回空数组');
                return [];
            }

            const sql = `
                SELECT 
                    search_query,
                    search_type,
                    result_count,
                    search_time,
                    created_at,
                    COUNT(*) as search_count
                FROM search_history 
                WHERE user_id = ? AND shop_id = ?
                GROUP BY search_query, search_type
                ORDER BY MAX(created_at) DESC
                LIMIT ?
            `;

            return await this.db.all(sql, [userId, shopId, limit]);

        } catch (error) {
            console.error('❌ 获取搜索历史失败:', error);
            return [];
        }
    }

    /**
     * 清除搜索历史
     * @param {string} userId - 用户ID
     * @param {string} shopId - 店铺ID
     * @param {number} daysToKeep - 保留天数
     */
    async clearSearchHistory(userId, shopId, daysToKeep = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            await this.db.run(`
                DELETE FROM search_history 
                WHERE user_id = ? AND shop_id = ? AND created_at < ?
            `, [userId, shopId, cutoffDate.toISOString()]);

            return { success: true, message: `已清除 ${daysToKeep} 天前的搜索历史` };

        } catch (error) {
            console.error('❌ 清除搜索历史失败:', error);
            throw error;
        }
    }

    /**
     * 归档对话
     * @param {string} conversationId - 对话ID
     * @param {string} userId - 操作用户ID
     * @param {string} reason - 归档原因
     * @returns {Object} 归档结果
     */
    async archiveConversation(conversationId, userId, reason = '') {
        try {
            // 获取对话数据
            const conversation = await this.db.get(`
                SELECT c.*, COUNT(m.id) as message_count,
                       MIN(m.created_at) as start_time,
                       MAX(m.created_at) as end_time,
                       SUM(CASE WHEN m.file_url IS NOT NULL THEN 1 ELSE 0 END) as file_count,
                       SUM(COALESCE(m.file_size, 0)) as total_size
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.id = ?
                GROUP BY c.id
            `, [conversationId]);

            if (!conversation) {
                throw new Error('对话不存在');
            }

            // 获取所有消息
            const messages = await this.db.all(`
                SELECT * FROM messages 
                WHERE conversation_id = ? 
                ORDER BY created_at ASC
            `, [conversationId]);

            // 创建归档记录
            const archiveId = 'archive_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const archiveData = {
                conversation,
                messages,
                archivedAt: new Date().toISOString()
            };

            await this.db.run(`
                INSERT INTO conversation_archives (
                    id, conversation_id, shop_id, archived_by, archive_reason,
                    archive_data, message_count, file_count, total_size,
                    start_time, end_time, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                archiveId,
                conversationId,
                conversation.shop_id,
                userId,
                reason,
                JSON.stringify(archiveData),
                conversation.message_count,
                conversation.file_count,
                conversation.total_size,
                conversation.start_time,
                conversation.end_time
            ]);

            // 更新对话状态为已归档
            await this.db.run(`
                UPDATE conversations 
                SET status = 'archived', updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [conversationId]);

            return {
                success: true,
                archiveId,
                message: '对话归档成功',
                archiveData: {
                    messageCount: conversation.message_count,
                    fileCount: conversation.file_count,
                    totalSize: conversation.total_size
                }
            };

        } catch (error) {
            console.error('❌ 归档对话失败:', error);
            throw error;
        }
    }

    /**
     * 导出对话数据
     * @param {string} conversationId - 对话ID
     * @param {string} format - 导出格式 (json, csv, txt)
     * @returns {Object} 导出结果
     */
    async exportConversation(conversationId, format = 'json') {
        try {
            // 获取对话和消息数据
            const conversation = await this.db.get(`
                SELECT * FROM conversations WHERE id = ?
            `, [conversationId]);

            if (!conversation) {
                throw new Error('对话不存在');
            }

            const messages = await this.db.all(`
                SELECT * FROM messages 
                WHERE conversation_id = ? 
                ORDER BY created_at ASC
            `, [conversationId]);

            const exportData = {
                conversation,
                messages,
                exportedAt: new Date().toISOString(),
                totalMessages: messages.length
            };

            switch (format) {
                case 'json':
                    return {
                        data: JSON.stringify(exportData, null, 2),
                        filename: `conversation_${conversationId}_${Date.now()}.json`,
                        contentType: 'application/json'
                    };

                case 'csv':
                    const csvData = this.convertToCSV(messages);
                    return {
                        data: csvData,
                        filename: `conversation_${conversationId}_${Date.now()}.csv`,
                        contentType: 'text/csv'
                    };

                case 'txt':
                    const txtData = this.convertToText(conversation, messages);
                    return {
                        data: txtData,
                        filename: `conversation_${conversationId}_${Date.now()}.txt`,
                        contentType: 'text/plain'
                    };

                default:
                    throw new Error('不支持的导出格式');
            }

        } catch (error) {
            console.error('❌ 导出对话失败:', error);
            throw error;
        }
    }

    /**
     * 转换为CSV格式
     * @param {Array} messages - 消息列表
     * @returns {string} CSV数据
     */
    convertToCSV(messages) {
        const headers = ['时间', '发送者类型', '发送者姓名', '消息类型', '内容', '文件名'];
        const rows = messages.map(msg => [
            msg.created_at,
            msg.sender_type,
            msg.sender_name || '',
            msg.message_type,
            msg.content.replace(/"/g, '""'), // 转义双引号
            msg.file_name || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return csvContent;
    }

    /**
     * 转换为文本格式
     * @param {Object} conversation - 对话信息
     * @param {Array} messages - 消息列表
     * @returns {string} 文本数据
     */
    convertToText(conversation, messages) {
        let txtContent = `对话导出报告\n`;
        txtContent += `==========================================\n`;
        txtContent += `客户姓名: ${conversation.customer_name || '未知'}\n`;
        txtContent += `客户邮箱: ${conversation.customer_email || '未知'}\n`;
        txtContent += `对话状态: ${conversation.status}\n`;
        txtContent += `优先级: ${conversation.priority}\n`;
        txtContent += `创建时间: ${conversation.created_at}\n`;
        txtContent += `更新时间: ${conversation.updated_at}\n`;
        txtContent += `==========================================\n\n`;

        messages.forEach(msg => {
            txtContent += `[${msg.created_at}] ${msg.sender_name || msg.sender_type}:\n`;
            txtContent += `${msg.content}\n`;
            if (msg.file_name) {
                txtContent += `📎 附件: ${msg.file_name}\n`;
            }
            txtContent += `\n`;
        });

        return txtContent;
    }

    /**
     * 获取搜索统计信息
     * @param {string} shopId - 店铺ID
     * @param {number} days - 统计天数
     * @returns {Object} 统计数据
     */
    async getSearchStatistics(shopId, days = 30) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) as total_searches,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(search_time) as avg_search_time,
                    AVG(result_count) as avg_result_count,
                    MAX(search_time) as max_search_time,
                    MIN(search_time) as min_search_time
                FROM search_history 
                WHERE shop_id = ? AND created_at >= ?
            `, [shopId, startDate.toISOString()]);

            const topQueries = await this.db.all(`
                SELECT 
                    search_query,
                    COUNT(*) as search_count,
                    AVG(result_count) as avg_results
                FROM search_history 
                WHERE shop_id = ? AND created_at >= ? AND search_query != ''
                GROUP BY search_query
                ORDER BY search_count DESC
                LIMIT 10
            `, [shopId, startDate.toISOString()]);

            return {
                period: `${days} 天`,
                totalSearches: stats.total_searches || 0,
                uniqueUsers: stats.unique_users || 0,
                avgSearchTime: Math.round(stats.avg_search_time || 0),
                avgResultCount: Math.round(stats.avg_result_count || 0),
                maxSearchTime: stats.max_search_time || 0,
                minSearchTime: stats.min_search_time || 0,
                topQueries
            };

        } catch (error) {
            console.error('❌ 获取搜索统计失败:', error);
            return null;
        }
    }
}

module.exports = SearchHistoryManager;
