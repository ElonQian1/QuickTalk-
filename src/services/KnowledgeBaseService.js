/**
 * 知识库服务 - 从AIAssistantManager拆分出来
 * Phase 7 架构重构：将1206行的超大类拆分为专门的服务类
 * 
 * 负责：
 * - 知识库管理
 * - FAQ问答
 * - 知识查询
 * - 知识学习
 */

class KnowledgeBaseService {
    constructor(database) {
        this.db = database;
        this.knowledgeCache = new Map();
        this.categoryCache = new Map();
        
        console.log('📚 [KnowledgeBaseService] 知识库服务已初始化');
    }

    /**
     * 初始化知识库表结构
     */
    async initializeTables() {
        try {
            const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');
            const schemaManager = new DatabaseSchemaManager(this.db);
            
            const tableDefinition = {
                name: 'knowledge_base',
                definition: `
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    category TEXT NOT NULL CHECK(category IN ('faq', 'product', 'service', 'policy', 'technical', 'other')),
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    keywords TEXT, -- JSON格式存储关键词
                    confidence_score REAL DEFAULT 0.8,
                    usage_count INTEGER DEFAULT 0,
                    effectiveness_score REAL DEFAULT 0.0,
                    source_type TEXT CHECK(source_type IN ('manual', 'auto_generated', 'learned', 'imported')),
                    tags TEXT, -- JSON格式存储标签
                    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending_review')),
                    is_active BOOLEAN DEFAULT 1,
                    created_by TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                `,
                description: '知识库表'
            };
            
            await schemaManager.createTables([tableDefinition]);
            
            // 创建索引
            const indexes = [
                {
                    name: 'idx_knowledge_shop_category',
                    table: 'knowledge_base',
                    columns: 'shop_id, category',
                    description: '知识库店铺分类索引'
                },
                {
                    name: 'idx_knowledge_status',
                    table: 'knowledge_base',
                    columns: 'status, is_active',
                    description: '知识库状态索引'
                },
                {
                    name: 'idx_knowledge_usage',
                    table: 'knowledge_base',
                    columns: 'usage_count, effectiveness_score',
                    description: '知识库使用效果索引'
                }
            ];
            
            await schemaManager.createIndexes(indexes);
            
            console.log('✅ [KnowledgeBaseService] 知识库表初始化完成');
            
        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 表初始化失败:', error);
            throw error;
        }
    }

