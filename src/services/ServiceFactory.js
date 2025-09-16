/**
 * ServiceFactory - 服务工厂
 * 简化服务的创建和依赖注入
 * 为控制器提供统一的服务访问接口
 */

const ServiceManager = require('./ServiceManager');

class ServiceFactory {
    constructor() {
        this.serviceManager = null;
        this.defaultRepositories = {};
        this.defaultExternalServices = {};
        this.initialized = false;
    }

    /**
     * 初始化服务工厂
     * @param {Object} dependencies - 依赖项
     */
    async initialize(dependencies = {}) {
        try {
            console.log('🏭 初始化服务工厂...');
            
            // 设置默认仓库
            this.defaultRepositories = {
                messageRepository: dependencies.messageRepository,
                shopRepository: dependencies.shopRepository,
                conversationRepository: dependencies.conversationRepository,
                userRepository: dependencies.userRepository,
                ...dependencies.repositories
            };

            // 设置默认外部服务
            this.defaultExternalServices = {
                webSocketManager: dependencies.webSocketManager,
                emailService: dependencies.emailService,
                pushService: dependencies.pushService,
                apiKeyManager: dependencies.apiKeyManager,
                knowledgePersistence: dependencies.knowledgePersistence,
                searchEngine: dependencies.searchEngine,
                nlpModelProvider: dependencies.nlpModelProvider,
                trainingDataManager: dependencies.trainingDataManager,
                templateEngine: dependencies.templateEngine,
                ...dependencies.externalServices
            };

            // 创建服务管理器
            this.serviceManager = new ServiceManager(
                this.defaultRepositories,
                this.defaultExternalServices
            );

            // 初始化服务管理器
            await this.serviceManager.initialize(dependencies.config);
            
            this.initialized = true;
            console.log('✅ 服务工厂初始化完成');
            
            return {
                success: true,
                serviceManager: this.serviceManager
            };

        } catch (error) {
            console.error('❌ 服务工厂初始化失败:', error);
            throw new Error(`服务工厂初始化失败: ${error.message}`);
        }
    }

    /**
     * 获取服务管理器
     */
    getServiceManager() {
        if (!this.initialized) {
            throw new Error('服务工厂未初始化');
        }
        return this.serviceManager;
    }

    /**
     * 创建控制器服务上下文
     * 为控制器提供所需的服务实例
     */
    createControllerContext() {
        if (!this.initialized) {
            throw new Error('服务工厂未初始化');
        }

        const services = this.serviceManager.getAllServices();
        
        return {
            // 业务服务
            messageService: services.messageService,
            conversationService: services.conversationService,
            shopService: services.shopService,
            notificationService: services.notificationService,
            
            // AI服务
            knowledgeBaseService: services.knowledgeBaseService,
            intentClassificationService: services.intentClassificationService,
            autoReplyService: services.autoReplyService,
            
            // 仓库（保持向后兼容）
            repositories: this.defaultRepositories,
            
            // 外部服务（保持向后兼容）
            externalServices: this.defaultExternalServices,
            
            // 服务管理器（用于高级操作）
            serviceManager: this.serviceManager
        };
    }

    /**
     * 为特定控制器创建定制化服务上下文
     * @param {string} controllerType - 控制器类型
     */
    createContextForController(controllerType) {
        const baseContext = this.createControllerContext();
        
        switch (controllerType) {
            case 'message':
                return {
                    messageService: baseContext.messageService,
                    conversationService: baseContext.conversationService,
                    notificationService: baseContext.notificationService,
                    autoReplyService: baseContext.autoReplyService,
                    messageRepository: this.defaultRepositories.messageRepository
                };
            
            case 'shop':
                return {
                    shopService: baseContext.shopService,
                    conversationService: baseContext.conversationService,
                    notificationService: baseContext.notificationService,
                    shopRepository: this.defaultRepositories.shopRepository
                };
            
            case 'conversation':
                return {
                    conversationService: baseContext.conversationService,
                    messageService: baseContext.messageService,
                    notificationService: baseContext.notificationService,
                    shopService: baseContext.shopService
                };
            
            case 'admin':
                return {
                    ...baseContext, // 管理员需要访问所有服务
                    isAdminContext: true
                };
            
            case 'api':
                return {
                    messageService: baseContext.messageService,
                    conversationService: baseContext.conversationService,
                    shopService: baseContext.shopService,
                    notificationService: baseContext.notificationService,
                    repositories: this.defaultRepositories
                };
            
            case 'ai':
                return {
                    knowledgeBaseService: baseContext.knowledgeBaseService,
                    intentClassificationService: baseContext.intentClassificationService,
                    autoReplyService: baseContext.autoReplyService,
                    messageService: baseContext.messageService,
                    conversationService: baseContext.conversationService
                };
            
            default:
                return baseContext;
        }
    }

