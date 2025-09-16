/**
 * Server.js - 更新版主服务器
 * 集成新的服务层架构到主应用
 * 支持渐进式迁移和向后兼容
 */

const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 引入新的服务层
const { quickInitializeServices, ServiceIntegration } = require('./src/services');

// 引入模块化应用管理器
const ModularApp = require('./src/app/modular-app');

// 引入WebSocket路由系统
const WebSocketRouter = require('./src/websocket/WebSocketRouter');

// 引入兼容模块
const Database = require('./database-sqlite');
const DomainValidator = require('./src/security/domain-validator');

const app = express();
const PORT = 3030;

// 全局变量
let modularApp = null;
let database = null;
let domainValidator = null;
let serviceLayer = null;
let server = null;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

/**
 * 初始化服务层架构
 */
async function initializeServiceLayer() {
    console.log('🚀 正在初始化服务层架构...');
    
    try {
        // 创建仓库层实例
        const { ShopRepository, MessageAdapter } = require('./src/database/database-core');
        const messageRepository = new MessageAdapter(database);
        const shopRepository = new ShopRepository(database);
        
        // 创建外部服务
        const webSocketManager = null; // 将在后续初始化
        const emailService = null; // 可选
        
        // 准备服务层依赖
        const dependencies = {
            // 仓库层
            repositories: {
                messageRepository,
                shopRepository,
                conversationRepository: messageRepository, // 使用同一个适配器
                userRepository: shopRepository // 使用同一个适配器
            },
            
            // 外部服务
            externalServices: {
                webSocketManager,
                emailService,
                pushService: null,
                apiKeyManager: {
                    generateApiKey: () => uuidv4(),
                    validateApiKey: async (key) => ({ valid: true, key })
                },
                knowledgePersistence: null,
                searchEngine: null,
                nlpModelProvider: null,
                trainingDataManager: null,
                templateEngine: null
            },
            
            // 配置
            config: {
                enableNotifications: true,
                enableEmailNotifications: false,
                enablePushNotifications: false,
                retryAttempts: 3,
                timeoutMs: 30000,
                logLevel: 'info'
            }
        };
        
        // 初始化服务层
        serviceLayer = await quickInitializeServices(dependencies, 'production');
        
        console.log('✅ 服务层架构初始化完成');
        return serviceLayer;
        
    } catch (error) {
        console.error('❌ 服务层架构初始化失败:', error);
        throw error;
    }
}

/**
 * 初始化模块化系统（保持向后兼容）
 */
async function initializeModularSystem() {
    console.log('🚀 正在初始化模块化客服系统...');
    
    try {
        // 创建并初始化模块化应用，传入数据库实例
        modularApp = new ModularApp(database);
        
        await modularApp.initialize();
        
        console.log('✅ 模块化系统初始化完成');
        return modularApp;
        
    } catch (error) {
        console.error('❌ 模块化系统初始化失败:', error);
        throw error;
    }
}

/**
 * 初始化兼容模块
 */
async function initializeCompatibilityModules() {
    console.log('🔄 初始化兼容模块...');
    
    try {
        // 初始化数据库系统
        database = new Database();
        
        // 设置全局数据库实例
        global.database = database;
        
        // 初始化域名验证器
        domainValidator = new DomainValidator(database);
        
        console.log('✅ 兼容模块初始化完成');
        
    } catch (error) {
        console.error('❌ 兼容模块初始化失败:', error);
        throw error;
    }
}

/**
 * 应用中间件
 */
function applyMiddleware() {
    console.log('🔧 应用中间件...');
    
    // 域名验证中间件
    if (domainValidator) {
        app.use(domainValidator.createMiddleware());
    }
    
    // 服务层中间件（新）
    if (serviceLayer && serviceLayer.middleware) {
        app.use('/api', serviceLayer.middleware);
        console.log('✅ 服务层中间件已应用到 /api 路由');
    }

    // CORS支持
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id, X-Shop-Key, X-Shop-Id, X-User-Id');
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        next();
    });
    
    console.log('✅ 中间件应用完成');
}

/**
 * 初始化新的控制器路由
 */
