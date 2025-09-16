/**
 * ServiceManager - 服务层管理器
 * 负责初始化和管理所有业务服务
 * 实现依赖注入和服务生命周期管理
 */

// 导入所有服务
const MessageService = require('./MessageService');
const ConversationService = require('./ConversationService');
const ShopService = require('./ShopService');
const NotificationService = require('./NotificationService');

// 导入AI服务
const KnowledgeBaseService = require('./KnowledgeBaseService');
const IntentClassificationService = require('./IntentClassificationService');
const AutoReplyService = require('./AutoReplyService');

class ServiceManager {
    constructor(repositories = {}, externalServices = {}) {
        // 存储仓库层依赖
        this.repositories = repositories;
        
        // 存储外部服务依赖
        this.externalServices = externalServices;
        
        // 服务实例存储
        this.services = {};
        
        // 初始化状态
        this.initialized = false;
        
        // 服务配置
        this.config = {
            enableNotifications: true,
            enableEmailNotifications: false,
            enablePushNotifications: false,
            retryAttempts: 3,
            timeoutMs: 30000
        };
    }

    /**
     * 初始化所有服务
     * @param {Object} config - 服务配置
     */
    async initialize(config = {}) {
        try {
            console.log('🔧 初始化服务层...');
            
            // 合并配置
            this.config = { ...this.config, ...config };
            
            // 按依赖顺序初始化服务
            await this.initializeBaseServices();
            await this.initializeBusinessServices();
            await this.initializeAIServices();
            
            this.initialized = true;
            console.log('✅ 服务层初始化完成');
            
            return {
                success: true,
                services: Object.keys(this.services)
            };

        } catch (error) {
            console.error('❌ 服务层初始化失败:', error);
            throw new Error(`服务层初始化失败: ${error.message}`);
        }
    }

    /**
     * 初始化基础服务
     * @private
     */
    async initializeBaseServices() {
        console.log('📡 初始化基础服务...');
        
        // 1. 通知服务（不依赖其他业务服务）
        this.services.notificationService = new NotificationService(
            this.externalServices.webSocketManager,
            this.externalServices.emailService,
            this.externalServices.pushService
        );
        
        console.log('✅ 基础服务初始化完成');
    }

    /**
     * 初始化业务服务
     * @private
     */
    async initializeBusinessServices() {
        console.log('🏪 初始化业务服务...');
        
        // 1. 店铺服务
        this.services.shopService = new ShopService(
            this.repositories.shopRepository,
            this.services.notificationService,
            this.externalServices.apiKeyManager
        );
        
        // 2. 对话服务
        this.services.conversationService = new ConversationService(
            this.repositories.messageRepository,
            this.repositories.shopRepository,
            this.services.notificationService
        );
        
        // 3. 消息服务（依赖对话服务）
        this.services.messageService = new MessageService(
            this.repositories.messageRepository,
            this.services.conversationService,
            this.services.notificationService
        );
        
        console.log('✅ 业务服务初始化完成');
    }

    /**
     * 初始化AI服务
     * @private
     */
    async initializeAIServices() {
        console.log('🤖 初始化AI服务...');
        
        // 1. 知识库服务
        this.services.knowledgeBaseService = new KnowledgeBaseService({
            persistenceAdapter: this.externalServices.knowledgePersistence,
            searchEngine: this.externalServices.searchEngine
        });
        
        // 2. 意图分类服务
        this.services.intentClassificationService = new IntentClassificationService({
            modelProvider: this.externalServices.nlpModelProvider,
            trainingDataManager: this.externalServices.trainingDataManager
        });
        
        // 3. 自动回复服务（依赖知识库和意图分类）
        this.services.autoReplyService = new AutoReplyService({
            knowledgeBaseService: this.services.knowledgeBaseService,
            intentClassificationService: this.services.intentClassificationService,
            templateEngine: this.externalServices.templateEngine
        });
        
        console.log('✅ AI服务初始化完成');
    }

    /**
     * 获取服务实例
     * @param {string} serviceName - 服务名称
     */
    getService(serviceName) {
        if (!this.initialized) {
            throw new Error('服务管理器未初始化，请先调用 initialize()');
        }

        const service = this.services[serviceName];
        if (!service) {
            throw new Error(`服务不存在: ${serviceName}`);
        }

        return service;
    }

    /**
     * 获取消息服务
     */
    getMessageService() {
        return this.getService('messageService');
    }

    /**
     * 获取对话服务
     */
    getConversationService() {
        return this.getService('conversationService');
    }

    /**
     * 获取店铺服务
     */
    getShopService() {
        return this.getService('shopService');
    }

    /**
     * 获取通知服务
     */
    getNotificationService() {
        return this.getService('notificationService');
    }

    /**
     * 获取知识库服务
     */
    getKnowledgeBaseService() {
        return this.getService('knowledgeBaseService');
    }

    /**
     * 获取意图分类服务
     */
    getIntentClassificationService() {
        return this.getService('intentClassificationService');
    }

    /**
     * 获取自动回复服务
     */
    getAutoReplyService() {
        return this.getService('autoReplyService');
    }

