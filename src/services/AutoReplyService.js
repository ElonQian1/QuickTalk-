/**
 * 自动回复服务 - 从AIAssistantManager拆分出来
 * Phase 7 架构重构：专门负责自动回复逻辑
 * 
 * 负责：
 * - 自动回复规则管理
 * - 智能回复生成
 * - 回复模板管理
 * - 回复效果统计
 */

class AutoReplyService {
    constructor(database, knowledgeBaseService, intentClassificationService) {
        this.db = database;
        this.knowledgeBase = knowledgeBaseService;
        this.intentClassification = intentClassificationService;
        this.replyCache = new Map();
        this.templateCache = new Map();
        
        console.log('🤖 [AutoReplyService] 自动回复服务已初始化');
    }

    /**
     * 初始化自动回复表结构
     */
    async initializeTables() {
        try {
            const DatabaseSchemaManager = require('../utils/DatabaseSchemaManager');
            const schemaManager = new DatabaseSchemaManager(this.db);
            
            const tableDefinition = {
                name: 'auto_reply_templates',
                definition: `
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    template_type TEXT NOT NULL CHECK(template_type IN ('greeting', 'goodbye', 'fallback', 'faq', 'intent_based', 'custom')),
                    template_name TEXT NOT NULL,
                    template_content TEXT NOT NULL,
                    trigger_conditions TEXT, -- JSON格式存储触发条件
                    response_variables TEXT, -- JSON格式存储变量配置
                    priority_level INTEGER DEFAULT 1,
                    is_active BOOLEAN DEFAULT 1,
                    usage_count INTEGER DEFAULT 0,
                    satisfaction_score REAL DEFAULT 0.0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
                `,
                description: '自动回复模板表'
            };
            
            await schemaManager.createTables([tableDefinition]);
            
            // 创建对话上下文表
            const contextTableDefinition = {
                name: 'conversation_context',
                definition: `
                    id TEXT PRIMARY KEY,
                    shop_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    context_data TEXT, -- JSON格式存储上下文数据
                    conversation_stage TEXT DEFAULT 'initial',
                    last_intent TEXT,
                    context_expires_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                `,
                description: '对话上下文表'
            };
            
            await schemaManager.createTables([contextTableDefinition]);
            
            // 创建索引
            const indexes = [
                {
                    name: 'idx_template_shop_type',
                    table: 'auto_reply_templates',
                    columns: 'shop_id, template_type',
                    description: '自动回复模板类型索引'
                },
                {
                    name: 'idx_template_active',
                    table: 'auto_reply_templates',
                    columns: 'is_active',
                    description: '自动回复模板状态索引'
                },
                {
                    name: 'idx_context_conversation',
                    table: 'conversation_context',
                    columns: 'conversation_id',
                    description: '对话上下文会话索引'
                },
                {
                    name: 'idx_context_expires',
                    table: 'conversation_context',
                    columns: 'context_expires_at',
                    description: '对话上下文过期索引'
                }
            ];
            
            await schemaManager.createIndexes(indexes);
            
            console.log('✅ [AutoReplyService] 自动回复表初始化完成');
            
        } catch (error) {
            console.error('❌ [AutoReplyService] 表初始化失败:', error);
            throw error;
        }
    }

    /**
     * 生成自动回复
     */
    async generateAutoReply(shopId, userId, userMessage, conversationId) {
        try {
            console.log(`🤖 [AutoReplyService] 生成自动回复: 店铺=${shopId}, 用户=${userId}`);

            // 1. 获取对话上下文
            const context = await this.getConversationContext(shopId, userId, conversationId);

            // 2. 意图识别
            const intentResult = await this.intentClassification.classifyIntent(shopId, userMessage);

            // 3. 查找最佳知识库答案
            const knowledgeAnswer = await this.knowledgeBase.getBestAnswer(shopId, userMessage);

            // 4. 生成回复
            let reply = null;

            if (intentResult && intentResult.confidence > 0.8) {
                // 高置信度意图回复
                reply = await this.generateIntentBasedReply(intentResult, context);
            } else if (knowledgeAnswer && knowledgeAnswer.confidence > 0.7) {
                // 知识库回复
                reply = await this.generateKnowledgeBasedReply(knowledgeAnswer, context);
            } else {
                // 降级回复
                reply = await this.generateFallbackReply(shopId, userMessage, context);
            }

            // 5. 更新对话上下文
            await this.updateConversationContext(shopId, userId, conversationId, {
                last_message: userMessage,
                last_intent: intentResult?.intent_name,
                reply_type: reply?.type,
                reply_content: reply?.content
            });

            // 6. 记录回复使用
            if (reply?.template_id) {
                await this.recordTemplateUsage(reply.template_id);
            }

            console.log(`✅ [AutoReplyService] 自动回复生成完成: ${reply?.type || 'none'}`);
            return reply;

        } catch (error) {
            console.error('❌ [AutoReplyService] 生成自动回复失败:', error);
            throw error;
        }
    }

