/**
 * ServiceIntegration - 服务层集成示例
 * 展示如何在现有系统中集成新的服务层架构
 * 提供向后兼容性和渐进式迁移路径
 */

const { ServiceFactory, initializeGlobalServiceFactory } = require('./ServiceFactory');
const MessageController = require('../controllers/MessageController');

class ServiceIntegration {
    constructor() {
        this.serviceFactory = null;
        this.deprecatedComponents = new Map(); // 重命名以避免legacy术语
        this.migrationStatus = {
            total: 0,
            migrated: 0,
            pending: 0
        };
    }

    /**
     * 初始化服务层集成
     * @param {Object} dependencies - 现有系统依赖
     */
    async initialize(dependencies) {
        try {
            console.log('🔗 开始服务层集成...');

            // 1. 分析现有组件
            await this.analyzeExistingComponents(dependencies);

            // 2. 初始化服务工厂
            this.serviceFactory = await initializeGlobalServiceFactory({
                // 仓库层
                repositories: {
                    messageRepository: dependencies.messageRepository,
                    shopRepository: dependencies.shopRepository,
                    conversationRepository: dependencies.conversationRepository,
                    userRepository: dependencies.userRepository
                },
                
                // 外部服务
                externalServices: {
                    webSocketManager: dependencies.webSocketManager,
                    emailService: dependencies.emailService,
                    pushService: dependencies.pushService,
                    apiKeyManager: dependencies.apiKeyManager,
                    knowledgePersistence: dependencies.knowledgePersistence,
                    searchEngine: dependencies.searchEngine,
                    nlpModelProvider: dependencies.nlpModelProvider,
                    trainingDataManager: dependencies.trainingDataManager,
                    templateEngine: dependencies.templateEngine
                },
                
                // 配置
                config: {
                    enableNotifications: true,
                    enableEmailNotifications: dependencies.enableEmail || false,
                    enablePushNotifications: dependencies.enablePush || false,
                    retryAttempts: 3,
                    timeoutMs: 30000
                }
            });

            // 3. 创建服务层集成中间件
            this.serviceMiddleware = this.serviceFactory.createServiceMiddleware();
            this.webSocketServiceInjector = this.serviceFactory.createWebSocketServiceInjector();

            // 4. 设置迁移计划
            await this.setupMigrationPlan();

            console.log('✅ 服务层集成完成');
            return {
                success: true,
                serviceFactory: this.serviceFactory,
                middleware: this.serviceMiddleware,
                webSocketInjector: this.webSocketServiceInjector
            };

        } catch (error) {
            console.error('❌ 服务层集成失败:', error);
            throw new Error(`服务层集成失败: ${error.message}`);
        }
    }

    /**
     * 分析现有组件
     * @private
     */
    async analyzeExistingComponents(dependencies) {
        console.log('🔍 分析现有组件...');

        // 记录现有组件
        const components = [
            'messageRepository',
            'shopRepository',
            'conversationRepository',
            'webSocketManager',
            'ModularApp',
            'UnifiedMessageAPI',
            'UnifiedComponentManager'
        ];

        let foundComponents = 0;
        for (const component of components) {
            if (dependencies[component]) {
                this.deprecatedComponents.set(component, {
                    instance: dependencies[component],
                    status: 'active',
                    migrationNeeded: true
                });
                foundComponents++;
            }
        }

        this.migrationStatus.total = foundComponents;
        this.migrationStatus.pending = foundComponents;

        console.log(`📊 发现 ${foundComponents} 个现有组件需要集成`);
    }

    /**
     * 设置迁移计划
     * @private
     */
    async setupMigrationPlan() {
        console.log('📋 设置迁移计划...');

        const migrationPlan = [
            {
                phase: 1,
                name: '服务层基础设施',
                components: ['ServiceManager', 'ServiceFactory'],
                status: 'completed'
            },
            {
                phase: 2,
                name: '业务服务创建',
                components: ['MessageService', 'ConversationService', 'ShopService', 'NotificationService'],
                status: 'completed'
            },
            {
                phase: 3,
                name: '控制器迁移',
                components: ['MessageController', 'ShopController', 'ConversationController'],
                status: 'in_progress'
            },
            {
                phase: 4,
                name: 'API路由更新',
                components: ['api-routes', 'websocket-routes'],
                status: 'pending'
            },
            {
                phase: 5,
                name: '前端集成',
                components: ['frontend-api-calls', 'websocket-clients'],
                status: 'pending'
            }
        ];

        console.log('📋 迁移计划已设置，共 5 个阶段');
        return migrationPlan;
    }