    /**
     * 获取所有服务
     */
    getAllServices() {
        if (!this.initialized) {
            throw new Error('服务管理器未初始化');
        }

        return { ...this.services };
    }

    /**
     * 检查服务健康状态
     */
    async checkHealth() {
        const healthStatus = {
            overall: 'healthy',
            services: {},
            timestamp: new Date()
        };

        try {
            // 检查每个服务的健康状态
            for (const [serviceName, service] of Object.entries(this.services)) {
                try {
                    // 如果服务有健康检查方法，调用它
                    if (typeof service.healthCheck === 'function') {
                        const serviceHealth = await service.healthCheck();
                        healthStatus.services[serviceName] = serviceHealth;
                    } else {
                        // 简单检查服务是否可用
                        healthStatus.services[serviceName] = {
                            status: 'healthy',
                            message: '服务正常运行'
                        };
                    }
                } catch (error) {
                    healthStatus.services[serviceName] = {
                        status: 'unhealthy',
                        message: error.message
                    };
                    healthStatus.overall = 'degraded';
                }
            }

            return healthStatus;

        } catch (error) {
            console.error('健康检查失败:', error);
            return {
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * 优雅关闭所有服务
     */
    async shutdown() {
        try {
            console.log('🔄 关闭服务层...');
            
            // 按逆序关闭服务（先关闭依赖方）
            const shutdownOrder = [
                'autoReplyService',
                'intentClassificationService',
                'knowledgeBaseService',
                'messageService',
                'conversationService',
                'shopService',
                'notificationService'
            ];

            for (const serviceName of shutdownOrder) {
                const service = this.services[serviceName];
                if (service && typeof service.shutdown === 'function') {
                    try {
                        await service.shutdown();
                        console.log(`✅ ${serviceName} 已关闭`);
                    } catch (error) {
                        console.error(`❌ 关闭 ${serviceName} 失败:`, error);
                    }
                }
            }

            this.services = {};
            this.initialized = false;
            
            console.log('✅ 服务层关闭完成');

        } catch (error) {
            console.error('关闭服务层失败:', error);
            throw new Error(`关闭服务层失败: ${error.message}`);
        }
    }

    /**
     * 重启服务
     * @param {string} serviceName - 要重启的服务名称
     */
    async restartService(serviceName) {
        try {
            console.log(`🔄 重启服务: ${serviceName}`);
            
            const service = this.services[serviceName];
            if (!service) {
                throw new Error(`服务不存在: ${serviceName}`);
            }

            // 关闭服务
            if (typeof service.shutdown === 'function') {
                await service.shutdown();
            }

            // 重新初始化服务
            await this.initializeSpecificService(serviceName);
            
            console.log(`✅ 服务 ${serviceName} 重启完成`);
            
            return {
                success: true,
                serviceName,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(`重启服务 ${serviceName} 失败:`, error);
            throw new Error(`重启服务失败: ${error.message}`);
        }
    }

    /**
     * 初始化特定服务
     * @private
     */
    async initializeSpecificService(serviceName) {
        // 根据服务名称重新初始化对应的服务
        switch (serviceName) {
            case 'notificationService':
                this.services.notificationService = new NotificationService(
                    this.externalServices.webSocketManager,
                    this.externalServices.emailService,
                    this.externalServices.pushService
                );
                break;
            
            case 'shopService':
                this.services.shopService = new ShopService(
                    this.repositories.shopRepository,
                    this.services.notificationService,
                    this.externalServices.apiKeyManager
                );
                break;
            
            case 'conversationService':
                this.services.conversationService = new ConversationService(
                    this.repositories.messageRepository,
                    this.repositories.shopRepository,
                    this.services.notificationService
                );
                break;
            
            case 'messageService':
                this.services.messageService = new MessageService(
                    this.repositories.messageRepository,
                    this.services.conversationService,
                    this.services.notificationService
                );
                break;
            
            // AI服务
            case 'knowledgeBaseService':
                this.services.knowledgeBaseService = new KnowledgeBaseService({
                    persistenceAdapter: this.externalServices.knowledgePersistence,
                    searchEngine: this.externalServices.searchEngine
                });
                break;
            
            case 'intentClassificationService':
                this.services.intentClassificationService = new IntentClassificationService({
                    modelProvider: this.externalServices.nlpModelProvider,
                    trainingDataManager: this.externalServices.trainingDataManager
                });
                break;
            
            case 'autoReplyService':
                this.services.autoReplyService = new AutoReplyService({
                    knowledgeBaseService: this.services.knowledgeBaseService,
                    intentClassificationService: this.services.intentClassificationService,
                    templateEngine: this.externalServices.templateEngine
                });
                break;
            
            default:
                throw new Error(`不支持重启的服务类型: ${serviceName}`);
        }
    }

    /**
     * 获取服务统计信息
     */
    getServiceStats() {
        return {
            totalServices: Object.keys(this.services).length,
            initialized: this.initialized,
            services: Object.keys(this.services),
            uptime: this.initialized ? Date.now() - this.initTime : 0,
            config: this.config
        };
    }
}

module.exports = ServiceManager;