function initializeServiceLayerRoutes() {
    console.log('🔌 初始化服务层路由...');
    
    if (!serviceLayer) {
        console.warn('⚠️ 服务层未初始化，跳过服务层路由');
        return;
    }
    
    try {
        // 创建新的消息控制器
        const MessageController = require('./src/controllers/MessageController');
        const messageControllerContext = serviceLayer.serviceFactory.createContextForController('message');
        const messageController = new MessageController(messageControllerContext);
        
        // 注册新API路由 (v2)
        const express = require('express');
        const v2Router = express.Router();
        MessageController.createRoutes(v2Router, messageController);
        app.use('/api/v2', v2Router);
        
        // 注册服务层健康检查
        app.get('/api/health/services', async (req, res) => {
            try {
                const healthStatus = await serviceLayer.serviceFactory.getHealthStatus();
                res.json(healthStatus);
            } catch (error) {
                res.status(500).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date()
                });
            }
        });
        
        // 注册服务统计端点
        app.get('/api/stats/services', (req, res) => {
            try {
                const stats = serviceLayer.serviceFactory.getServiceStats();
                res.json({
                    success: true,
                    stats
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        console.log('✅ 服务层路由初始化完成');
        console.log('📡 新API端点: /api/v2/* (服务层架构)');
        console.log('🏥 健康检查: /api/health/services');
        console.log('📊 服务统计: /api/stats/services');
        
    } catch (error) {
        console.error('❌ 服务层路由初始化失败:', error);
    }
}

/**
 * 初始化传统路由（保持向后兼容）
 */
function initializeTraditionalRoutes() {
    console.log('🔌 初始化传统路由系统...');
    
    try {
        // 引入认证路由
        require('./auth-routes')(app, database, modularApp);
        
        // 引入WebSocket集成API
        const { setupWebSocketIntegratedAPI } = require('./src/websocket/WebSocketAPI');
        setupWebSocketIntegratedAPI(app, modularApp);
        
        // 引入文件上传API
        const FileUploadAPI = require('./src/api/FileUploadAPI');
        const fileManager = null;
        const authValidator = modularApp ? modularApp.getSecurityManager() : null;
        
        const fileUploadAPI = new FileUploadAPI(fileManager, authValidator, database);
        app.use('/api/files', fileUploadAPI.getRouter());
        
        // 配置动态嵌入代码API
        const embedRoutes = require('./src/api/embed-routes');
        app.use('/embed', embedRoutes);
        
        console.log('✅ 传统路由系统初始化完成');
        console.log('📤 文件上传API: /api/files/upload');
        console.log('🌐 动态嵌入API: /embed/customer-service.js');
        
    } catch (error) {
        console.error('❌ 传统路由初始化失败:', error);
        // 不抛出错误，保持系统继续运行
    }
}

/**
 * 初始化兼容性路由
 */
function initializeCompatibilityRoutes() {
    console.log('🔗 初始化兼容性路由...');
    
    if (!serviceLayer) {
        console.warn('⚠️ 服务层未初始化，跳过兼容性路由');
        return;
    }
    
    try {
        // Express应用集成
        serviceLayer.integration.integrateWithExpress(app);
        
        console.log('✅ 兼容性路由初始化完成');
        console.log('🔄 兼容性API: /api/compat/* (兼容旧格式)');
        
    } catch (error) {
        console.error('❌ 兼容性路由初始化失败:', error);
    }
}

/**
 * 初始化静态路由
 */
function initializeStaticRoutes() {
    console.log('📄 初始化静态路由...');
    
    // 设置静态文件服务
    const { setupStaticFileServing } = require('./src/api/StaticFileService');
    setupStaticFileServing(app);
    
    // 主页
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });

    // 桌面端路由
    app.get('/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'admin-mobile.html'));
    });

    app.get('/customer', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });

    // 移动端路由
    app.get('/mobile/admin', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'admin-mobile.html'));
    });

    app.get('/mobile/customer', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'mobile-customer-enhanced.html'));
    });

    // API文档和状态页面
    app.get('/status', (req, res) => {
        const status = {
            server: 'running',
            timestamp: new Date().toISOString(),
            modules: {
                database: !!database,
                modularApp: !!modularApp,
                serviceLayer: !!serviceLayer,
                domainValidator: !!domainValidator
            },
            architecture: {
                traditional: !!modularApp,
                serviceLayer: !!serviceLayer,
                compatibility: !!(serviceLayer && modularApp)
            },
            endpoints: {
                traditional: '/api/v1/*',
                serviceLayer: '/api/v2/*',
                compatibility: '/api/compat/*',
                health: '/api/health/*',
                static: '/static/*'
            }
        };
        
        res.json(status);
    });
    
    console.log('✅ 静态路由初始化完成');
}