    /**
     * 基于意图生成回复
     */
    async generateIntentBasedReply(intentResult, context) {
        try {
            const response = await this.intentClassification.generateResponse(intentResult, context);
            
            if (response) {
                return {
                    type: 'intent_based',
                    content: response.text,
                    confidence: response.confidence,
                    intent: response.intent,
                    source: 'intent_classification'
                };
            }

            return null;

        } catch (error) {
            console.error('❌ [AutoReplyService] 意图回复生成失败:', error);
            return null;
        }
    }

    /**
     * 基于知识库生成回复
     */
    async generateKnowledgeBasedReply(knowledgeAnswer, context) {
        try {
            return {
                type: 'knowledge_based',
                content: knowledgeAnswer.answer,
                confidence: knowledgeAnswer.confidence,
                category: knowledgeAnswer.category,
                source: 'knowledge_base',
                knowledge_id: knowledgeAnswer.id
            };

        } catch (error) {
            console.error('❌ [AutoReplyService] 知识库回复生成失败:', error);
            return null;
        }
    }

    /**
     * 生成降级回复
     */
    async generateFallbackReply(shopId, userMessage, context) {
        try {
            // 获取降级回复模板
            const fallbackTemplates = await this.getTemplatesByType(shopId, 'fallback');
            
            if (fallbackTemplates.length > 0) {
                const template = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
                
                return {
                    type: 'fallback',
                    content: this.processTemplate(template.template_content, context),
                    confidence: 0.5,
                    source: 'fallback_template',
                    template_id: template.id
                };
            }

            // 默认回复
            return {
                type: 'default',
                content: '抱歉，我暂时无法理解您的问题。请稍等，人工客服将为您服务。',
                confidence: 0.3,
                source: 'default'
            };

        } catch (error) {
            console.error('❌ [AutoReplyService] 降级回复生成失败:', error);
            return {
                type: 'error',
                content: '系统繁忙，请稍后再试。',
                confidence: 0.1,
                source: 'error'
            };
        }
    }

    /**
     * 获取对话上下文
     */
    async getConversationContext(shopId, userId, conversationId) {
        try {
            const sql = `
                SELECT context_data, conversation_stage, last_intent, created_at
                FROM conversation_context 
                WHERE shop_id = ? AND user_id = ? AND conversation_id = ?
                AND (context_expires_at IS NULL OR context_expires_at > CURRENT_TIMESTAMP)
                ORDER BY updated_at DESC 
                LIMIT 1
            `;

            const result = await this.db.get(sql, [shopId, userId, conversationId]);

            if (result) {
                return {
                    ...this.safeJsonParse(result.context_data, {}),
                    conversation_stage: result.conversation_stage,
                    last_intent: result.last_intent,
                    session_start: result.created_at
                };
            }

            // 创建新的上下文
            return {
                conversation_stage: 'initial',
                session_start: new Date().toISOString(),
                user_id: userId,
                shop_id: shopId
            };

        } catch (error) {
            console.error('❌ [AutoReplyService] 获取对话上下文失败:', error);
            return {};
        }
    }