    /**
     * 添加知识条目
     */
    async addKnowledge(shopId, knowledgeData) {
        try {
            const id = this.generateKnowledgeId();
            const {
                category,
                question,
                answer,
                keywords = [],
                confidence_score = 0.8,
                source_type = 'manual',
                tags = [],
                created_by
            } = knowledgeData;

            const sql = `
                INSERT INTO knowledge_base (
                    id, shop_id, category, question, answer, keywords,
                    confidence_score, source_type, tags, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(sql, [
                id, shopId, category, question, answer,
                JSON.stringify(keywords),
                confidence_score,
                source_type,
                JSON.stringify(tags),
                created_by
            ]);

            // 清除缓存
            this.clearCache(shopId);

            console.log(`✅ [KnowledgeBaseService] 知识条目已添加: ${id}`);
            return { success: true, id };

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 添加知识失败:', error);
            throw error;
        }
    }

    /**
     * 查询知识库
     */
    async searchKnowledge(shopId, query, options = {}) {
        try {
            const {
                category = null,
                limit = 10,
                minConfidence = 0.5,
                includeInactive = false
            } = options;

            // 检查缓存
            const cacheKey = `${shopId}_${query}_${category}`;
            if (this.knowledgeCache.has(cacheKey)) {
                return this.knowledgeCache.get(cacheKey);
            }

            let sql = `
                SELECT 
                    id, category, question, answer, keywords, tags,
                    confidence_score, usage_count, effectiveness_score,
                    created_at, updated_at
                FROM knowledge_base 
                WHERE shop_id = ? 
                AND status = 'active'
            `;
            
            const params = [shopId];

            if (!includeInactive) {
                sql += ` AND is_active = 1`;
            }

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (query) {
                // 简单的文本匹配（可以后续升级为更复杂的语义搜索）
                sql += ` AND (
                    question LIKE ? OR 
                    answer LIKE ? OR 
                    keywords LIKE ? OR
                    tags LIKE ?
                )`;
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            sql += ` AND confidence_score >= ?`;
            params.push(minConfidence);

            sql += ` ORDER BY 
                effectiveness_score DESC, 
                usage_count DESC, 
                confidence_score DESC 
                LIMIT ?`;
            params.push(limit);

            const results = await this.db.all(sql, params);

            // 处理JSON字段
            const processedResults = results.map(row => ({
                ...row,
                keywords: this.safeJsonParse(row.keywords, []),
                tags: this.safeJsonParse(row.tags, [])
            }));

            // 缓存结果
            this.knowledgeCache.set(cacheKey, processedResults);

            console.log(`📚 [KnowledgeBaseService] 知识查询完成: ${processedResults.length}条结果`);
            return processedResults;

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 知识查询失败:', error);
            throw error;
        }
    }

    /**
     * 获取最佳答案
     */
    async getBestAnswer(shopId, question) {
        try {
            console.log(`🔍 [KnowledgeBaseService] 查找最佳答案: ${question}`);

            const results = await this.searchKnowledge(shopId, question, {
                limit: 5,
                minConfidence: 0.6
            });

            if (results.length === 0) {
                return null;
            }

            // 简单的匹配算法（可以后续升级为AI匹配）
            const bestMatch = results[0];

            // 记录使用
            await this.recordUsage(bestMatch.id);

            return {
                id: bestMatch.id,
                question: bestMatch.question,
                answer: bestMatch.answer,
                confidence: bestMatch.confidence_score,
                category: bestMatch.category
            };

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 获取最佳答案失败:', error);
            throw error;
        }
    }

    /**
     * 记录知识使用情况
     */
    async recordUsage(knowledgeId, effectiveness = null) {
        try {
            let sql = `
                UPDATE knowledge_base 
                SET usage_count = usage_count + 1,
                    updated_at = CURRENT_TIMESTAMP
            `;
            const params = [];

            if (effectiveness !== null) {
                sql += `, effectiveness_score = (effectiveness_score + ?) / 2`;
                params.push(effectiveness);
            }

            sql += ` WHERE id = ?`;
            params.push(knowledgeId);

            await this.db.run(sql, params);

            console.log(`📊 [KnowledgeBaseService] 使用记录已更新: ${knowledgeId}`);

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 记录使用失败:', error);
        }
    }

    /**
     * 获取店铺知识库统计
     */
    async getKnowledgeStats(shopId) {
        try {
            const sql = `
                SELECT 
                    category,
                    COUNT(*) as count,
                    AVG(confidence_score) as avg_confidence,
                    SUM(usage_count) as total_usage,
                    AVG(effectiveness_score) as avg_effectiveness
                FROM knowledge_base 
                WHERE shop_id = ? AND status = 'active' AND is_active = 1
                GROUP BY category
            `;

            const results = await this.db.all(sql, [shopId]);

            const stats = {
                total: 0,
                categories: {},
                overall_usage: 0,
                avg_effectiveness: 0
            };

            results.forEach(row => {
                stats.total += row.count;
                stats.overall_usage += row.total_usage;
                stats.categories[row.category] = {
                    count: row.count,
                    avg_confidence: row.avg_confidence,
                    total_usage: row.total_usage,
                    avg_effectiveness: row.avg_effectiveness
                };
            });

            if (results.length > 0) {
                stats.avg_effectiveness = results.reduce((sum, row) => 
                    sum + row.avg_effectiveness, 0) / results.length;
            }

            return stats;

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 获取统计失败:', error);
            throw error;
        }
    }

    /**
     * 更新知识条目
     */
    async updateKnowledge(knowledgeId, updates) {
        try {
            const allowedFields = [
                'question', 'answer', 'keywords', 'confidence_score',
                'tags', 'status', 'is_active'
            ];

            const setClause = [];
            const params = [];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = ?`);
                    if (key === 'keywords' || key === 'tags') {
                        params.push(JSON.stringify(updates[key]));
                    } else {
                        params.push(updates[key]);
                    }
                }
            });

            if (setClause.length === 0) {
                throw new Error('没有有效的更新字段');
            }

            setClause.push('updated_at = CURRENT_TIMESTAMP');

            const sql = `
                UPDATE knowledge_base 
                SET ${setClause.join(', ')}
                WHERE id = ?
            `;
            params.push(knowledgeId);

            const result = await this.db.run(sql, params);

            if (result.changes === 0) {
                throw new Error('知识条目不存在');
            }

            // 清除相关缓存
            this.knowledgeCache.clear();

            console.log(`✅ [KnowledgeBaseService] 知识条目已更新: ${knowledgeId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 更新知识失败:', error);
            throw error;
        }
    }

    /**
     * 删除知识条目
     */
    async deleteKnowledge(knowledgeId) {
        try {
            const sql = `DELETE FROM knowledge_base WHERE id = ?`;
            const result = await this.db.run(sql, [knowledgeId]);

            if (result.changes === 0) {
                throw new Error('知识条目不存在');
            }

            // 清除缓存
            this.knowledgeCache.clear();

            console.log(`✅ [KnowledgeBaseService] 知识条目已删除: ${knowledgeId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ [KnowledgeBaseService] 删除知识失败:', error);
            throw error;
        }
    }

    /**
     * 生成知识ID
     */
    generateKnowledgeId() {
        return 'kb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 安全解析JSON
     */
    safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString || 'null') || defaultValue;
        } catch {
            return defaultValue;
        }
    }

    /**
     * 清除缓存
     */
    clearCache(shopId = null) {
        if (shopId) {
            // 清除特定店铺的缓存
            for (const key of this.knowledgeCache.keys()) {
                if (key.startsWith(`${shopId}_`)) {
                    this.knowledgeCache.delete(key);
                }
            }
        } else {
            // 清除所有缓存
            this.knowledgeCache.clear();
        }
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            knowledgeCache: this.knowledgeCache.size,
            categoryCache: this.categoryCache.size
        };
    }
}

module.exports = KnowledgeBaseService;