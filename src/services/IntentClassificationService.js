/**
 * 意图识别服务 - 从AIAssistantManager拆分出来
 * Phase 7 架构重构：专门负责用户意图识别和分类
 * 
 * 负责：
 * - 用户意图识别
 * - 训练短语管理
 * - 意图分类算法
 * - 响应模板管理
 */

class IntentClassificationService {
    constructor(database) {
        this.db = database;
        this.intentCache = new Map();
        this.trainingData = new Map();
        this.classificationModel = new Map();
        
        console.log('🎯 [IntentClassificationService] 意图识别服务已初始化');
    }

    /**
     * 初始化意图识别表结构
     */
    async initializeTables() {
        try {
            const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');
            const schemaManager = new DatabaseSchemaManager(this.db);
            
            const tableDefinition = {
                name: 'intent_classification',
                definition: `
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    intent_name TEXT NOT NULL,
                    intent_description TEXT,
                    training_phrases TEXT NOT NULL, -- JSON格式存储训练短语
                    response_templates TEXT, -- JSON格式存储回复模板
                    confidence_threshold REAL DEFAULT 0.7,
                    priority_level INTEGER DEFAULT 1,
                    is_active BOOLEAN DEFAULT 1,
                    usage_count INTEGER DEFAULT 0,
                    accuracy_score REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                `,
                description: '意图识别表'
            };
            
            await schemaManager.createTables([tableDefinition]);
            
            // 创建索引
            const indexes = [
                {
                    name: 'idx_intent_shop_active',
                    table: 'intent_classification',
                    columns: 'shop_id, is_active',
                    description: '意图识别店铺状态索引'
                },
                {
                    name: 'idx_intent_priority',
                    table: 'intent_classification',
                    columns: 'priority_level, confidence_threshold',
                    description: '意图识别优先级索引'
                }
            ];
            
            await schemaManager.createIndexes(indexes);
            
            console.log('✅ [IntentClassificationService] 意图识别表初始化完成');
            
        } catch (error) {
            console.error('❌ [IntentClassificationService] 表初始化失败:', error);
            throw error;
        }
    }

    /**
     * 添加意图分类
     */
    async addIntent(shopId, intentData) {
        try {
            const id = this.generateIntentId();
            const {
                intent_name,
                intent_description,
                training_phrases = [],
                response_templates = [],
                confidence_threshold = 0.7,
                priority_level = 1
            } = intentData;

            const sql = `
                INSERT INTO intent_classification (
                    id, shop_id, intent_name, intent_description, 
                    training_phrases, response_templates, confidence_threshold, priority_level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(sql, [
                id, shopId, intent_name, intent_description,
                JSON.stringify(training_phrases),
                JSON.stringify(response_templates),
                confidence_threshold,
                priority_level
            ]);

            // 清除缓存
            this.clearCache(shopId);

            console.log(`✅ [IntentClassificationService] 意图已添加: ${intent_name}`);
            return { success: true, id };

        } catch (error) {
            console.error('❌ [IntentClassificationService] 添加意图失败:', error);
            throw error;
        }
    }

    /**
     * 识别用户意图
     */
    async classifyIntent(shopId, userMessage) {
        try {
            console.log(`🎯 [IntentClassificationService] 分析用户意图: ${userMessage}`);

            // 获取店铺的所有意图配置
            const intents = await this.getShopIntents(shopId);
            
            if (intents.length === 0) {
                return null;
            }

            // 简单的文本匹配算法（可以后续升级为机器学习模型）
            const results = [];

            for (const intent of intents) {
                const confidence = this.calculateTextSimilarity(userMessage, intent.training_phrases);
                
                if (confidence >= intent.confidence_threshold) {
                    results.push({
                        intent_id: intent.id,
                        intent_name: intent.intent_name,
                        confidence,
                        response_templates: intent.response_templates,
                        priority: intent.priority_level
                    });
                }
            }

            // 按置信度和优先级排序
            results.sort((a, b) => {
                if (a.confidence !== b.confidence) {
                    return b.confidence - a.confidence;
                }
                return b.priority - a.priority;
            });

            const bestMatch = results[0] || null;

            if (bestMatch) {
                // 记录使用情况
                await this.recordIntentUsage(bestMatch.intent_id, bestMatch.confidence);
                
                console.log(`✅ [IntentClassificationService] 意图识别成功: ${bestMatch.intent_name} (${bestMatch.confidence.toFixed(2)})`);
            }

            return bestMatch;

        } catch (error) {
            console.error('❌ [IntentClassificationService] 意图识别失败:', error);
            throw error;
        }
    }

    /**
     * 获取店铺意图配置
     */
    async getShopIntents(shopId) {
        try {
            // 检查缓存
            if (this.intentCache.has(shopId)) {
                return this.intentCache.get(shopId);
            }

            const sql = `
                SELECT 
                    id, intent_name, intent_description, training_phrases,
                    response_templates, confidence_threshold, priority_level,
                    usage_count, accuracy_score
                FROM intent_classification 
                WHERE shop_id = ? AND is_active = 1
                ORDER BY priority_level DESC, usage_count DESC
            `;

            const results = await this.db.all(sql, [shopId]);

            // 处理JSON字段
            const processedResults = results.map(row => ({
                ...row,
                training_phrases: this.safeJsonParse(row.training_phrases, []),
                response_templates: this.safeJsonParse(row.response_templates, [])
            }));

            // 缓存结果
            this.intentCache.set(shopId, processedResults);

            return processedResults;

        } catch (error) {
            console.error('❌ [IntentClassificationService] 获取意图配置失败:', error);
            throw error;
        }
    }

    /**
     * 计算文本相似度（简单实现）
     */
    calculateTextSimilarity(userMessage, trainingPhrases) {
        if (!trainingPhrases || trainingPhrases.length === 0) {
            return 0;
        }

        const userWords = this.tokenize(userMessage.toLowerCase());
        let maxSimilarity = 0;

        for (const phrase of trainingPhrases) {
            const phraseWords = this.tokenize(phrase.toLowerCase());
            const similarity = this.jaccardSimilarity(userWords, phraseWords);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        return maxSimilarity;
    }

    /**
     * 文本分词（简单实现）
     */
    tokenize(text) {
        return text.replace(/[^\w\s]/g, '').split(/\s+/).filter(word => word.length > 0);
    }

    /**
     * Jaccard相似度计算
     */
    jaccardSimilarity(set1, set2) {
        const setA = new Set(set1);
        const setB = new Set(set2);
        
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        
        return union.size === 0 ? 0 : intersection.size / union.size;
    }

    /**
     * 记录意图使用情况
     */
    async recordIntentUsage(intentId, confidence) {
        try {
            const sql = `
                UPDATE intent_classification 
                SET usage_count = usage_count + 1,
                    accuracy_score = (accuracy_score + ?) / 2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            await this.db.run(sql, [confidence, intentId]);

            console.log(`📊 [IntentClassificationService] 意图使用已记录: ${intentId}`);

        } catch (error) {
            console.error('❌ [IntentClassificationService] 记录使用失败:', error);
        }
    }

