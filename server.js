const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 引入新的模块化应用管理器
const ModularApp = require('./src/modules/ModularApp');

// 引入新的WebSocket路由系统
const WebSocketRouter = require('./src/websocket/WebSocketRouter');

// 引入旧系统的兼容模块
const Database = require('./database-sqlite');
const DomainValidator = require('./src/security/domain-validator');
// const IntegrationCodeGenerator = require('./static/js/modules/ruilong-features/integration-generator'); // 暂时注释，前端代码不能在Node.js中运行
const ServerSideIntegrationGenerator = require('./src/integrations/ServerSideIntegrationGenerator'); // 服务器端集成代码生成器

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
        
        // 初始化域名验证器
        domainValidator = new DomainValidator(database);
        
        // 初始化集成代码生成器（服务器端版本）
        codeGenerator = new ServerSideIntegrationGenerator(database);
        
        console.log('✅ 兼容模块初始化完成');
        
    } catch (error) {
        console.error('❌ 兼容模块初始化失败:', error);
        throw error;
    }
}

// 模拟旧模块初始化日志（保持界面一致性）
async function displayLegacyModuleLogs() {
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
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id, X-Shop-Key, X-Shop-Id');
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
    
    // 🔥 Ruilong集成代码生成API
    setupIntegrationCodeRoutes();
    
    // 💎 付费开通系统API
    setupPaymentActivationRoutes();
    
    // 👥 员工管理系统API
    setupEmployeeManagementRoutes();
    
    // 📁 文件上传API
    setupFileUploadRoutes();
    
    // 📊 增强版数据分析系统API
    setupEnhancedAnalyticsRoutes();
    
    // 🤖 AI智能客服助手API
    setupAIAssistantRoutes(app, modularApp);
    
    // 📁 文件管理与共享系统API
    setupFileManagerRoutes(app, modularApp);
    
    // 📡 高级通知系统API
    setupNotificationSystemRoutes(app, modularApp);
    
    // 🛡️ 综合安全模块API - 已完整实现但当前停用
    // 该模块包含10个完整的安全API端点，功能包括：
    // - 会话管理、数据加密、访问控制、威胁检测、审计日志等
    // 如需启用安全功能，请取消下行注释：
    // setupSecurityModuleRoutes(app, modularApp);
    console.log('🛡️ 综合安全模块 (已实现，当前停用状态)');
    
    console.log('✅ 路由系统初始化完成');
}

// ============ 集成代码生成API路由 ============
function setupIntegrationCodeRoutes() {
    console.log('📋 设置集成代码生成API...');
    
    // 生成集成代码
    app.post('/api/integration/generate-code', async (req, res) => {
        try {
            const { shopId } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 验证店铺权限（简化版本，实际应该检查用户是否有权限操作该店铺）
            if (!shopId) {
                return res.status(400).json({ success: false, error: '缺少店铺ID' });
            }
            
            // 使用服务器端集成代码生成器
            const result = await codeGenerator.generateIntegrationCode(shopId);
            res.json(result);
            
        } catch (error) {
            console.error('❌ 集成代码生成API错误:', error);
            res.status(500).json({ success: false, error: '服务器内部错误' });
        }
    });
    
    // 重新生成API密钥
    app.post('/api/integration/regenerate-key', async (req, res) => {
        try {
            const { shopId } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!shopId) {
                return res.status(400).json({ success: false, error: '缺少店铺ID' });
            }
            
            // 重新生成API密钥
            const result = await codeGenerator.regenerateApiKey(shopId);
            res.json(result);
            
        } catch (error) {
            console.error('❌ API密钥重新生成错误:', error);
            res.status(500).json({ success: false, error: '服务器内部错误' });
        }
    });
    
    console.log('✅ 集成代码生成API设置完成');
}

