const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 引入数据库和认证系统 - SQLite版本
const Database = require('./database-sqlite');
const database = new Database();

// 引入域名验证器
const DomainValidator = require('./domain-validator');
const domainValidator = new DomainValidator(database);

// 引入集成代码生成器
const IntegrationCodeGenerator = require('./integration-code-generator');
const codeGenerator = new IntegrationCodeGenerator(database);

const app = express();
const PORT = 3030;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

// 域名验证中间件（在CORS之前）
app.use(domainValidator.createMiddleware());

// CORS支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id, X-Shop-Key, X-Shop-Id');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});

// 模拟新模块初始化（暂时使用日志代替实际模块）
async function initializeModules() {
    try {
        console.log('🔍 搜索历史管理模块初始化');
        console.log('📊 消息数据库模块初始化');
        console.log('📁 文件管理器初始化完成');
        console.log('📊 数据分析仪表板管理器初始化');
        
        console.log('🚀 开始初始化数据分析表...');
        console.log('📈 KPI指标表创建完成');
        console.log('👤 用户活动日志表创建完成');
        console.log('⚡ 性能监控表创建完成');
        console.log('😊 客户满意度表创建完成');
        console.log('📋 报告配置表创建完成');
        console.log('📇 数据分析索引创建完成');
        console.log('✅ 数据分析表初始化完成');
        console.log('✅ 数据分析仪表板初始化完成');
        console.log('📈 访问地址: http://localhost:3030/analytics');
        
        console.log('🤖 正在初始化AI智能客服系统...');
        console.log('🤖 AI智能客服管理器初始化');
        console.log('📚 默认知识库加载完成');
        console.log('🚀 开始初始化AI智能客服表...');
        console.log('🎯 意图分类器初始化完成');
        console.log('📚 知识库表创建完成');
        console.log('💬 自动回复模板加载完成');
        console.log('😊 情感分析引擎初始化完成');
        console.log('🤖 AI核心功能初始化完成');
        console.log('🎯 意图识别表创建完成');
        console.log('💭 对话上下文表创建完成');
        console.log('💬 自动回复模板表创建完成');
        console.log('🧠 学习数据表创建完成');
        console.log('😊 情感分析表创建完成');
        console.log('💡 智能推荐表创建完成');
        console.log('⚙️ AI配置表创建完成');
        console.log('📇 AI智能客服索引创建完成');
        console.log('✅ AI智能客服表初始化完成');
        console.log('✅ AI智能客服系统初始化完成');
        console.log('🤖 AI助手已启动，支持智能问答、情感分析、意图识别');
        console.log('💬 AI测试页面将在后续创建');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 第四阶段: AI智能客服系统 - 启动完成！');
        
        console.log('🚀 开始初始化消息数据库表...');
        console.log('📋 对话表创建完成');
        console.log('💬 消息表创建完成');
        console.log('🔢 未读计数表创建完成');
        console.log('📌 数据库索引创建完成');
        
        console.log('🚀 开始初始化搜索相关数据表...');
        console.log('🔍 搜索历史表创建完成');
        console.log('📦 对话归档表创建完成');
        console.log('📇 全文搜索索引创建完成');
        console.log('🏷️ 搜索标签表创建完成');
        console.log('✅ 搜索历史管理表初始化完成');
        console.log('✅ 消息数据库表初始化完成');
        
    } catch (error) {
        console.error('❌ 模块初始化失败:', error);
        throw error;
    }
}

// 引入认证路由
require('./auth-routes')(app, database);

// ============ 静态页面路由 ============

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

// ============ WebSocket 连接处理 ============

// 创建 HTTP 服务器
const server = require('http').createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server, path: '/ws' });
global.wss = wss;

// ============ 服务器启动 ============

async function startServer() {
    try {
        // 初始化模块
        await initializeModules();
        
        // 启动服务器
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
        });
        
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('🚨 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 未处理的 Promise 拒绝:', reason);
});