    /**
     * 生成响应
     */
    async generateResponse(intentResult, context = {}) {
        try {
            if (!intentResult || !intentResult.response_templates || intentResult.response_templates.length === 0) {
                return null;
            }

            // 随机选择一个响应模板
            const templates = intentResult.response_templates;
            const template = templates[Math.floor(Math.random() * templates.length)];

            // 简单的模板变量替换
            let response = template;
            
            Object.keys(context).forEach(key => {
                const placeholder = `{${key}}`;
                response = response.replace(new RegExp(placeholder, 'g'), context[key] || '');
            });

            return {
                text: response,
                intent: intentResult.intent_name,
                confidence: intentResult.confidence
            };

        } catch (error) {
            console.error('❌ [IntentClassificationService] 生成响应失败:', error);
            return null;
        }
    }

    /**
     * 训练意图模型（简单实现）
     */
    async trainModel(shopId) {
        try {
            console.log(`🎯 [IntentClassificationService] 开始训练店铺 ${shopId} 的意图模型`);

            const intents = await this.getShopIntents(shopId);
            
            // 简单的统计模型
            const model = {
                shopId,
                intentCount: intents.length,
                totalPhrases: intents.reduce((sum, intent) => sum + intent.training_phrases.length, 0),
                lastTrained: new Date().toISOString()
            };

            this.classificationModel.set(shopId, model);

            console.log(`✅ [IntentClassificationService] 模型训练完成: ${model.intentCount}个意图, ${model.totalPhrases}个训练短语`);
            return model;

        } catch (error) {
            console.error('❌ [IntentClassificationService] 模型训练失败:', error);
            throw error;
        }
    }

    /**
     * 获取意图统计
     */
    async getIntentStats(shopId) {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_intents,
                    AVG(confidence_threshold) as avg_threshold,
                    SUM(usage_count) as total_usage,
                    AVG(accuracy_score) as avg_accuracy,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_intents
                FROM intent_classification 
                WHERE shop_id = ?
            `;

            const result = await this.db.get(sql, [shopId]);

            return {
                total_intents: result.total_intents || 0,
                active_intents: result.active_intents || 0,
                avg_threshold: result.avg_threshold || 0,
                total_usage: result.total_usage || 0,
                avg_accuracy: result.avg_accuracy || 0
            };

        } catch (error) {
            console.error('❌ [IntentClassificationService] 获取统计失败:', error);
            throw error;
        }
    }

    /**
     * 更新意图配置
     */
    async updateIntent(intentId, updates) {
        try {
            const allowedFields = [
                'intent_name', 'intent_description', 'training_phrases',
                'response_templates', 'confidence_threshold', 'priority_level', 'is_active'
            ];

            const setClause = [];
            const params = [];

            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = ?`);
                    if (key === 'training_phrases' || key === 'response_templates') {
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
                UPDATE intent_classification 
                SET ${setClause.join(', ')}
                WHERE id = ?
            `;
            params.push(intentId);

            const result = await this.db.run(sql, params);

            if (result.changes === 0) {
                throw new Error('意图配置不存在');
            }

            // 清除相关缓存
            this.intentCache.clear();

            console.log(`✅ [IntentClassificationService] 意图配置已更新: ${intentId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ [IntentClassificationService] 更新意图失败:', error);
            throw error;
        }
    }

    /**
     * 生成意图ID
     */
    generateIntentId() {
        return 'intent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
            this.intentCache.delete(shopId);
            this.classificationModel.delete(shopId);
        } else {
            this.intentCache.clear();
            this.classificationModel.clear();
        }
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            intentCache: this.intentCache.size,
            classificationModel: this.classificationModel.size
        };
    }
}

module.exports = IntentClassificationService;