    /**
     * 创建Express中间件，将服务注入到req对象
     */
    createServiceMiddleware() {
        return (req, res, next) => {
            try {
                // 注入服务上下文到请求对象
                req.services = this.createControllerContext();
                
                // 注入快捷访问方法
                req.getService = (serviceName) => {
                    return this.serviceManager.getService(serviceName);
                };
                
                // 注入控制器特定上下文创建方法
                req.createContextFor = (controllerType) => {
                    return this.createContextForController(controllerType);
                };
                
                next();
            } catch (error) {
                console.error('服务中间件错误:', error);
                res.status(500).json({
                    success: false,
                    error: '服务层不可用',
                    details: error.message
                });
            }
        };
    }

    /**
     * 创建WebSocket服务注入器
     */
    createWebSocketServiceInjector() {
        return (socket) => {
            try {
                // 注入服务到socket对象
                socket.services = this.createControllerContext();
                
                // 注入快捷方法
                socket.getService = (serviceName) => {
                    return this.serviceManager.getService(serviceName);
                };
                
                console.log(`WebSocket服务已注入到连接 ${socket.id}`);
                
            } catch (error) {
                console.error('WebSocket服务注入失败:', error);
                socket.emit('error', {
                    type: 'service_injection_failed',
                    message: '服务层不可用',
                    details: error.message
                });
            }
        };
    }

    /**
     * 获取服务健康状态
     */
    async getHealthStatus() {
        if (!this.initialized) {
            return {
                status: 'unhealthy',
                message: '服务工厂未初始化'
            };
        }

        try {
            const serviceHealth = await this.serviceManager.checkHealth();
            return {
                status: serviceHealth.overall,
                factory: {
                    initialized: this.initialized,
                    repositoriesCount: Object.keys(this.defaultRepositories).length,
                    externalServicesCount: Object.keys(this.defaultExternalServices).length
                },
                services: serviceHealth
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: '健康检查失败',
                error: error.message
            };
        }
    }

    /**
     * 优雅关闭服务工厂
     */
    async shutdown() {
        try {
            console.log('🔄 关闭服务工厂...');
            
            if (this.serviceManager) {
                await this.serviceManager.shutdown();
            }
            
            this.serviceManager = null;
            this.defaultRepositories = {};
            this.defaultExternalServices = {};
            this.initialized = false;
            
            console.log('✅ 服务工厂关闭完成');
            
        } catch (error) {
            console.error('关闭服务工厂失败:', error);
            throw new Error(`关闭服务工厂失败: ${error.message}`);
        }
    }

    /**
     * 创建单例服务工厂
     */
    static createSingleton() {
        if (!ServiceFactory.instance) {
            ServiceFactory.instance = new ServiceFactory();
        }
        return ServiceFactory.instance;
    }

    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!ServiceFactory.instance) {
            throw new Error('服务工厂单例未创建，请先调用 createSingleton()');
        }
        return ServiceFactory.instance;
    }
}

// 全局单例访问
let globalServiceFactory = null;

/**
 * 初始化全局服务工厂
 * @param {Object} dependencies - 依赖项
 */
async function initializeGlobalServiceFactory(dependencies) {
    if (globalServiceFactory) {
        console.warn('全局服务工厂已初始化，跳过重复初始化');
        return globalServiceFactory;
    }

    globalServiceFactory = new ServiceFactory();
    await globalServiceFactory.initialize(dependencies);
    
    return globalServiceFactory;
}

/**
 * 获取全局服务工厂
 */
function getGlobalServiceFactory() {
    if (!globalServiceFactory) {
        throw new Error('全局服务工厂未初始化，请先调用 initializeGlobalServiceFactory()');
    }
    return globalServiceFactory;
}

/**
 * 关闭全局服务工厂
 */
async function shutdownGlobalServiceFactory() {
    if (globalServiceFactory) {
        await globalServiceFactory.shutdown();
        globalServiceFactory = null;
    }
}

module.exports = {
    ServiceFactory,
    initializeGlobalServiceFactory,
    getGlobalServiceFactory,
    shutdownGlobalServiceFactory
};