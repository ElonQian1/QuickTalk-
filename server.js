const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 引入数据库和认证系统
const Database = require('./database');
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
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});

// 引入认证路由
require('./auth-routes')(app, database);
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});

// 静态页面路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin.html'));
});

// 新的多店铺管理后台
app.get('/admin-new', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin-new.html'));
});

// 代码生成器界面（集成功能）
app.get('/code-generator', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'integration-generator.html'));
});

// SDK演示页面
app.get('/sdk-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'sdk-demo.html'));
});

// ============ 用户认证系统 ============

// 用户认证中间件
function requireAuth(req, res, next) {
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    if (!sessionId) {
        return res.status(401).json({ error: '需要登录' });
    }
    
    database.validateSession(sessionId).then(user => {
        if (!user) {
            return res.status(401).json({ error: '会话已过期，请重新登录' });
        }
        req.user = user;
        req.sessionId = sessionId;
        next();
    }).catch(err => {
        res.status(500).json({ error: '验证失败' });
    });
}

// 超级管理员权限检查
function requireSuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: '需要超级管理员权限' });
    }
    next();
}

// 用户注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email, role = 'employee' } = req.body;
        
        if (!username || !password || !email) {
            return res.status(400).json({ error: '用户名、密码和邮箱为必填项' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少6位' });
        }
        
        const user = await database.registerUser({ username, password, email, role });
        
        console.log(`👤 新用户注册: ${username} (${role})`);
        res.json({ 
            success: true, 
            message: '注册成功',
            user 
        });
    } catch (error) {
        console.error('注册失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '用户名和密码为必填项' });
        }
        
        const loginResult = await database.loginUser(username, password);
        
        console.log(`🔐 用户登录: ${username}`);
        console.log(`🏪 拥有店铺数量: ${loginResult.shops.length}`);
        
        res.json({
            success: true,
            message: '登录成功',
            ...loginResult
        });
    } catch (error) {
        console.error('登录失败:', error.message);
        res.status(401).json({ error: error.message });
    }
});

