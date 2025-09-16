/**
 * AI智能客服管理器 - Phase 7 重构版本
 * 
 * 重构说明：
 * - 原来1206行的超大类已被拆分为3个专门的服务类
 * - 现在作为服务编排器，协调各个AI服务的工作
 * - 遵循单一职责原则和依赖注入模式
 * 
 * 架构：
 * AIAssistantManager (编排器)
 *   ├── KnowledgeBaseService (知识库服务)
 *   ├── IntentClassificationService (意图识别服务)
 *   └── AutoReplyService (自动回复服务)
 */

const KnowledgeBaseService = require('./services/KnowledgeBaseService');
const IntentClassificationService = require('./services/IntentClassificationService');
const AutoReplyService = require('./services/AutoReplyService');

class AIAssistantManager {
    constructor(database) {
        this.db = database;
        
        // 初始化各个服务
        this.knowledgeBase = new KnowledgeBaseService(database);
        this.intentClassification = new IntentClassificationService(database);
        this.autoReply = new AutoReplyService(database, this.knowledgeBase, this.intentClassification);
        
        // 管理器状态
        this.isInitialized = false;
        this.stats = {
            totalQuestions: 0,
            totalReplies: 0,
            avgResponseTime: 0
        };
        
        console.log('🤖 [AIAssistantManager] AI智能客服管理器已初始化 (Phase 7重构版)');
    }

    /**
     * 初始化所有AI服务
     */
    async initialize() {
        try {
            console.log('🚀 [AIAssistantManager] 开始初始化AI服务...');

            // 初始化各个服务的表结构
            await this.knowledgeBase.initializeTables();
            await this.intentClassification.initializeTables();
            await this.autoReply.initializeTables();

            // 加载默认配置
            await this.loadDefaultConfigurations();

            this.isInitialized = true;
            console.log('✅ [AIAssistantManager] AI服务初始化完成');

        } catch (error) {
            console.error('❌ [AIAssistantManager] AI服务初始化失败:', error);
            throw error;
        }
    }

    /**
     * 处理用户消息 - 主要接口
     */
    async processUserMessage(shopId, userId, userMessage, conversationId) {
        try {
            const startTime = Date.now();
            
            console.log(`🤖 [AIAssistantManager] 处理用户消息: 店铺=${shopId}, 用户=${userId}`);

            if (!this.isInitialized) {
                throw new Error('AI服务未初始化');
            }

            // 生成AI回复
            const aiReply = await this.autoReply.generateAutoReply(
                shopId, userId, userMessage, conversationId
            );

            // 记录统计
            const responseTime = Date.now() - startTime;
            await this.updateStats(shopId, responseTime);

            if (aiReply) {
                console.log(`✅ [AIAssistantManager] AI回复生成成功: ${aiReply.type} (${responseTime}ms)`);
                
                return {
                    success: true,
                    reply: aiReply,
                    responseTime,
                    processed_by: 'ai_assistant'
                };
            } else {
                console.log(`⚠️ [AIAssistantManager] 无法生成AI回复，转人工处理`);
                
                return {
                    success: false,
                    reason: 'no_suitable_reply',
                    fallback_to_human: true,
                    responseTime
                };
            }

        } catch (error) {
            console.error('❌ [AIAssistantManager] 处理用户消息失败:', error);
            throw error;
        }
    }

    /**
     * 管理知识库
     */
    async manageKnowledge(shopId, action, data) {
        try {
            switch (action) {
                case 'add':
                    return await this.knowledgeBase.addKnowledge(shopId, data);
                
                case 'search':
                    return await this.knowledgeBase.searchKnowledge(shopId, data.query, data.options);
                
                case 'update':
                    return await this.knowledgeBase.updateKnowledge(data.id, data.updates);
                
                case 'delete':
                    return await this.knowledgeBase.deleteKnowledge(data.id);
                
                case 'stats':
                    return await this.knowledgeBase.getKnowledgeStats(shopId);
                
                default:
                    throw new Error(`未知的知识库操作: ${action}`);
            }
        } catch (error) {
            console.error('❌ [AIAssistantManager] 知识库操作失败:', error);
            throw error;
        }
    }

    /**
     * 管理意图识别
     */
    async manageIntent(shopId, action, data) {
        try {
            switch (action) {
                case 'add':
                    return await this.intentClassification.addIntent(shopId, data);
                
                case 'classify':
                    return await this.intentClassification.classifyIntent(shopId, data.message);
                
                case 'train':
                    return await this.intentClassification.trainModel(shopId);
                
                case 'update':
                    return await this.intentClassification.updateIntent(data.id, data.updates);
                
                case 'stats':
                    return await this.intentClassification.getIntentStats(shopId);
                
                default:
                    throw new Error(`未知的意图操作: ${action}`);
            }
        } catch (error) {
            console.error('❌ [AIAssistantManager] 意图操作失败:', error);
            throw error;
        }
    }