    /**
     * 更新对话上下文
     */
    async updateConversationContext(shopId, userId, conversationId, updates) {
        try {
            const contextId = `ctx_${shopId}_${userId}_${conversationId}`;
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期

            const sql = `
                INSERT OR REPLACE INTO conversation_context (
                    id, shop_id, user_id, conversation_id, context_data,
                    conversation_stage, last_intent, context_expires_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            await this.db.run(sql, [
                contextId, shopId, userId, conversationId,
                JSON.stringify(updates),
                updates.conversation_stage || 'active',
                updates.last_intent,
                expiresAt.toISOString()
            ]);

        } catch (error) {
            console.error('❌ [AutoReplyService] 更新对话上下文失败:', error);
        }
    }

    /**
     * 获取指定类型的模板
     */
    async getTemplatesByType(shopId, templateType) {
        try {
            const cacheKey = `${shopId}_${templateType}`;
            if (this.templateCache.has(cacheKey)) {
                return this.templateCache.get(cacheKey);
            }

            const sql = `
                SELECT id, template_name, template_content, trigger_conditions, response_variables
                FROM auto_reply_templates 
                WHERE shop_id = ? AND template_type = ? AND is_active = 1
                ORDER BY priority_level DESC, usage_count DESC
            `;

            const results = await this.db.all(sql, [shopId, templateType]);

            // 处理JSON字段
            const processedResults = results.map(row => ({
                ...row,
                trigger_conditions: this.safeJsonParse(row.trigger_conditions, {}),
                response_variables: this.safeJsonParse(row.response_variables, {})
            }));

            this.templateCache.set(cacheKey, processedResults);
            return processedResults;

        } catch (error) {
            console.error('❌ [AutoReplyService] 获取模板失败:', error);
            return [];
        }
    }

    /**
     * 处理模板变量
     */
    processTemplate(templateContent, context) {
        let processedContent = templateContent;

        // 替换上下文变量
        Object.keys(context).forEach(key => {
            const placeholder = `{${key}}`;
            const value = context[key] || '';
            processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
        });

        // 替换时间变量
        const now = new Date();
        const timeVariables = {
            '{time}': now.toLocaleTimeString(),
            '{date}': now.toLocaleDateString(),
            '{hour}': now.getHours(),
            '{minute}': now.getMinutes()
        };

        Object.keys(timeVariables).forEach(key => {
            processedContent = processedContent.replace(new RegExp(key, 'g'), timeVariables[key]);
        });

        return processedContent;
    }

    /**
     * 记录模板使用情况
     */
    async recordTemplateUsage(templateId, satisfaction = null) {
        try {
            let sql = `
                UPDATE auto_reply_templates 
                SET usage_count = usage_count + 1,
                    updated_at = CURRENT_TIMESTAMP
            `;
            const params = [];

            if (satisfaction !== null) {
                sql += `, satisfaction_score = (satisfaction_score + ?) / 2`;
                params.push(satisfaction);
            }

            sql += ` WHERE id = ?`;
            params.push(templateId);

            await this.db.run(sql, params);

            console.log(`📊 [AutoReplyService] 模板使用已记录: ${templateId}`);

        } catch (error) {
            console.error('❌ [AutoReplyService] 记录模板使用失败:', error);
        }
    }

    /**
     * 添加回复模板
     */
    async addTemplate(shopId, templateData) {
        try {
            const id = this.generateTemplateId();
            const {
                template_type,
                template_name,
                template_content,
                trigger_conditions = {},
                response_variables = {},
                priority_level = 1
            } = templateData;

            const sql = `
                INSERT INTO auto_reply_templates (
                    id, shop_id, template_type, template_name, template_content,
                    trigger_conditions, response_variables, priority_level
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await this.db.run(sql, [
                id, shopId, template_type, template_name, template_content,
                JSON.stringify(trigger_conditions),
                JSON.stringify(response_variables),
                priority_level
            ]);

            // 清除缓存
            this.clearCache(shopId);

            console.log(`✅ [AutoReplyService] 回复模板已添加: ${template_name}`);
            return { success: true, id };

        } catch (error) {
            console.error('❌ [AutoReplyService] 添加模板失败:', error);
            throw error;
        }
    }

    /**
     * 获取自动回复统计
     */
    async getAutoReplyStats(shopId) {
        try {
            const sql = `
                SELECT 
                    template_type,
                    COUNT(*) as count,
                    SUM(usage_count) as total_usage,
                    AVG(satisfaction_score) as avg_satisfaction
                FROM auto_reply_templates 
                WHERE shop_id = ? AND is_active = 1
                GROUP BY template_type
            `;

            const results = await this.db.all(sql, [shopId]);

            const stats = {
                total_templates: 0,
                total_usage: 0,
                avg_satisfaction: 0,
                by_type: {}
            };

            results.forEach(row => {
                stats.total_templates += row.count;
                stats.total_usage += row.total_usage;
                stats.by_type[row.template_type] = {
                    count: row.count,
                    total_usage: row.total_usage,
                    avg_satisfaction: row.avg_satisfaction
                };
            });

            if (results.length > 0) {
                stats.avg_satisfaction = results.reduce((sum, row) => 
                    sum + row.avg_satisfaction, 0) / results.length;
            }

            return stats;

        } catch (error) {
            console.error('❌ [AutoReplyService] 获取统计失败:', error);
            throw error;
        }
    }

    /**
     * 清理过期上下文
     */
    async cleanupExpiredContexts() {
        try {
            const sql = `
                DELETE FROM conversation_context 
                WHERE context_expires_at < CURRENT_TIMESTAMP
            `;

            const result = await this.db.run(sql);
            
            if (result.changes > 0) {
                console.log(`🧹 [AutoReplyService] 清理过期上下文: ${result.changes}条`);
            }

        } catch (error) {
            console.error('❌ [AutoReplyService] 清理上下文失败:', error);
        }
    }

    /**
     * 生成模板ID
     */
    generateTemplateId() {
        return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
            for (const key of this.templateCache.keys()) {
                if (key.startsWith(`${shopId}_`)) {
                    this.templateCache.delete(key);
                }
            }
        } else {
            this.templateCache.clear();
        }
        this.replyCache.clear();
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            replyCache: this.replyCache.size,
            templateCache: this.templateCache.size
        };
    }
}

module.exports = AutoReplyService;