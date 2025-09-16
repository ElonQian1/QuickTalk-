/**
 * Services Index - 服务层统一导出
 * 提供所有服务的统一访问入口
 * 简化服务层的导入和使用
 */

// 核心业务服务
const MessageService = require('./MessageService');
const ConversationService = require('./ConversationService');
const ShopService = require('./ShopService');
const NotificationService = require('./NotificationService');

// AI智能服务
const KnowledgeBaseService = require('./KnowledgeBaseService');
const IntentClassificationService = require('./IntentClassificationService');
const AutoReplyService = require('./AutoReplyService');

// 服务管理层
const ServiceManager = require('./ServiceManager');
const { ServiceFactory, initializeGlobalServiceFactory, getGlobalServiceFactory, shutdownGlobalServiceFactory } = require('./ServiceFactory');
const ServiceIntegration = require('./ServiceIntegration');

/**
 * 服务类型枚举
 */
const ServiceTypes = {
    // 核心业务服务
    MESSAGE: 'messageService',
    CONVERSATION: 'conversationService',
    SHOP: 'shopService',
    NOTIFICATION: 'notificationService',
    
    // AI智能服务
    KNOWLEDGE_BASE: 'knowledgeBaseService',
    INTENT_CLASSIFICATION: 'intentClassificationService',
    AUTO_REPLY: 'autoReplyService'
};

/**
 * 服务配置模板
 */
const ServiceConfigs = {
    // 开发环境配置
    development: {
        enableNotifications: true,
        enableEmailNotifications: false,
        enablePushNotifications: false,
        retryAttempts: 3,
        timeoutMs: 30000,
        logLevel: 'debug'
    },
    
    // 测试环境配置
    testing: {
        enableNotifications: false,
        enableEmailNotifications: false,
        enablePushNotifications: false,
        retryAttempts: 1,
        timeoutMs: 5000,
        logLevel: 'error'
    },
    
    // 生产环境配置
    production: {
        enableNotifications: true,
        enableEmailNotifications: true,
        enablePushNotifications: true,
        retryAttempts: 5,
        timeoutMs: 60000,
        logLevel: 'info'
    }
};

/**
 * 快速服务初始化器
 * @param {Object} dependencies - 依赖项
 * @param {string} environment - 环境名称
 */
async function quickInitializeServices(dependencies, environment = 'development') {
    try {
        console.log(`🚀 快速初始化服务层 (${environment})...`);
        
        // 获取环境配置
        const config = ServiceConfigs[environment] || ServiceConfigs.development;
        
        // 创建服务集成实例
        const integration = new ServiceIntegration();
        
        // 初始化服务层
        const result = await integration.initialize({
            ...dependencies,
            config
        });
        
        console.log('✅ 服务层快速初始化完成');
        return {
            success: true,
            integration,
            serviceFactory: result.serviceFactory,
            middleware: result.middleware,
            webSocketInjector: result.webSocketInjector,
            environment,
            config
        };
        
    } catch (error) {
        console.error('❌ 服务层快速初始化失败:', error);
        throw new Error(`服务层初始化失败: ${error.message}`);
    }
}

/**
 * 创建服务访问器
 * 提供简化的服务访问接口
 */
function createServiceAccessor(serviceFactory) {
    const serviceManager = serviceFactory.getServiceManager();
    
    return {
        // 直接服务访问
        message: () => serviceManager.getService(ServiceTypes.MESSAGE),
        conversation: () => serviceManager.getService(ServiceTypes.CONVERSATION),
        shop: () => serviceManager.getService(ServiceTypes.SHOP),
        notification: () => serviceManager.getService(ServiceTypes.NOTIFICATION),
        knowledgeBase: () => serviceManager.getService(ServiceTypes.KNOWLEDGE_BASE),
        intentClassification: () => serviceManager.getService(ServiceTypes.INTENT_CLASSIFICATION),
        autoReply: () => serviceManager.getService(ServiceTypes.AUTO_REPLY),
        
        // 批量访问
        all: () => serviceManager.getAllServices(),
        business: () => ({
            message: serviceManager.getService(ServiceTypes.MESSAGE),
            conversation: serviceManager.getService(ServiceTypes.CONVERSATION),
            shop: serviceManager.getService(ServiceTypes.SHOP),
            notification: serviceManager.getService(ServiceTypes.NOTIFICATION)
        }),
        ai: () => ({
            knowledgeBase: serviceManager.getService(ServiceTypes.KNOWLEDGE_BASE),
            intentClassification: serviceManager.getService(ServiceTypes.INTENT_CLASSIFICATION),
            autoReply: serviceManager.getService(ServiceTypes.AUTO_REPLY)
        }),
        
        // 健康检查
        health: async () => serviceManager.checkHealth(),
        
        // 服务管理器访问
        manager: () => serviceManager
    };
}

/**
 * 服务层助手工具
 */
const ServiceHelpers = {
    /**
     * 验证服务依赖
     */
    validateDependencies(dependencies) {
        const required = [
            'messageRepository',
            'shopRepository',
            'webSocketManager'
        ];
        
        const missing = required.filter(dep => !dependencies[dep]);
        if (missing.length > 0) {
            throw new Error(`缺少必需依赖: ${missing.join(', ')}`);
        }
        
        return true;
    },
    
    /**
     * 创建模拟依赖（测试用）
     */
    createMockDependencies() {
        return {
            messageRepository: {
                create: async () => ({ id: 'mock-message' }),
                findByConversationId: async () => [],
                update: async () => ({ id: 'mock-message' })
            },
            shopRepository: {
                create: async () => ({ id: 'mock-shop' }),
                findById: async () => ({ id: 'mock-shop' }),
                update: async () => ({ id: 'mock-shop' })
            },
            webSocketManager: {
                emit: () => {},
                broadcast: () => {}
            },
            emailService: {
                send: async () => ({ sent: true })
            }
        };
    },
    
    /**
     * 服务性能监控
     */
    createPerformanceMonitor(serviceAccessor) {
        return {
            async measureServiceCall(serviceName, methodName, ...args) {
                const startTime = Date.now();
                try {
                    const service = serviceAccessor[serviceName]();
                    const result = await service[methodName](...args);
                    const duration = Date.now() - startTime;
                    
                    console.log(`⏱️ ${serviceName}.${methodName} 执行时间: ${duration}ms`);
                    return { result, duration };
                    
                } catch (error) {
                    const duration = Date.now() - startTime;
                    console.error(`❌ ${serviceName}.${methodName} 执行失败 (${duration}ms):`, error);
                    throw error;
                }
            }
        };
    }
};

/**
 * 导出所有服务相关模块
 */
module.exports = {
    // 核心服务类
    MessageService,
    ConversationService,
    ShopService,
    NotificationService,
    
    // AI服务类
    KnowledgeBaseService,
    IntentClassificationService,
    AutoReplyService,
    
    // 管理层类
    ServiceManager,
    ServiceFactory,
    ServiceIntegration,
    
    // 枚举和配置
    ServiceTypes,
    ServiceConfigs,
    
    // 工厂函数
    initializeGlobalServiceFactory,
    getGlobalServiceFactory,
    shutdownGlobalServiceFactory,
    quickInitializeServices,
    createServiceAccessor,
    
    // 助手工具
    ServiceHelpers,
    
    // 快捷访问
    services: {
        MessageService,
        ConversationService,
        ShopService,
        NotificationService,
        KnowledgeBaseService,
        IntentClassificationService,
        AutoReplyService
    },
    
    management: {
        ServiceManager,
        ServiceFactory,
        ServiceIntegration
    }
};