    /**
     * 管理自动回复
     */
    async manageAutoReply(shopId, action, data) {
        try {
            switch (action) {
                case 'add_template':
                    return await this.autoReply.addTemplate(shopId, data);
                
                case 'generate':
                    return await this.autoReply.generateAutoReply(
                        shopId, data.userId, data.message, data.conversationId
                    );
                
                case 'stats':
                    return await this.autoReply.getAutoReplyStats(shopId);
                
                case 'cleanup':
                    return await this.autoReply.cleanupExpiredContexts();
                
                default:
                    throw new Error(`未知的自动回复操作: ${action}`);
            }
        } catch (error) {
            console.error('❌ [AIAssistantManager] 自动回复操作失败:', error);
            throw error;
        }
    }

    /**
     * 获取AI助手全面统计
     */
    async getComprehensiveStats(shopId) {
        try {
            const [knowledgeStats, intentStats, autoReplyStats] = await Promise.all([
                this.knowledgeBase.getKnowledgeStats(shopId),
                this.intentClassification.getIntentStats(shopId),
                this.autoReply.getAutoReplyStats(shopId)
            ]);

            return {
                knowledge_base: knowledgeStats,
                intent_classification: intentStats,
                auto_reply: autoReplyStats,
                cache_stats: this.getCacheStats(),
                overall_stats: this.stats
            };

        } catch (error) {
            console.error('❌ [AIAssistantManager] 获取统计失败:', error);
            throw error;
        }
    }

    /**
     * 训练AI模型
     */
    async trainAIModel(shopId) {
        try {
            console.log(`🎯 [AIAssistantManager] 开始训练店铺 ${shopId} 的AI模型`);

            // 训练意图识别模型
            const intentModel = await this.intentClassification.trainModel(shopId);

            // 优化知识库
            const knowledgeStats = await this.knowledgeBase.getKnowledgeStats(shopId);

            // 清理过期数据
            await this.autoReply.cleanupExpiredContexts();

            const result = {
                success: true,
                intent_model: intentModel,
                knowledge_stats: knowledgeStats,
                trained_at: new Date().toISOString()
            };

            console.log('✅ [AIAssistantManager] AI模型训练完成');
            return result;

        } catch (error) {
            console.error('❌ [AIAssistantManager] AI模型训练失败:', error);
            throw error;
        }
    }

    /**
     * 更新统计信息
     */
    async updateStats(shopId, responseTime) {
        try {
            this.stats.totalQuestions++;
            this.stats.totalReplies++;
            
            // 计算平均响应时间
            this.stats.avgResponseTime = (this.stats.avgResponseTime + responseTime) / 2;

            // 可以在这里添加数据库统计记录
            // await this.saveStatsToDatabase(shopId, responseTime);

        } catch (error) {
            console.error('❌ [AIAssistantManager] 更新统计失败:', error);
        }
    }

    /**
     * 加载默认配置
     */
    async loadDefaultConfigurations() {
        try {
            // 可以在这里加载默认的知识库、意图配置等
            console.log('📝 [AIAssistantManager] 默认配置已加载');
        } catch (error) {
            console.error('❌ [AIAssistantManager] 加载默认配置失败:', error);
        }
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                services: {},
                initialized: this.isInitialized,
                uptime: process.uptime(),
                memory_usage: process.memoryUsage()
            };

            // 检查各个服务状态
            health.services.knowledge_base = this.knowledgeBase ? 'ready' : 'error';
            health.services.intent_classification = this.intentClassification ? 'ready' : 'error';
            health.services.auto_reply = this.autoReply ? 'ready' : 'error';

            return health;

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            knowledge_base: this.knowledgeBase.getCacheStats(),
            intent_classification: this.intentClassification.getCacheStats(),
            auto_reply: this.autoReply.getCacheStats()
        };
    }

    /**
     * 清除所有缓存
     */
    clearAllCaches(shopId = null) {
        this.knowledgeBase.clearCache(shopId);
        this.intentClassification.clearCache(shopId);
        this.autoReply.clearCache(shopId);
        
        console.log(`🧹 [AIAssistantManager] 缓存已清除${shopId ? ` (店铺: ${shopId})` : ' (全部)'}`);
    }

    /**
     * 关闭AI助手
     */
    async shutdown() {
        try {
            console.log('🔄 [AIAssistantManager] 正在关闭AI服务...');

            // 清理缓存
            this.clearAllCaches();

            // 清理过期数据
            await this.autoReply.cleanupExpiredContexts();

            this.isInitialized = false;
            console.log('✅ [AIAssistantManager] AI服务已关闭');

        } catch (error) {
            console.error('❌ [AIAssistantManager] 关闭AI服务失败:', error);
        }
    }
}

module.exports = AIAssistantManager;