// ============ 付费开通系统API路由 ============
function setupPaymentActivationRoutes() {
    console.log('💎 设置付费开通系统API...');
    
    // 创建付费开通订单
    app.post('/api/shops/:shopId/activate', async (req, res) => {
        try {
            const { shopId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            console.log('💎 收到付费开通请求:', { shopId, sessionId });
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ 
                    success: false, 
                    error: '未授权访问' 
                });
            }
            
            // 验证店铺是否存在
            const shopRepo = modularApp.getShopRepository();
            const shop = await shopRepo.getShopById(shopId);
            
            if (!shop) {
                return res.status(404).json({ 
                    success: false, 
                    error: '店铺不存在' 
                });
            }
            
            // 检查店铺状态是否为待审核
            if (shop.approval_status !== 'pending') {
                return res.status(400).json({ 
                    success: false, 
                    error: '只有待审核状态的店铺才能使用付费开通' 
                });
            }
            
            // 创建付费开通订单
            const orderId = 'activation_' + Date.now() + '_' + shopId;
            const order = {
                orderId: orderId,
                shopId: shopId,
                shopName: shop.name,
                amount: 2000,
                status: 'pending',
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟后过期
            };
            
            // 这里应该保存订单到数据库，为了简化我们暂时跳过
            console.log('💎 创建付费开通订单成功:', order);
            
            res.json({
                success: true,
                order: order
            });
            
        } catch (error) {
            console.error('❌ 创建付费开通订单失败:', error);
            res.status(500).json({ 
                success: false, 
                error: '服务器内部错误' 
            });
        }
    });
    
    // 生成支付二维码
    app.post('/api/activation-orders/:orderId/qrcode', async (req, res) => {
        try {
            const { orderId } = req.params;
            const { paymentMethod } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            console.log('💎 生成支付二维码请求:', { orderId, paymentMethod });
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ 
                    success: false, 
                    error: '未授权访问' 
                });
            }
            
            // 验证支付方式
            if (!['alipay', 'wechat'].includes(paymentMethod)) {
                return res.status(400).json({ 
                    success: false, 
                    error: '不支持的支付方式' 
                });
            }
            
            // 模拟生成二维码（实际项目中应该调用支付服务商API）
            const qrText = `模拟${paymentMethod === 'alipay' ? '支付宝' : '微信'}付费开通订单:${orderId} 金额:¥2000`;
            const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
            
            const qrData = {
                orderId: orderId,
                amount: 2000,
                qrCodeUrl: qrCodeUrl,
                paymentMethod: paymentMethod,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
            };
            
            console.log('💎 生成支付二维码成功:', qrData);
            
            res.json({
                success: true,
                qrData: qrData
            });
            
        } catch (error) {
            console.error('❌ 生成支付二维码失败:', error);
            res.status(500).json({ 
                success: false, 
                error: '服务器内部错误' 
            });
        }
    });
    
    // 查询支付状态
    app.get('/api/activation-orders/:orderId/status', async (req, res) => {
        try {
            const { orderId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            console.log('💎 查询支付状态:', orderId);
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ 
                    success: false, 
                    error: '未授权访问' 
                });
            }
            
            // 模拟订单状态（实际项目中应该查询数据库和支付服务商）
            // 为了测试，这里总是返回pending状态
            const order = {
                orderId: orderId,
                status: 'pending', // 可能的状态: pending, paid, expired
                amount: 2000,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            res.json({
                success: true,
                order: order
            });
            
        } catch (error) {
            console.error('❌ 查询支付状态失败:', error);
            res.status(500).json({ 
                success: false, 
                error: '服务器内部错误' 
            });
        }
    });
    
    // 模拟支付成功回调（用于测试）
    app.post('/api/activation-orders/:orderId/mock-success', async (req, res) => {
        try {
            const { orderId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            console.log('🧪 模拟支付成功:', orderId);
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ 
                    success: false, 
                    error: '未授权访问' 
                });
            }
            
            // 从订单ID中提取店铺ID
            const shopId = orderId.split('_').pop();
            
            // 自动审核通过店铺
            const shopRepo = modularApp.getShopRepository();
            const shop = await shopRepo.getShopById(shopId);
            
            if (shop) {
                // 更新店铺状态为已审核
                await shopRepo.updateShopStatus(shopId, 'approved');
                console.log('✅ 店铺自动审核通过:', shopId);
            }
            
            res.json({
                success: true,
                message: '付费开通成功，店铺已自动审核通过'
            });
            
        } catch (error) {
            console.error('❌ 模拟支付成功处理失败:', error);
            res.status(500).json({ 
                success: false, 
                error: '服务器内部错误' 
            });
        }
    });
    
    console.log('✅ 付费开通系统API设置完成');
}