// 获取当前用户信息
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const shops = await database.getUserShops(req.user.id);
        res.json({
            success: true,
            user: req.user,
            shops
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建店铺
app.post('/api/shops', requireAuth, async (req, res) => {
    try {
        const { name, domain } = req.body;
        
        if (!name || !domain) {
            return res.status(400).json({ error: '店铺名称和域名为必填项' });
        }
        
        const shop = await database.createShop(req.user.id, { name, domain });
        
        console.log(`🏪 创建新店铺: ${name} by ${req.user.username}`);
        res.json({
            success: true,
            message: '店铺创建成功',
            shop
        });
    } catch (error) {
        console.error('创建店铺失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 获取用户的店铺列表
app.get('/api/shops', requireAuth, async (req, res) => {
    try {
        const shops = await database.getUserShops(req.user.id);
        res.json({
            success: true,
            shops
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 用户登出
app.post('/api/auth/logout', requireAuth, (req, res) => {
    try {
        database.sessions.delete(req.sessionId);
        console.log(`🚪 用户登出: ${req.user.username}`);
        res.json({ success: true, message: '登出成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 超级管理员 - 获取所有用户
app.get('/api/admin/users', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const users = await database.getAllUsers();
        res.json({
            success: true,
            users
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 超级管理员 - 获取所有店铺
app.get('/api/admin/shops', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const shops = await database.getAllShops();
        res.json({
            success: true,
            shops
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 超级管理员 - 获取域名验证统计
app.get('/api/admin/domain-stats', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const stats = await securityValidator.getSecurityStats();
        
        // 获取当前在线用户的域名信息
        const onlineUsers = Array.from(httpUsers.values()).map(user => ({
            userId: user.userId,
            domain: user.domain,
            ip: user.ip,
            shopInfo: user.shopInfo,
            securityLevel: user.securityLevel,
            apiKeyUsed: user.apiKeyUsed,
            validationMethods: user.validationMethods,
            connectedAt: user.connectedAt,
            lastSeen: user.lastSeen
        }));
        
        res.json({
            success: true,
            stats,
            onlineUsers,
            totalOnline: httpUsers.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API密钥管理接口
// 为店铺生成API密钥
app.post('/api/admin/shops/:shopId/generate-api-key', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { shopId } = req.params;
        const apiKey = await database.generateApiKeyForShop(shopId);
        
        res.json({
            success: true,
            message: 'API密钥生成成功',
            apiKey,
            maskedKey: apiKey.substring(0, 12) + '****' + apiKey.substring(apiKey.length - 4)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取店铺API密钥信息
app.get('/api/admin/shops/:shopId/api-key', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { shopId } = req.params;
        const apiKeyInfo = await database.getShopApiKeyInfo(shopId);
        
        res.json({
            success: true,
            apiKeyInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除店铺API密钥
app.delete('/api/admin/shops/:shopId/api-key', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { shopId } = req.params;
        await database.deleteShopApiKey(shopId);
        
        res.json({
            success: true,
            message: 'API密钥已删除'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 超级管理员 - 测试域名验证
app.post('/api/admin/test-domain', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { testDomain, testIP, testApiKey } = req.body;
        
        if (!testDomain) {
            return res.status(400).json({ error: '请提供测试域名' });
        }
        
        // 模拟客户端信息
        const mockClientInfo = {
            ip: testIP || '192.168.1.100',
            referer: `https://${testDomain}/test-page`,
            origin: `https://${testDomain}`,
            refererDomain: testDomain,
            originDomain: testDomain,
            userAgent: 'Domain Validation Test Tool',
            host: 'localhost:3030',
            timestamp: new Date().toISOString()
        };
        
        // 创建模拟请求对象
        const mockReq = {
            path: '/api/connect',
            get: (header) => {
                const headers = {
                    'Referer': mockClientInfo.referer,
                    'Origin': mockClientInfo.origin,
                    'User-Agent': mockClientInfo.userAgent,
                    'X-API-Key': testApiKey,
                    'Authorization': testApiKey ? `Bearer ${testApiKey}` : undefined
                };
                return headers[header];
            },
            ip: mockClientInfo.ip,
            connection: { remoteAddress: mockClientInfo.ip },
            socket: { remoteAddress: mockClientInfo.ip },
            headers: {
                'x-forwarded-for': mockClientInfo.ip,
                'referer': mockClientInfo.referer,
                'origin': mockClientInfo.origin,
                'user-agent': mockClientInfo.userAgent,
                'x-api-key': testApiKey
            }
        };
        
        // 进行增强验证
        const validation = await securityValidator.enhancedValidation(mockReq);
        
        res.json({
            success: true,
            testDomain,
            testIP,
            testApiKey: testApiKey ? testApiKey.substring(0, 12) + '****' : null,
            validation: {
                isValid: validation.isValid,
                securityLevel: validation.securityLevel,
                validationMethods: validation.validationMethods,
                reason: validation.reason,
                warnings: validation.warnings,
                suspicionScore: validation.suspicionScore,
                processingTime: validation.processingTime,
                shopInfo: validation.shopInfo,
                apiKeyUsed: validation.apiKeyUsed
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ 集成代码生成API ============

// 为店铺生成集成代码
app.post('/api/shop/:shopId/generate-code', requireAuth, async (req, res) => {
    try {
        const shopId = parseInt(req.params.shopId);
        const options = req.body || {};
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(s => s.id === shopId) || req.user.role === 'super_admin';
        
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问此店铺' });
        }
        
        const result = await codeGenerator.generateIntegrationCode(shopId, options);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('生成集成代码失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 重新生成店铺API密钥
app.post('/api/shop/:shopId/regenerate-key', requireAuth, async (req, res) => {
    try {
        const shopId = parseInt(req.params.shopId);
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(s => s.id === shopId) || req.user.role === 'super_admin';
        
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问此店铺' });
        }
        
        const result = await codeGenerator.regenerateApiKey(shopId);
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.error('重新生成API密钥失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 安全连接API（带API密钥验证）
app.post('/api/secure-connect', async (req, res) => {
    try {
        const { userId, timestamp, shopKey, shopId, domain, version } = req.body;
        
        if (!userId || !shopKey || !shopId) {
            return res.status(400).json({ 
                error: '缺少必要参数',
                required: ['userId', 'shopKey', 'shopId']
            });
        }
        
        // 获取客户端信息
        const clientInfo = domainValidator.extractClientInfo(req);
        
        // 验证API密钥
        const keyValidation = await codeGenerator.verifyApiKey(shopKey, domain || clientInfo.refererDomain, clientInfo.ip);
        
        if (!keyValidation.valid) {
            console.warn(`🚫 API密钥验证失败: ${keyValidation.reason}`);
            return res.status(403).json({
                error: 'API密钥验证失败',
                reason: keyValidation.reason,
                code: keyValidation.code || 'INVALID_CREDENTIALS'
            });
        }
        
        console.log(`🔑 API密钥验证成功: ${keyValidation.shop.name} (${domain || clientInfo.refererDomain})`);
        
        // 注册用户（包含API密钥信息）
        httpUsers.set(userId, {
            userId,
            connectedAt: timestamp,
            lastSeen: Date.now(),
            domain: domain || clientInfo.refererDomain,
            ip: clientInfo.ip,
            shopInfo: keyValidation.shop,
            shopKey: shopKey,
            version: version,
            userAgent: clientInfo.userAgent
        });
        
        // 初始化消息队列
        if (!messageQueue.has(userId)) {
            messageQueue.set(userId, []);
        }
        
        // 通知所有WebSocket客服
        const connectMessage = {
            type: 'user_connect',
            userId: userId,
            timestamp: timestamp,
            connectionType: 'SECURE_HTTP',
            domain: domain || clientInfo.refererDomain,
            ip: clientInfo.ip,
            shopInfo: keyValidation.shop,
            shopKey: shopKey.substring(0, 8) + '****'
        };
        
        staffs.forEach((staff, staffId) => {
            if (staff.ws && staff.ws.readyState === WebSocket.OPEN) {
                staff.ws.send(JSON.stringify(connectMessage));
            }
        });
        
        res.json({
            success: true,
            message: '安全连接建立成功',
            shop: {
                id: keyValidation.shop.id,
                name: keyValidation.shop.name,
                domain: keyValidation.shop.domain
            },
            userId: userId,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('安全连接失败:', error);
        res.status(500).json({ 
            error: '服务器内部错误',
            message: error.message 
        });
    }
});

// ============ 客服消息API ============

// HTTP API存储
const httpUsers = new Map();
const messageQueue = new Map(); // 用户ID -> 消息数组
let messageIdCounter = 1;

// HTTP API接口
// 用户连接接口
app.post('/api/connect', (req, res) => {
    const { userId, timestamp } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: '缺少用户ID' });
    }
    
    // 获取增强验证信息
    const validation = req.securityValidation;
    const clientInfo = req.clientInfo;
    
    // 注册用户（包含完整安全信息）
    httpUsers.set(userId, {
        userId,
        connectedAt: timestamp,
        lastSeen: Date.now(),
        domain: clientInfo.refererDomain || clientInfo.originDomain,
        ip: clientInfo.ip,
        shopInfo: validation.shopInfo,
        userAgent: clientInfo.userAgent,
        securityLevel: validation.securityLevel,
        apiKeyUsed: validation.apiKeyUsed,
        validationMethods: validation.validationMethods
    });
    
    // 初始化消息队列
    if (!messageQueue.has(userId)) {
        messageQueue.set(userId, []);
    }
    
    console.log(`📱 HTTP用户连接: ${userId} 来自 ${clientInfo.refererDomain || clientInfo.originDomain} (${clientInfo.ip})`);
    if (validation.shopInfo) {
        console.log(`🏪 匹配店铺: ${validation.shopInfo.name} (ID: ${validation.shopInfo.id})`);
    }
    console.log(`🔒 安全等级: ${validation.securityLevel} | 验证方式: ${validation.validationMethods.join(', ')}`);
    
    // 通知所有WebSocket客服
    const connectMessage = {
        type: 'user_connect',
        userId: userId,
        timestamp: timestamp,
        connectionType: 'HTTP',
        domain: clientInfo.refererDomain || clientInfo.originDomain,
        ip: clientInfo.ip,
        shopInfo: validation.shopInfo,
        securityInfo: {
            level: validation.securityLevel,
            methods: validation.validationMethods,
            apiKeyUsed: validation.apiKeyUsed,
            warnings: validation.warnings
        }
    };
    
    staffs.forEach((staff, staffId) => {
        if (staff.ws && staff.ws.readyState === WebSocket.OPEN) {
            staff.ws.send(JSON.stringify(connectMessage));
        }
    });
    
    res.json({ 
        success: true, 
        message: '连接成功',
        validation: {
            domain: clientInfo.refererDomain || clientInfo.originDomain,
            shopName: validation.shopInfo ? validation.shopInfo.name : null,
            securityLevel: validation.securityLevel,
            validationMethods: validation.validationMethods,
            apiKeyUsed: validation.apiKeyUsed,
            warnings: validation.warnings
        }
    });
});

// 获取新消息接口
app.get('/api/messages', (req, res) => {
    const { userId, lastId = 0 } = req.query;
    
    if (!userId) {
        return res.status(400).json({ error: '缺少用户ID' });
    }
    
    // 更新用户最后活跃时间
    if (httpUsers.has(userId)) {
        const user = httpUsers.get(userId);
        user.lastSeen = Date.now();
    }
    
    // 获取用户的消息队列
    const userMessages = messageQueue.get(userId) || [];
    const newMessages = userMessages.filter(msg => msg.id > parseInt(lastId));
    
    res.json({ 
        success: true, 
        messages: newMessages,
        timestamp: Date.now()
    });
});

// 发送消息接口
app.post('/api/send', (req, res) => {
    const { userId, message, timestamp } = req.body;
    
    if (!userId || !message) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    console.log(`📨 HTTP用户消息 [${userId}]: ${message}`);
    
    // 转发给所有WebSocket客服
    const userMessage = {
        type: 'user_message',
        userId: userId,
        message: message,
        timestamp: timestamp,
        connectionType: 'HTTP'
    };
    
    staffs.forEach((staff, staffId) => {
        if (staff.ws && staff.ws.readyState === WebSocket.OPEN) {
            staff.ws.send(JSON.stringify(userMessage));
        }
    });
    
    // 自动回复(延迟3秒)
    setTimeout(() => {
        const autoReply = generateAutoReply(message);
        const replyMessage = {
            id: messageIdCounter++,
            type: 'staff_message',
            message: autoReply,
            staffName: '智能客服',
            timestamp: Date.now()
        };
        
        // 添加到用户消息队列
        if (!messageQueue.has(userId)) {
            messageQueue.set(userId, []);
        }
        messageQueue.get(userId).push(replyMessage);
        
        console.log(`🤖 自动回复给HTTP用户 [${userId}]: ${autoReply}`);
    }, 3000);
    
    res.json({ success: true, message: '消息已发送' });
});

// 创建 HTTP 服务器
const server = require('http').createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server, path: '/ws' });

// 存储连接的用户
const users = new Map();
const staffs = new Map();

// 自动回复逻辑
function generateAutoReply(userMessage) {
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('你好') || messageLower.includes('hello') || messageLower.includes('hi')) {
        return '您好！欢迎咨询，请问有什么可以帮助您的吗？';
    } else if (messageLower.includes('价格') || messageLower.includes('多少钱') || messageLower.includes('费用')) {
        return '关于价格问题，我们有多种套餐可供选择。请稍等，我为您查询具体的价格信息。';
    } else if (messageLower.includes('技术') || messageLower.includes('问题') || messageLower.includes('bug')) {
        return '我理解您遇到了技术问题。请详细描述一下具体情况，我会尽快为您提供解决方案。';
    } else if (messageLower.includes('联系') || messageLower.includes('电话') || messageLower.includes('邮箱')) {
        return '您可以通过以下方式联系我们：\n📞 客服热线：400-123-4567\n📧 邮箱：service@example.com\n⏰ 服务时间：9:00-18:00';
    } else if (messageLower.includes('谢谢') || messageLower.includes('感谢')) {
        return '不客气！很高兴能为您提供帮助。如果还有其他问题，随时联系我们。';
    } else if (messageLower.includes('再见') || messageLower.includes('拜拜')) {
        return '感谢您的咨询！祝您生活愉快，再见！';
    } else {
        return '我收到了您的消息，正在为您查询相关信息，请稍等片刻...';
    }
}

// 广播消息到所有客服
function broadcastToStaffs(message) {
    staffs.forEach((staff, staffId) => {
        if (staff.ws.readyState === WebSocket.OPEN) {
            staff.ws.send(JSON.stringify(message));
        }
    });
}

// 发送消息给特定用户
function sendToUser(userId, message) {
    console.log(`🎯 尝试发送消息给用户 ${userId}:`, message);
    const user = users.get(userId);
    if (user && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(message));
        console.log(`✅ 消息已发送给用户 ${userId}`);
    } else {
        console.log(`❌ 用户 ${userId} 未找到或连接已断开`);
        console.log(`📋 当前在线用户:`, Array.from(users.keys()));
    }
}

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
    const connectionId = uuidv4(); // 仅用于连接管理
    const url = new URL(req.url, `http://${req.headers.host}`);
    const isStaff = url.searchParams.get('staff') === 'true';
    
    console.log(`🔗 新连接: ${isStaff ? '客服' : '用户'} ${connectionId}`);
    
    let actualUserId = null; // 实际的用户ID将从消息中获取
    
    if (isStaff) {
        // 客服连接
        staffs.set(connectionId, {
            id: connectionId,
            ws: ws,
            name: '小助手',
            connectedAt: new Date()
        });
        
        // 发送当前在线用户列表给客服
        try {
            const userList = Array.from(users.values()).map(user => ({
                id: user.id,
                status: 'online',
                messages: user.messages || []
            }));
            
            ws.send(JSON.stringify({
                type: 'user_list',
                users: userList
            }));
        } catch (error) {
            console.error('发送用户列表失败:', error);
        }
        
    } else {
        // 普通用户连接 - 先不添加到users，等收到user_connect消息后再添加
        // 发送欢迎消息
        ws.send(JSON.stringify({
            type: 'system_notification',
            message: '欢迎使用在线客服！我们的客服人员将很快为您服务。',
            timestamp: Date.now()
        }));
    }
    
    // 处理接收到的消息
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 收到消息:`, message);
            
            switch (message.type) {
                case 'staff_connect':
                    console.log(`👨‍💼 客服 ${message.staffName} 已连接`);
                    break;
                    
                case 'user_connect':
                    actualUserId = message.userId;
                    console.log(`👤 用户 ${actualUserId} 已连接`);
                    
                    // 现在添加用户到users映射
                    users.set(actualUserId, {
                        id: actualUserId,
                        ws: ws,
                        messages: [],
                        connectedAt: new Date()
                    });
                    
                    // 通知所有客服有新用户连接
                    broadcastToStaffs({
                        type: 'user_connect',
                        userId: actualUserId,
                        timestamp: message.timestamp
                    });
                    break;
                
                case 'user_message':
                    console.log(`💬 用户 ${message.userId} 发送消息: ${message.message}`);
                    
                    // 存储用户消息
                    const user = users.get(message.userId);
                    if (user) {
                        user.messages.push({
                            type: 'user',
                            content: message.message,
                            timestamp: new Date()
                        });
                    }
                    
                    // 转发给所有客服
                    broadcastToStaffs({
                        type: 'user_message',
                        userId: message.userId,
                        message: message.message,
                        timestamp: message.timestamp
                    });
                    
                    // 模拟客服自动回复
                    setTimeout(() => {
                        const autoReply = generateAutoReply(message.message);
                        
                        // 存储回复消息
                        if (user) {
                            user.messages.push({
                                type: 'staff',
                                content: autoReply,
                                timestamp: new Date(),
                                staffName: '小助手'
                            });
                        }
                        
                        // 发送给用户
                        sendToUser(message.userId, {
                            type: 'staff_message',
                            message: autoReply,
                            staffName: '小助手',
                            timestamp: Date.now()
                        });
                        
                        // 通知客服
                        broadcastToStaffs({
                            type: 'staff_replied',
                            userId: message.userId,
                            message: autoReply,
                            staffName: '小助手',
                            timestamp: Date.now()
                        });
                        
                    }, 1000 + Math.random() * 2000); // 1-3秒随机延迟
                    
                    break;
                
                case 'staff_message':
                    console.log(`👨‍💼 客服回复用户 ${message.userId}: ${message.message}`);
                    
                    // 存储客服消息
                    const targetUser = users.get(message.userId);
                    if (targetUser) {
                        targetUser.messages.push({
                            type: 'staff',
                            content: message.message,
                            timestamp: new Date(),
                            staffName: message.staffName
                        });
                    }
                    
                    // 发送给WebSocket用户
                    sendToUser(message.userId, {
                        type: 'staff_message',
                        message: message.message,
                        staffName: message.staffName,
                        timestamp: message.timestamp
                    });
                    
                    // 同时发送给HTTP用户
                    if (httpUsers.has(message.userId)) {
                        const replyMessage = {
                            id: messageIdCounter++,
                            type: 'staff_message',
                            message: message.message,
                            staffName: message.staffName,
                            timestamp: message.timestamp
                        };
                        
                        // 添加到HTTP用户消息队列
                        if (!messageQueue.has(message.userId)) {
                            messageQueue.set(message.userId, []);
                        }
                        messageQueue.get(message.userId).push(replyMessage);
                        
                        console.log(`📤 消息已添加到HTTP用户 ${message.userId} 的队列`);
                    }
                    
                    break;
                
                default:
                    console.log(`🔄 未知消息类型: ${message.type}`);
            }
            
        } catch (error) {
            console.error('🚨 处理消息错误:', error);
        }
    });
    
    // 连接关闭处理
    ws.on('close', () => {
        if (isStaff) {
            staffs.delete(connectionId);
            console.log(`🔌 客服断开连接: ${connectionId}`);
        } else {
            if (actualUserId) {
                users.delete(actualUserId);
                console.log(`🔌 用户断开连接: ${actualUserId}`);
                
                // 通知客服用户离线
                broadcastToStaffs({
                    type: 'user_disconnect',
                    userId: actualUserId,
                    timestamp: Date.now()
                });
            } else {
                console.log(`🔌 未识别用户断开连接: ${connectionId}`);
            }
        }
    });
    
    // 错误处理
    ws.on('error', (error) => {
        console.error('🚨 WebSocket 错误:', error);
    });
});

// 启动服务器
server.listen(PORT, () => {
    console.log(`🚀 服务器启动成功！`);
    console.log(`📁 用户界面: http://localhost:${PORT}`);
    console.log(`👨‍💼 客服后台: http://localhost:${PORT}/admin`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
});

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