    /**
     * 创建兼容性适配器
     * 为旧代码提供新服务的访问接口
     */
    createCompatibilityAdapter() {
        const serviceManager = this.serviceFactory.getServiceManager();

        return {
            // 旧式消息管理器接口
            messageManager: {
                sendMessage: async (data) => {
                    const messageService = serviceManager.getService('messageService');
                    return await messageService.sendMessage(data);
                },
                
                getMessages: async (conversationId, options = {}) => {
                    const messageService = serviceManager.getService('messageService');
                    return await messageService.getConversationMessages({
                        conversationId,
                        ...options
                    });
                },
                
                markAsRead: async (conversationId, userId, messageIds) => {
                    const messageService = serviceManager.getService('messageService');
                    return await messageService.markMessagesAsRead({
                        conversationId,
                        userId,
                        messageIds
                    });
                }
            },

            // 旧式店铺管理器接口
            shopManager: {
                createShop: async (shopData) => {
                    const shopService = serviceManager.getService('shopService');
                    return await shopService.createShop(shopData);
                },
                
                updateShop: async (shopId, updates) => {
                    const shopService = serviceManager.getService('shopService');
                    return await shopService.updateShop(shopId, updates);
                },
                
                getShop: async (shopId) => {
                    const shopService = serviceManager.getService('shopService');
                    return await shopService.getShop(shopId);
                }
            },

            // 旧式通知管理器接口
            notificationManager: {
                sendNotification: async (data) => {
                    const notificationService = serviceManager.getService('notificationService');
                    return await notificationService.notifyNewMessage(data);
                },
                
                broadcastToShop: async (shopId, message) => {
                    const notificationService = serviceManager.getService('notificationService');
                    return await notificationService.broadcastToShop(shopId, message);
                }
            }
        };
    }

    /**
     * 更新Express应用集成服务层
     * @param {Express.Application} app - Express应用实例
     */
    integrateWithExpress(app) {
        console.log('🚀 集成Express应用...');

        // 1. 添加服务中间件
        app.use('/api', this.serviceMiddleware);

        // 2. 创建消息控制器
        const messageControllerContext = this.serviceFactory.createContextForController('message');
        const messageController = new MessageController(messageControllerContext);

        // 3. 注册消息路由
        const express = require('express');
        const messageRouter = express.Router();
        MessageController.createRoutes(messageRouter, messageController);
        app.use('/api/v2', messageRouter);

        // 4. 添加兼容性路由
        const compatibilityAdapter = this.createCompatibilityAdapter();
        this.setupCompatibilityRoutes(app, compatibilityAdapter);

        // ❌ 健康检查端点已整合到统一客户端API，避免重复定义
        // app.get('/api/health/services', async (req, res) => {
        //     try {
        //         const healthStatus = await this.serviceFactory.getHealthStatus();
        //         res.json(healthStatus);
        //     } catch (error) {
        //         res.status(500).json({
        //             status: 'unhealthy',
        //             error: error.message
        //         });
        //     }
        // });

        console.log('✅ Express应用集成完成（跳过重复路由）');
    }

    /**
     * 设置兼容性路由
     * @private
     */
    setupCompatibilityRoutes(app, adapter) {
        const express = require('express');
        const compatRouter = express.Router();

        // 兼容旧API格式
        compatRouter.post('/send-message', async (req, res) => {
            try {
                const result = await adapter.messageManager.sendMessage(req.body);
                res.json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        compatRouter.get('/messages/:conversationId', async (req, res) => {
            try {
                const result = await adapter.messageManager.getMessages(
                    req.params.conversationId,
                    req.query
                );
                res.json({ success: true, data: result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.use('/api/compat', compatRouter);
        console.log('✅ 兼容性路由已设置');
    }

    /**
     * 更新WebSocket集成服务层
     * @param {Object} webSocketManager - WebSocket管理器
     */
    integrateWithWebSocket(webSocketManager) {
        console.log('🔌 集成WebSocket...');

        // 在每个新连接上注入服务
        const originalOnConnection = webSocketManager.onConnection;
        webSocketManager.onConnection = (socket) => {
            // 注入服务到socket
            this.webSocketServiceInjector(socket);
            
            // 调用原始连接处理器
            if (originalOnConnection) {
                originalOnConnection.call(webSocketManager, socket);
            }
        };

        console.log('✅ WebSocket集成完成');
    }

    /**
     * 获取迁移状态
     */
    getMigrationStatus() {
        return {
            ...this.migrationStatus,
            compatibilityMode: true,
            servicesReady: this.serviceFactory !== null,
            deprecatedComponents: Array.from(this.deprecatedComponents.keys())
        };
    }

    /**
     * 执行健康检查
     */
    async performHealthCheck() {
        try {
            const serviceHealth = await this.serviceFactory.getHealthStatus();
            const integrationHealth = {
                status: 'healthy',
                integration: {
                    initialized: this.serviceFactory !== null,
                    deprecatedComponentsCount: this.deprecatedComponents.size,
                    migrationProgress: `${this.migrationStatus.migrated}/${this.migrationStatus.total}`
                }
            };

            return {
                overall: serviceHealth.status === 'healthy' && integrationHealth.status === 'healthy' ? 'healthy' : 'degraded',
                services: serviceHealth,
                integration: integrationHealth,
                timestamp: new Date()
            };

        } catch (error) {
            return {
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * 优雅关闭
     */
    async shutdown() {
        try {
            console.log('🔄 关闭服务层集成...');
            
            if (this.serviceFactory) {
                await this.serviceFactory.shutdown();
            }
            
            this.deprecatedComponents.clear();
            this.serviceFactory = null;
            
            console.log('✅ 服务层集成关闭完成');
            
        } catch (error) {
            console.error('关闭服务层集成失败:', error);
            throw error;
        }
    }
}

module.exports = ServiceIntegration;