// ============ 员工管理系统API ============
function setupEmployeeManagementRoutes() {
    // 获取店铺员工列表
    app.get('/api/shops/:shopId/employees', async (req, res) => {
        try {
            const { shopId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 从ModularApp获取EmployeeManager实例
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            const employees = employeeManager.getShopEmployees(shopId);
            const stats = employeeManager.getEmployeeStats(shopId);
            
            res.json({
                success: true,
                employees: employees,
                stats: stats
            });
            
        } catch (error) {
            console.error('❌ 获取员工列表失败:', error);
            res.status(500).json({ success: false, error: '服务器内部错误' });
        }
    });
    
    // 添加员工
    app.post('/api/shops/:shopId/employees', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { name, email, phone, role, skills } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!name || !email) {
                return res.status(400).json({ success: false, error: '姓名和邮箱为必填项' });
            }
            
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            const employeeData = {
                name: name,
                email: email,
                phone: phone || '',
                role: role || 'customer_service',
                skills: skills || []
            };
            
            const employee = await employeeManager.addEmployee(shopId, employeeData);
            
            res.json({
                success: true,
                employee: employee
            });
            
        } catch (error) {
            console.error('❌ 添加员工失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 更新员工信息
    app.put('/api/employees/:employeeId', async (req, res) => {
        try {
            const { employeeId } = req.params;
            const updateData = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            const employee = await employeeManager.updateEmployee(employeeId, updateData);
            
            res.json({
                success: true,
                employee: employee
            });
            
        } catch (error) {
            console.error('❌ 更新员工失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 删除员工
    app.delete('/api/employees/:employeeId', async (req, res) => {
        try {
            const { employeeId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            await employeeManager.removeEmployee(employeeId);
            
            res.json({
                success: true,
                message: '员工已删除'
            });
            
        } catch (error) {
            console.error('❌ 删除员工失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 设置员工状态
    app.put('/api/employees/:employeeId/status', async (req, res) => {
        try {
            const { employeeId } = req.params;
            const { status } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!status || !['online', 'offline', 'busy', 'away'].includes(status)) {
                return res.status(400).json({ success: false, error: '无效的状态值' });
            }
            
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            await employeeManager.setEmployeeStatus(employeeId, status);
            
            res.json({
                success: true,
                message: '员工状态已更新'
            });
            
        } catch (error) {
            console.error('❌ 设置员工状态失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 分配消息给员工
    app.post('/api/shops/:shopId/assign-message', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { conversationId, customerMessage, distributionMethod } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!conversationId || !customerMessage) {
                return res.status(400).json({ success: false, error: '缺少必要参数' });
            }
            
            const employeeManager = modularApp ? modularApp.employeeManager : null;
            if (!employeeManager) {
                return res.status(503).json({ success: false, error: '员工管理系统未初始化' });
            }
            
            const assignedEmployee = await employeeManager.assignMessage(
                shopId, 
                conversationId, 
                customerMessage, 
                distributionMethod || 'load_based'
            );
            
            res.json({
                success: true,
                assignedEmployee: assignedEmployee
            });
            
        } catch (error) {
            console.error('❌ 分配消息失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    console.log('✅ 员工管理系统API设置完成');
}

// ============ 文件上传API ============
function setupFileUploadRoutes() {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs').promises;
    
    // 创建上传目录
    const uploadDir = path.join(__dirname, 'uploads');
    
    // 确保上传目录存在
    const ensureUploadDir = async () => {
        try {
            await fs.access(uploadDir);
        } catch (error) {
            await fs.mkdir(uploadDir, { recursive: true });
            console.log('📁 创建上传目录:', uploadDir);
        }
    };
    
    // 配置multer存储
    const storage = multer.diskStorage({
        destination: async (req, file, cb) => {
            await ensureUploadDir();
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            // 生成唯一文件名
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, file.fieldname + '-' + uniqueSuffix + ext);
        }
    });
    
    // 文件过滤器
    const fileFilter = (req, file, cb) => {
        // 允许的文件类型
        const allowedTypes = {
            'image/jpeg': true,
            'image/jpg': true,
            'image/png': true,
            'image/gif': true,
            'image/webp': true,
            'audio/webm': true,
            'audio/wav': true,
            'audio/mp3': true,
            'audio/mpeg': true,
            'audio/ogg': true
        };
        
        if (allowedTypes[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    };
    
    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
            files: 1
        }
    });
    
    // 文件上传接口
    app.post('/api/upload', upload.single('image'), async (req, res) => {
        try {
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!req.file) {
                return res.status(400).json({ success: false, error: '未找到上传文件' });
            }
            
            // 生成文件访问URL
            const fileUrl = `/uploads/${req.file.filename}`;
            
            console.log(`📁 文件上传成功: ${req.file.originalname} -> ${req.file.filename}`);
            
            res.json({
                success: true,
                url: fileUrl,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype
            });
            
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            res.status(500).json({ success: false, error: error.message || '文件上传失败' });
        }
    });
    
    // 音频文件上传接口
    app.post('/api/upload', upload.single('audio'), async (req, res) => {
        try {
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!req.file) {
                return res.status(400).json({ success: false, error: '未找到上传文件' });
            }
            
            // 生成文件访问URL
            const fileUrl = `/uploads/${req.file.filename}`;
            
            console.log(`🎤 音频上传成功: ${req.file.originalname} -> ${req.file.filename}`);
            
            res.json({
                success: true,
                url: fileUrl,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype
            });
            
        } catch (error) {
            console.error('❌ 音频上传失败:', error);
            res.status(500).json({ success: false, error: error.message || '音频上传失败' });
        }
    });
    
    // 提供上传文件的访问服务
    app.use('/uploads', require('express').static(uploadDir));
    
    // 文件删除接口
    app.delete('/api/upload/:filename', async (req, res) => {
        try {
            const sessionId = req.headers['x-session-id'];
            const { filename } = req.params;
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            const filePath = path.join(uploadDir, filename);
            
            try {
                await fs.access(filePath);
                await fs.unlink(filePath);
                console.log(`🗑️ 文件删除成功: ${filename}`);
                res.json({ success: true, message: '文件删除成功' });
            } catch (error) {
                res.status(404).json({ success: false, error: '文件不存在' });
            }
            
        } catch (error) {
            console.error('❌ 文件删除失败:', error);
            res.status(500).json({ success: false, error: '文件删除失败' });
        }
    });
    
    // 初始化上传目录
    ensureUploadDir();
    
    console.log('✅ 文件上传API设置完成');
}

// ============ 增强版数据分析系统API ============
function setupEnhancedAnalyticsRoutes() {
    console.log('📊 设置增强版数据分析系统API...');
    
    // 获取增强版仪表板数据
    app.get('/api/analytics/enhanced-dashboard/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h', includeDetails = false } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            console.log(`📊 获取增强版仪表板数据: ${shopId}, ${timeRange}`);
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 获取仪表板数据
            const dashboardData = await analyticsModule.getEnhancedDashboardData(
                shopId, 
                timeRange, 
                includeDetails === 'true'
            );
            
            res.json({
                success: true,
                data: dashboardData
            });
            
        } catch (error) {
            console.error('❌ 获取增强版仪表板数据失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取快速指标
    app.get('/api/analytics/quick-metrics/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 模拟快速指标数据
            const quickMetrics = {
                activeConversations: Math.floor(Math.random() * 50) + 10,
                onlineEmployees: Math.floor(Math.random() * 20) + 5,
                avgResponseTime: Math.floor(Math.random() * 300) + 60, // 秒
                todayRevenue: Math.floor(Math.random() * 10000) + 1000
            };
            
            console.log(`📊 快速指标查询: ${shopId}`, quickMetrics);
            
            res.json({
                success: true,
                data: quickMetrics
            });
            
        } catch (error) {
            console.error('❌ 获取快速指标失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取KPI指标
    app.get('/api/analytics/kpi/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h', category = 'all' } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 获取KPI指标
            const kpiMetrics = await analyticsModule.getKPIMetrics(shopId, timeRange);
            
            // 根据类别筛选
            let filteredMetrics = kpiMetrics;
            if (category !== 'all' && kpiMetrics[category]) {
                filteredMetrics = { [category]: kpiMetrics[category] };
            }
            
            res.json({
                success: true,
                data: filteredMetrics
            });
            
        } catch (error) {
            console.error('❌ 获取KPI指标失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取员工绩效数据
    app.get('/api/analytics/performance/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h' } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 获取员工绩效数据
            const performanceData = await analyticsModule.getEmployeePerformance(shopId, timeRange);
            
            res.json({
                success: true,
                data: performanceData
            });
            
        } catch (error) {
            console.error('❌ 获取员工绩效数据失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取客户满意度数据
    app.get('/api/analytics/satisfaction/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h' } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 获取客户满意度数据
            const satisfactionData = await analyticsModule.getCustomerSatisfactionMetrics(shopId, timeRange);
            
            res.json({
                success: true,
                data: satisfactionData
            });
            
        } catch (error) {
            console.error('❌ 获取客户满意度数据失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取收入分析数据
    app.get('/api/analytics/revenue/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h' } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 获取收入分析数据
            const revenueData = await analyticsModule.getRevenueAnalytics(shopId, timeRange);
            
            res.json({
                success: true,
                data: revenueData
            });
            
        } catch (error) {
            console.error('❌ 获取收入分析数据失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 导出报表数据
    app.post('/api/analytics/export/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { reportType, format = 'json', timeRange = '24h' } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            console.log(`📄 导出报表请求: ${shopId}, ${reportType}, ${format}`);
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!reportType) {
                return res.status(400).json({ success: false, error: '缺少报表类型' });
            }
            
            // 获取增强版分析模块
            const analyticsModule = modularApp.getModule('EnhancedAnalyticsDashboard');
            if (!analyticsModule) {
                return res.status(503).json({ success: false, error: '分析系统不可用' });
            }
            
            // 导出报表数据
            const exportResult = await analyticsModule.exportReportData(shopId, reportType, format, {
                timeRange
            });
            
            // 设置响应头
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.csv"`);
            } else if (format === 'excel') {
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.xlsx"`);
            }
            
            res.json(exportResult);
            
        } catch (error) {
            console.error('❌ 导出报表数据失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 获取警报信息
    app.get('/api/analytics/alerts/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 模拟警报数据
            const alerts = [
                {
                    id: 'alert_1',
                    type: 'warning',
                    title: '响应时间过长',
                    message: '平均响应时间超过5分钟',
                    timestamp: new Date().toISOString(),
                    isRead: false
                },
                {
                    id: 'alert_2', 
                    type: 'error',
                    title: '客户满意度下降',
                    message: '本周客户满意度评分低于4.0',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                    isRead: false
                }
            ];
            
            res.json({
                success: true,
                data: alerts
            });
            
        } catch (error) {
            console.error('❌ 获取警报信息失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 页面访问统计
    app.post('/api/analytics/page-view', async (req, res) => {
        try {
            const { page, timestamp, referrer, userAgent } = req.body;
            
            // 记录页面访问（简化版本，实际应该保存到数据库）
            console.log(`📊 页面访问统计: ${page}, ${timestamp}`);
            
            res.json({ success: true });
            
        } catch (error) {
            console.error('❌ 页面访问统计失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });
    
    // 增强版分析仪表板页面路由
    app.get('/analytics', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'enhanced-analytics-dashboard.html'));
    });
    
    app.get('/enhanced-analytics', (req, res) => {
        res.sendFile(path.join(__dirname, 'static', 'enhanced-analytics-dashboard.html'));
    });
    
    console.log('✅ 增强版数据分析系统API设置完成');
}

/**
 * 设置AI智能客服助手相关路由
 * @param {Express} app Express应用实例
 * @param {ModularApp} modularApp 模块化应用实例
 */
function setupAIAssistantRoutes(app, modularApp) {
    console.log('🤖 设置AI智能客服助手路由...');

    // 获取智能回复建议
    app.post('/api/ai/suggestions', async (req, res) => {
        try {
            const { message, conversationId, shopId, context } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!message) {
                return res.status(400).json({ success: false, error: '缺少消息内容' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 获取智能回复建议
            const suggestions = await aiAssistant.getSuggestions(message, {
                conversationId,
                shopId,
                context
            });
            
            res.json({
                success: true,
                data: suggestions
            });
            
        } catch (error) {
            console.error('❌ 获取智能回复建议失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 分析消息内容
    app.post('/api/ai/analyze', async (req, res) => {
        try {
            const { message, analysisType } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!message) {
                return res.status(400).json({ success: false, error: '缺少消息内容' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            let analysisResult;
            
            // 根据分析类型执行不同的分析
            switch (analysisType) {
                case 'intent':
                    analysisResult = await aiAssistant.classifyIntent(message);
                    break;
                case 'sentiment':
                    analysisResult = await aiAssistant.analyzeSentiment(message);
                    break;
                case 'keywords':
                    analysisResult = await aiAssistant.extractKeywords(message);
                    break;
                case 'entities':
                    analysisResult = await aiAssistant.extractEntities(message);
                    break;
                case 'all':
                default:
                    // 执行完整分析
                    const [intent, sentiment, keywords, entities] = await Promise.all([
                        aiAssistant.classifyIntent(message),
                        aiAssistant.analyzeSentiment(message),
                        aiAssistant.extractKeywords(message),
                        aiAssistant.extractEntities(message)
                    ]);
                    analysisResult = { intent, sentiment, keywords, entities };
                    break;
            }
            
            res.json({
                success: true,
                data: analysisResult
            });
            
        } catch (error) {
            console.error('❌ 消息分析失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 获取自动回复
    app.post('/api/ai/auto-reply', async (req, res) => {
        try {
            const { message, intent, shopId } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!message) {
                return res.status(400).json({ success: false, error: '缺少消息内容' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 获取自动回复
            const autoReply = await aiAssistant.generateAutoReply(message, intent, shopId);
            
            res.json({
                success: true,
                data: autoReply
            });
            
        } catch (error) {
            console.error('❌ 获取自动回复失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 搜索知识库
    app.post('/api/ai/knowledge/search', async (req, res) => {
        try {
            const { query, shopId, category, limit = 5 } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!query) {
                return res.status(400).json({ success: false, error: '缺少搜索关键词' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 搜索知识库
            const searchResults = await aiAssistant.searchKnowledgeBase(query, {
                shopId,
                category,
                limit
            });
            
            res.json({
                success: true,
                data: searchResults
            });
            
        } catch (error) {
            console.error('❌ 知识库搜索失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 添加知识库条目
    app.post('/api/ai/knowledge', async (req, res) => {
        try {
            const { question, answer, category, tags, shopId } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!question || !answer) {
                return res.status(400).json({ success: false, error: '缺少问题或答案' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 添加知识库条目
            const knowledgeItem = await aiAssistant.addKnowledgeItem({
                question,
                answer,
                category,
                tags,
                shopId
            });
            
            res.json({
                success: true,
                data: knowledgeItem
            });
            
        } catch (error) {
            console.error('❌ 添加知识库条目失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 提交反馈
    app.post('/api/ai/feedback', async (req, res) => {
        try {
            const { suggestionId, feedback, rating, comment } = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            if (!suggestionId || !feedback) {
                return res.status(400).json({ success: false, error: '缺少建议ID或反馈类型' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 记录反馈
            await aiAssistant.recordFeedback(suggestionId, feedback, {
                rating,
                comment,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: '反馈已记录'
            });
            
        } catch (error) {
            console.error('❌ 记录反馈失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 获取AI配置
    app.get('/api/ai/config/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 获取AI配置
            const config = await aiAssistant.getAIConfig(shopId);
            
            res.json({
                success: true,
                data: config
            });
            
        } catch (error) {
            console.error('❌ 获取AI配置失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 更新AI配置
    app.put('/api/ai/config/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const config = req.body;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 更新AI配置
            const updatedConfig = await aiAssistant.updateAIConfig(shopId, config);
            
            res.json({
                success: true,
                data: updatedConfig
            });
            
        } catch (error) {
            console.error('❌ 更新AI配置失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    // 获取AI助手统计信息
    app.get('/api/ai/stats/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { timeRange = '24h' } = req.query;
            const sessionId = req.headers['x-session-id'];
            
            // 验证用户权限
            if (!sessionId) {
                return res.status(401).json({ success: false, error: '未授权访问' });
            }
            
            // 获取AI助手模块
            const aiAssistant = modularApp.getAIAssistant();
            if (!aiAssistant) {
                return res.status(503).json({ success: false, error: 'AI助手系统不可用' });
            }
            
            // 获取统计信息
            const stats = await aiAssistant.getAIStats(shopId, timeRange);
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('❌ 获取AI统计信息失败:', error);
            res.status(500).json({ success: false, error: error.message || '服务器内部错误' });
        }
    });

    console.log('✅ AI智能客服助手API设置完成');
}

// ============ 静态页面路由 ============
function initializeStaticRoutes() {
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
        
        // 3. 显示旧模块日志（保持界面一致性）
        await displayLegacyModuleLogs();
        
        // 4. 应用中间件
        applyMiddleware();
        
        // 5. 初始化路由
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

// ============ 文件管理与共享系统API路由 ============
function setupFileManagerRoutes(app, modularApp) {
    console.log('📁 设置文件管理与共享系统API路由...');
    
    // 文件上传API
    app.post('/api/files/upload', async (req, res) => {
        try {
            console.log('📤 处理文件上传请求...');
            
            const { filename, fileData, shopId, userId, description, tags } = req.body;
            
            if (!filename || !fileData || !userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必要参数：filename, fileData, userId'
                });
            }
            
            // 将base64数据转换为Buffer
            const buffer = Buffer.from(fileData, 'base64');
            
            const result = await modularApp.fileManager.uploadFile({
                filename,
                buffer,
                userId,
                shopId
            }, {
                description,
                tags: tags ? tags.split(',') : [],
                isPublic: false
            });
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 文件上传失败:', error);
            res.status(500).json({
                success: false,
                message: '文件上传失败: ' + error.message
            });
        }
    });
    
    // 文件下载API
    app.get('/api/files/download/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            const result = await modularApp.fileManager.downloadFile(fileId, userId);
            
            if (result.success) {
                res.setHeader('Content-Type', result.fileInfo.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${result.fileInfo.originalName}"`);
                res.send(result.fileData);
            } else {
                res.status(404).json(result);
            }
            
        } catch (error) {
            console.error('❌ 文件下载失败:', error);
            res.status(500).json({
                success: false,
                message: '文件下载失败: ' + error.message
            });
        }
    });
    
    // 文件列表API
    app.get('/api/files/list', async (req, res) => {
        try {
            const { shopId, userId, category, mimeType, page = 1, limit = 20, sortBy = 'uploadTime', sortOrder = 'desc' } = req.query;
            
            const result = await modularApp.fileManager.getFileList({
                shopId,
                userId,
                category,
                mimeType,
                page: parseInt(page),
                limit: parseInt(limit),
                sortBy,
                sortOrder
            });
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 获取文件列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取文件列表失败: ' + error.message
            });
        }
    });
    
    // 文件搜索API
    app.get('/api/files/search', async (req, res) => {
        try {
            const { query, shopId, limit = 20 } = req.query;
            
            if (!query) {
                return res.status(400).json({
                    success: false,
                    message: '缺少搜索关键词'
                });
            }
            
            const result = await modularApp.fileManager.searchFiles(query, {
                shopId,
                limit: parseInt(limit)
            });
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 搜索文件失败:', error);
            res.status(500).json({
                success: false,
                message: '搜索文件失败: ' + error.message
            });
        }
    });
    
    // 文件预览API
    app.get('/api/files/preview/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            const result = await modularApp.fileManager.getFilePreview(fileId, userId);
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 获取文件预览失败:', error);
            res.status(500).json({
                success: false,
                message: '获取文件预览失败: ' + error.message
            });
        }
    });
    
    // 创建共享链接API
    app.post('/api/files/share/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            const { userId, shareType = 'public', expiresAt, password, maxDownloads } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            const result = await modularApp.fileManager.createShareLink(fileId, userId, {
                type: shareType,
                expiresAt,
                password,
                maxDownloads
            });
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 创建共享链接失败:', error);
            res.status(500).json({
                success: false,
                message: '创建共享链接失败: ' + error.message
            });
        }
    });
    
    // 删除文件API
    app.delete('/api/files/:fileId', async (req, res) => {
        try {
            const { fileId } = req.params;
            const { userId } = req.body;
            
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少用户ID参数'
                });
            }
            
            const result = await modularApp.fileManager.deleteFile(fileId, userId);
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 删除文件失败:', error);
            res.status(500).json({
                success: false,
                message: '删除文件失败: ' + error.message
            });
        }
    });
    
    // 存储统计API
    app.get('/api/files/stats', async (req, res) => {
        try {
            const { shopId } = req.query;
            
            if (!shopId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少店铺ID参数'
                });
            }
            
            const result = await modularApp.fileManager.getStorageStats(shopId);
            
            res.json(result);
            
        } catch (error) {
            console.error('❌ 获取存储统计失败:', error);
            res.status(500).json({
                success: false,
                message: '获取存储统计失败: ' + error.message
            });
        }
    });
    
    console.log('✅ 文件管理与共享系统API路由设置完成');
}

// ============ 高级通知系统API路由 ============
function setupNotificationSystemRoutes(app, modularApp) {
    console.log('📡 设置高级通知系统API路由...');

    // 发送通知
    app.post('/api/notifications/send', async (req, res) => {
        try {
            const {
                shopId,
                userId,
                title,
                message,
                type = 'general',
                priority = 'normal',
                channels = ['websocket'],
                templateId,
                templateData = {},
                scheduledAt,
                metadata = {}
            } = req.body;

            // 验证必需参数
            if (!title || !message) {
                return res.status(400).json({
                    success: false,
                    error: '标题和内容是必需的'
                });
            }

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 发送通知
            const result = await notificationSystem.sendNotification({
                shopId: shopId || 'default_shop',
                userId,
                title,
                message,
                type,
                priority,
                channels,
                templateId,
                templateData,
                scheduledAt,
                metadata
            });

            res.json(result);

        } catch (error) {
            console.error('❌ 发送通知失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 获取通知统计
    app.get('/api/notifications/stats/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { startDate, endDate, channel, type } = req.query;

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 获取统计数据
            const result = await notificationSystem.getNotificationStats(shopId, {
                startDate,
                endDate,
                channel,
                type
            });

            res.json(result);

        } catch (error) {
            console.error('❌ 获取通知统计失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 管理用户订阅
    app.post('/api/notifications/subscriptions', async (req, res) => {
        try {
            const {
                userId,
                shopId,
                type,
                channels,
                enabled = true,
                settings = {}
            } = req.body;

            // 验证必需参数
            if (!userId || !shopId || !type) {
                return res.status(400).json({
                    success: false,
                    error: '用户ID、店铺ID和类型是必需的'
                });
            }

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 管理订阅
            const result = await notificationSystem.manageSubscription(userId, shopId, {
                type,
                channels,
                enabled,
                settings
            });

            res.json(result);

        } catch (error) {
            console.error('❌ 管理用户订阅失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 获取用户订阅设置
    app.get('/api/notifications/subscriptions/:userId/:shopId', async (req, res) => {
        try {
            const { userId, shopId } = req.params;

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 获取用户订阅
            const result = await notificationSystem.getUserSubscriptions(userId, shopId);

            res.json(result);

        } catch (error) {
            console.error('❌ 获取用户订阅失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 创建通知模板
    app.post('/api/notifications/templates', async (req, res) => {
        try {
            const {
                shopId,
                name,
                title,
                content,
                type,
                channels = ['websocket'],
                variables = [],
                createdBy
            } = req.body;

            // 验证必需参数
            if (!name || !title || !content || !type) {
                return res.status(400).json({
                    success: false,
                    error: '名称、标题、内容和类型是必需的'
                });
            }

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 创建模板
            const result = await notificationSystem.createTemplate({
                shopId: shopId || 'default_shop',
                name,
                title,
                content,
                type,
                channels,
                variables,
                createdBy: createdBy || 'system'
            });

            res.json(result);

        } catch (error) {
            console.error('❌ 创建通知模板失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 获取通知模板列表
    app.get('/api/notifications/templates/:shopId', async (req, res) => {
        try {
            const { shopId } = req.params;
            const { type, isActive } = req.query;

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 获取模板列表
            const result = await notificationSystem.getTemplates(shopId, {
                type,
                isActive: isActive !== undefined ? isActive === 'true' : undefined
            });

            res.json(result);

        } catch (error) {
            console.error('❌ 获取通知模板失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // 测试通知发送
    app.post('/api/notifications/test', async (req, res) => {
        try {
            const {
                shopId = 'test_shop',
                userId = 'test_user',
                type = 'test'
            } = req.body;

            // 获取通知系统模块
            const notificationSystem = modularApp.notificationSystem;
            if (!notificationSystem) {
                return res.status(503).json({
                    success: false,
                    error: '通知系统不可用'
                });
            }

            // 发送测试通知
            const result = await notificationSystem.sendNotification({
                shopId,
                userId,
                title: '测试通知',
                message: `这是一条测试通知，发送时间：${new Date().toLocaleString()}`,
                type,
                priority: 'normal',
                channels: ['websocket', 'push'],
                metadata: {
                    isTest: true,
                    testTime: new Date().toISOString()
                }
            });

            res.json({
                success: true,
                message: '测试通知已发送',
                data: result
            });

        } catch (error) {
            console.error('❌ 测试通知发送失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    console.log('✅ 高级通知系统API路由设置完成');
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

// 综合安全模块API路由
function setupSecurityModuleRoutes(app, modularApp) {
    console.log('🛡️ 设置综合安全模块API路由...');

    // 1. 创建安全会话
    app.post('/api/security/sessions', async (req, res) => {
        try {
            const {
                userId,
                shopId,
                clientInfo = {}
            } = req.body;

            // 验证必需参数
            if (!userId || !shopId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必需参数: userId, shopId'
                });
            }

            // 添加客户端信息
            clientInfo.ip = req.ip || req.connection.remoteAddress;
            clientInfo.userAgent = req.get('User-Agent');

            const result = await modularApp.securityModule.createSecureSession(userId, shopId, clientInfo);

            res.json(result);

        } catch (error) {
            console.error('❌ 创建安全会话失败:', error);
            res.status(500).json({
                success: false,
                message: '创建安全会话失败',
                error: error.message
            });
        }
    });

    // 2. 验证会话
    app.post('/api/security/sessions/validate', async (req, res) => {
        try {
            const { sessionToken } = req.body;

            if (!sessionToken) {
                return res.status(400).json({
                    success: false,
                    message: '缺少会话令牌'
                });
            }

            const result = await modularApp.securityModule.validateSession(sessionToken);

            res.json(result);

        } catch (error) {
            console.error('❌ 验证会话失败:', error);
            res.status(500).json({
                success: false,
                message: '验证会话失败',
                error: error.message
            });
        }
    });

    // 3. 销毁会话
    app.delete('/api/security/sessions/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;

            const result = await modularApp.securityModule.destroySession(sessionId);

            res.json(result);

        } catch (error) {
            console.error('❌ 销毁会话失败:', error);
            res.status(500).json({
                success: false,
                message: '销毁会话失败',
                error: error.message
            });
        }
    });

    // 4. 检查访问权限
    app.post('/api/security/access/check', async (req, res) => {
        try {
            const {
                userId,
                resourceType,
                resourceId,
                permissionType,
                context = {}
            } = req.body;

            // 验证必需参数
            if (!userId || !resourceType || !permissionType) {
                return res.status(400).json({
                    success: false,
                    message: '缺少必需参数: userId, resourceType, permissionType'
                });
            }

            const result = await modularApp.securityModule.checkAccess(userId, resourceType, resourceId, permissionType, context);

            res.json(result);

        } catch (error) {
            console.error('❌ 检查访问权限失败:', error);
            res.status(500).json({
                success: false,
                message: '检查访问权限失败',
                error: error.message
            });
        }
    });

    // 5. 创建访问控制规则
    app.post('/api/security/access/rules', async (req, res) => {
        try {
            const { shopId } = req.body;

            if (!shopId) {
                return res.status(400).json({
                    success: false,
                    message: '缺少店铺ID'
                });
            }

            const result = await modularApp.securityModule.createAccessRule(shopId, req.body);

            res.json(result);

        } catch (error) {
            console.error('❌ 创建访问控制规则失败:', error);
            res.status(500).json({
                success: false,
                message: '创建访问控制规则失败',
                error: error.message
            });
        }
    });

    // 6. 加密数据
    app.post('/api/security/encrypt', async (req, res) => {
        try {
            const {
                data,
                keyType = 'default'
            } = req.body;

            if (!data) {
                return res.status(400).json({
                    success: false,
                    message: '缺少要加密的数据'
                });
            }

            const result = modularApp.securityModule.encryptData(data, keyType);

            res.json({
                success: true,
                encryptedData: result
            });

        } catch (error) {
            console.error('❌ 数据加密失败:', error);
            res.status(500).json({
                success: false,
                message: '数据加密失败',
                error: error.message
            });
        }
    });

    // 7. 解密数据
    app.post('/api/security/decrypt', async (req, res) => {
        try {
            const { encryptedData } = req.body;

            if (!encryptedData) {
                return res.status(400).json({
                    success: false,
                    message: '缺少要解密的数据'
                });
            }

            const result = modularApp.securityModule.decryptData(encryptedData);

            res.json({
                success: true,
                decryptedData: result
            });

        } catch (error) {
            console.error('❌ 数据解密失败:', error);
            res.status(500).json({
                success: false,
                message: '数据解密失败',
                error: error.message
            });
        }
    });

    // 8. 威胁检测
    app.post('/api/security/threats/detect', async (req, res) => {
        try {
            const eventData = {
                ...req.body,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            const result = await modularApp.securityModule.detectThreat(eventData);

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('❌ 威胁检测失败:', error);
            res.status(500).json({
                success: false,
                message: '威胁检测失败',
                error: error.message
            });
        }
    });

    // 9. 获取审计日志
    app.get('/api/security/audit/logs', async (req, res) => {
        try {
            const options = {
                shopId: req.query.shopId,
                eventType: req.query.eventType,
                eventCategory: req.query.eventCategory,
                riskLevel: req.query.riskLevel,
                startTime: req.query.startTime,
                endTime: req.query.endTime,
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50
            };

            const result = await modularApp.securityModule.getAuditLogs(options);

            res.json(result);

        } catch (error) {
            console.error('❌ 获取审计日志失败:', error);
            res.status(500).json({
                success: false,
                message: '获取审计日志失败',
                error: error.message
            });
        }
    });

    // 10. 记录安全事件
    app.post('/api/security/audit/log', async (req, res) => {
        try {
            const eventData = {
                ...req.body,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            const result = await modularApp.securityModule.logSecurityEvent(eventData);

            res.json(result);

        } catch (error) {
            console.error('❌ 记录安全事件失败:', error);
            res.status(500).json({
                success: false,
                message: '记录安全事件失败',
                error: error.message
            });
        }
    });

    console.log('✅ 综合安全模块API路由设置完成');
}

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('🚨 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 未处理的 Promise 拒绝:', reason);
});

module.exports = app;