/**
 * 初始化WebSocket服务
 */
function initializeWebSocketService() {
    console.log('🔌 初始化WebSocket服务...');
    
    try {
        // 创建WebSocket路由器
        const webSocketRouter = new WebSocketRouter(modularApp);
        const wss = webSocketRouter.initialize(server);
        
        // 如果有服务层，集成WebSocket
        if (serviceLayer) {
            try {
                serviceLayer.integration.integrateWithWebSocket(webSocketRouter);
                console.log('✅ WebSocket已集成到服务层');
            } catch (error) {
                console.warn('⚠️ WebSocket服务层集成失败:', error);
            }
        }
        
        console.log('✅ WebSocket服务初始化完成');
        console.log('🔌 WebSocket端点: ws://localhost:' + PORT + '/ws');
        
        return wss;
        
    } catch (error) {
        console.error('❌ WebSocket服务初始化失败:', error);
        return null;
    }
}

/**
 * 启动服务器
 */
async function startServer() {
    try {
        console.log('🚀 启动QuickTalk客服系统...');
        console.log('🏗️ 架构模式: 混合架构 (传统 + 服务层)');
        
        // 1. 初始化兼容模块
        await initializeCompatibilityModules();
        
        // 2. 初始化服务层
        try {
            await initializeServiceLayer();
            console.log('✅ 服务层架构已启用');
        } catch (error) {
            console.warn('⚠️ 服务层初始化失败，使用传统模式:', error.message);
            serviceLayer = null;
        }
        
        // 3. 初始化模块化系统
        await initializeModularSystem();
        
        // 4. 应用中间件
        applyMiddleware();
        
        // 5. 初始化路由（优先使用服务层）
        if (serviceLayer) {
            initializeServiceLayerRoutes();
            initializeCompatibilityRoutes();
        }
        initializeTraditionalRoutes();
        initializeStaticRoutes();
        
        // 6. 启动HTTP服务器
        server = app.listen(PORT, () => {
            console.log('🌐 HTTP服务器启动成功');
            console.log(`📡 服务地址: http://localhost:${PORT}`);
        });
        
        // 7. 初始化WebSocket服务
        initializeWebSocketService();
        
        // 8. 设置优雅关闭
        setupGracefulShutdown();
        
        console.log('🎉 QuickTalk客服系统启动完成!');
        console.log('📊 系统状态: /status');
        console.log('🏥 健康检查: /api/health/services');
        
        if (serviceLayer) {
            console.log('🚀 服务层架构: 已启用');
            console.log('🔄 兼容性模式: 已启用');
        } else {
            console.log('🔄 传统模式: 已启用');
        }
        
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

/**
 * 设置优雅关闭
 */
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n🔄 收到 ${signal} 信号，开始优雅关闭...`);
        
        try {
            // 关闭HTTP服务器
            if (server) {
                server.close(() => {
                    console.log('✅ HTTP服务器已关闭');
                });
            }
            
            // 关闭服务层
            if (serviceLayer) {
                await serviceLayer.integration.shutdown();
                console.log('✅ 服务层已关闭');
            }
            
            // 关闭模块化应用
            if (modularApp && typeof modularApp.shutdown === 'function') {
                await modularApp.shutdown();
                console.log('✅ 模块化应用已关闭');
            }
            
            // 关闭数据库连接
            if (database && typeof database.close === 'function') {
                await database.close();
                console.log('✅ 数据库连接已关闭');
            }
            
            console.log('🎯 系统优雅关闭完成');
            process.exit(0);
            
        } catch (error) {
            console.error('❌ 优雅关闭失败:', error);
            process.exit(1);
        }
    };
    
    // 监听退出信号
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // 监听未捕获的异常
    process.on('uncaughtException', (error) => {
        console.error('💥 未捕获的异常:', error);
        shutdown('UNCAUGHT_EXCEPTION');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 未处理的Promise拒绝:', reason);
        shutdown('UNHANDLED_REJECTION');
    });
}

// 启动服务器
if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer,
    getModularApp: () => modularApp,
    getServiceLayer: () => serviceLayer,
    getDatabase: () => database
};