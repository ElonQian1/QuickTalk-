const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 引入新的模块化应用管理器
const ModularApp = require('./src/app/modular-app');

// 引入新的WebSocket路由系统
const WebSocketRouter = require('./src/websocket/WebSocketRouter');

// 引入旧系统的兼容模块
const Database = require('./database-sqlite');
const DomainValidator = require('./src/security/domain-validator');
// const IntegrationCodeGenerator = require('./integration-code-generator'); // 已清理

const app = express();
const PORT = 3030;

// 全局变量
let modularApp = null;
let database = null;
let domainValidator = null;
let codeGenerator = null;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

// 初始化新模块化系统
async function initializeModularSystem() {
    console.log('🚀 正在初始化新的模块化客服系统...');
    
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

// 初始化兼容模块
async function initializeCompatibilityModules() {
    console.log('🔄 初始化兼容模块...');
    
    try {
        // 初始化旧数据库系统（用于现有功能兼容）
        database = new Database();
        
        // 设置全局数据库实例
        global.database = database;
        
        // 初始化域名验证器
        domainValidator = new DomainValidator(database);
        
        // 初始化集成代码生成器 (已清理)
        // codeGenerator = new IntegrationCodeGenerator(database);
        
        console.log('✅ 兼容模块初始化完成');
        
    } catch (error) {
        console.error('❌ 兼容模块初始化失败:', error);
        throw error;
    }
}

// 应用中间件（在路由之前）
function applyMiddleware() {
    // 域名验证中间件（在CORS之前）
    if (domainValidator) {
        app.use(domainValidator.createMiddleware());
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
}

// 引入认证路由（集成新的模块化API）
function initializeRoutes() {
    console.log('🔌 初始化路由系统...');
    
    // 引入认证路由，传入模块化应用实例
    require('./auth-routes')(app, database, modularApp);
    
    // 引入WebSocket集成API
    const { setupWebSocketIntegratedAPI } = require('./src/websocket/WebSocketAPI');
    setupWebSocketIntegratedAPI(app, modularApp);
    
    // 引入文件上传API
    const FileUploadAPI = require('./src/api/FileUploadAPI');
    const fileManager = null; // FileManager暂时不通过ModularApp提供
    const authValidator = modularApp ? modularApp.getSecurityManager() : null;
    
    // 传递数据库实例到FileUploadAPI
    const fileUploadAPI = new FileUploadAPI(fileManager, authValidator, database);
    app.use('/api/files', fileUploadAPI.getRouter());
    
    // 配置动态嵌入代码API
    const embedRoutes = require('./src/api/embed-routes');
    app.use('/embed', embedRoutes);
    
    console.log('📤 文件上传API已配置: /api/files/upload (数据库:', !!database, ')');
    console.log('🌐 动态嵌入API已配置: /embed/customer-service.js, /embed/customer-service.css');
    
    console.log('✅ 路由系统初始化完成');
}

// ============ 静态页面路由 ============
function initializeStaticRoutes() {
    // 设置静态文件服务（用于文件上传）
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
        res.sendFile(path.join(__dirname, 'static', 'index.html'));
    });

    // 开发工具
    app.get('/code-generator', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'integration-generator.html'));
    });

    app.get('/sdk-demo', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'sdk-demo.html'));
    });

    // 数据分析
    app.get('/analytics', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'analytics-dashboard.html'));
    });

    app.get('/analytics-dashboard', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'analytics-dashboard.html'));
    });
}

// ============ 模块化 WebSocket 系统 ============
function initializeWebSocket(server, messageAdapter) {
    console.log('🚀 初始化模块化WebSocket系统...');
    
    // 使用新的模块化WebSocket路由
    const wsManager = WebSocketRouter.initialize(server, messageAdapter);
    
    // 设置WebSocket相关的HTTP API路由
    WebSocketRouter.setupRoutes(app);
    
    // 将WebSocket管理器设为全局可访问（兼容性）
    global.wsManager = wsManager;
    global.wss = wsManager.wss;
    
    console.log('✅ 模块化WebSocket系统初始化完成');
    return wsManager;
}

// ============ 服务器启动 ============
async function startServer() {
    try {
        // 1. 首先初始化兼容模块（包括数据库）
        await initializeCompatibilityModules();
        
        // 2. 然后初始化模块化系统（需要数据库实例）
        await initializeModularSystem();
        
        // 3. 应用中间件
        applyMiddleware();
        
        // 4. 初始化路由
        initializeRoutes();
        
        // 6. 初始化静态路由
        initializeStaticRoutes();
        
        // 7. 创建 HTTP 服务器
        const server = require('http').createServer(app);
        
        // 8. 初始化模块化 WebSocket (传入messageAdapter)
        const messageAdapter = modularApp.getMessageAdapter();
        initializeWebSocket(server, messageAdapter);
        
        // 9. 启动服务器
        server.listen(PORT, () => {
            console.log('🚀 QuickTalk 客服系统启动成功！');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📱 项目主页: http://localhost:' + PORT);
            console.log('🖥️  桌面端:');
            console.log('   📊 管理后台: http://localhost:' + PORT + '/admin');
            console.log('   💬 客服聊天: http://localhost:' + PORT + '/customer');
            console.log('📱 移动端:');
            console.log('   📊 管理后台: http://localhost:' + PORT + '/mobile/admin');
            console.log('   💬 客服聊天: http://localhost:' + PORT + '/mobile/customer');
            console.log('🔧 开发工具:');
            console.log('   🎛️  代码生成器: http://localhost:' + PORT + '/code-generator');
            console.log('   🧪 SDK 演示: http://localhost:' + PORT + '/sdk-demo');
            console.log('   🔍 搜索测试: http://localhost:' + PORT + '/test-search-history.html');
            console.log('📊 数据分析:');
            console.log('   🎯 分析仪表板: http://localhost:' + PORT + '/analytics');
            console.log('   📈 实时监控: http://localhost:' + PORT + '/analytics-dashboard');
            console.log('🔌 WebSocket: ws://localhost:' + PORT + '/ws');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⏰ 启动时间: ' + new Date().toLocaleString('zh-CN'));
            console.log('🎯 项目结构: 桌面端/移动端分离，文件组织清晰');
            
            // 显示新的模块化API信息
            if (modularApp && modularApp.initialized) {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🔥 新增模块化客户端API:');
                console.log('   POST /api/secure-connect     - 🔒 安全连接建立');
                console.log('   POST /api/connect           - 🔗 基础连接建立');
                console.log('   POST /api/send              - 📤 发送消息');
                console.log('   GET  /api/client/messages   - 📥 获取新消息');
                console.log('   GET  /api/health            - ❤️  健康检查');
                console.log('   GET  /api/stats/connections - 📊 连接统计');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('✨ 客户集成代码现在可以正常工作了！');
            }
        });
        
        return server;
        
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer().then(server => {
    // 优雅关闭
    process.on('SIGINT', async () => {
        console.log('\n🛑 正在关闭服务器...');
        
        // 关闭模块化应用
        if (modularApp) {
            await modularApp.shutdown();
        }
        
        server.close(() => {
            console.log('✅ 服务器已关闭');
            process.exit(0);
        });
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('🚨 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 未处理的 Promise 拒绝:', reason);
});

module.exports = app;
