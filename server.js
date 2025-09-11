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

// 静态文件服务 - 新的目录结构
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/components', express.static(path.join(__dirname, 'src/components')));
// 为模块化文件提供直接访问路径
app.use('/js', express.static(path.join(__dirname, 'static/js')));
app.use('/css', express.static(path.join(__dirname, 'static/css')));

// 信任代理（用于获取真实IP）
app.set('trust proxy', true);

// 域名验证中间件（在CORS之前）
app.use(domainValidator.createMiddleware());

// CORS支持
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Session-Id, X-Shop-Key, X-Shop-Id, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    next();
});

// 引入认证路由
require('./auth-routes')(app, database);

// ====== 新的路由结构 ======

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// 桌面端路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'admin', 'index.html'));
});

app.get('/desktop/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'admin', 'index.html'));
});

app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'customer', 'index.html'));
});

app.get('/desktop/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'customer', 'index.html'));
});

// 移动端路由
app.get('/mobile/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin-mobile.html'));
});

app.get('/mobile/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'mobile', 'customer', 'index.html'));
});

// ====== 兼容旧路由 ======
app.get('/admin-new', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'admin', 'index.html'));
});

app.get('/admin-desktop', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'desktop', 'admin', 'index.html'));
});

app.get('/mobile-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin-mobile.html'));
});

app.get('/admin-mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'admin-mobile.html'));
});

// 代码生成器和其他工具（保持在static目录）
app.get('/code-generator', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'integration-generator.html'));
});

app.get('/sdk-demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'sdk-demo.html'));
});

// ============ 用户认证系统 ============

// 用户认证中间件
function requireAuth(req, res, next) {
    // 支持两种认证方式：X-Session-Id 和 Authorization Bearer
    let sessionId = req.headers['x-session-id'] || req.body.sessionId;
    
    // 如果没有 X-Session-Id，尝试从 Authorization 头部获取
    if (!sessionId) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionId = authHeader.substring(7); // 移除 "Bearer " 前缀
        }
    }
    
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
        console.error('认证验证失败:', err);
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
        console.log(`📋 用户 ${req.user.username} 的店铺列表:`, shops ? shops.length : 'null', '个店铺');
        
        // 确保始终返回数组格式
        const shopsArray = Array.isArray(shops) ? shops : [];
        console.log(`📦 返回数据格式检查: 类型=${typeof shopsArray}, 是数组=${Array.isArray(shopsArray)}, 长度=${shopsArray.length}`);
        
        // 直接返回数组，与/api/admin/shops保持一致
        res.json(shopsArray);
    } catch (error) {
        console.error('获取用户店铺失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取单个店铺详情
app.get('/api/shops/:shopId', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log(`🏪 获取店铺详情: ${shopId}`);
        
        // 先检查用户是否有权限访问这个店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '没有权限访问该店铺' });
        }
        
        // 获取店铺详情
        const shop = await database.getShopById(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        res.json(shop);
    } catch (error) {
        console.error('获取店铺详情失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取店铺员工列表
app.get('/api/shops/:shopId/employees', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log(`👥 获取店铺员工列表: ${shopId}`);
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '没有权限访问该店铺' });
        }
        
        // 获取员工列表
        const employees = await database.getShopEmployees(shopId);
        console.log(`📋 店铺 ${shopId} 的员工列表:`, employees.length, '个员工');
        
        res.json(employees);
    } catch (error) {
        console.error('获取店铺员工失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 添加店铺员工
app.post('/api/shops/:shopId/employees', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { username, email, password, role } = req.body;
        console.log(`➕ 添加店铺员工: ${shopId} -> ${username}`);
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '没有权限管理该店铺' });
        }
        
        // 添加员工
        const employee = await database.addShopEmployee(shopId, {
            username,
            email,
            password,
            role: role || 'staff'
        });
        
        console.log(`✅ 员工 ${username} 已添加到店铺 ${shopId}`);
        res.json({
            success: true,
            message: '员工添加成功',
            employee
        });
    } catch (error) {
        console.error('添加店铺员工失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 删除店铺员工
app.delete('/api/shops/:shopId/employees/:employeeId', requireAuth, async (req, res) => {
    try {
        const { shopId, employeeId } = req.params;
        console.log(`🗑️ 删除店铺员工: ${shopId} -> ${employeeId}`);
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess && req.user.role !== 'super_admin') {
            return res.status(403).json({ error: '没有权限管理该店铺' });
        }
        
        // 删除员工
        await database.removeShopEmployee(shopId, employeeId);
        
        console.log(`✅ 员工 ${employeeId} 已从店铺 ${shopId} 移除`);
        res.json({
            success: true,
            message: '员工移除成功'
        });
    } catch (error) {
        console.error('删除店铺员工失败:', error);
        res.status(500).json({ error: error.message });
    }
});

// 更新待审核店铺信息
app.put('/api/shops/:shopId', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { name, domain, description } = req.body;
        
        const shop = await database.updatePendingShop(req.user.id, shopId, { name, domain, description });
        
        res.json({
            success: true,
            message: '店铺信息更新成功',
            shop
        });
    } catch (error) {
        console.error('更新店铺失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 重新提交店铺审核
app.post('/api/shops/:shopId/resubmit', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        const shop = await database.resubmitShopForReview(req.user.id, shopId);
        
        res.json({
            success: true,
            message: '店铺重新提交审核成功',
            shop
        });
    } catch (error) {
        console.error('重新提交审核失败:', error.message);
        res.status(400).json({ error: error.message });
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
        const shopId = req.params.shopId; // 保持字符串格式，不使用parseInt
        const options = req.body || {};
        
        // 检查权限
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = userShops.some(s => s.id === shopId) || req.user.role === 'super_admin';
        
        if (!hasAccess) {
            return res.status(403).json({ error: '无权访问此店铺' });
        }
        
        // 自动检测服务器地址
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3030';
        const serverUrl = `${protocol}://${host}`;
        
        console.log(`🌐 自动检测服务器地址: ${serverUrl}`);
        
        // 将服务器地址添加到选项中
        options.serverUrl = serverUrl;
        
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
        const shopId = req.params.shopId; // 保持字符串格式，不使用parseInt
        
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
app.post('/api/send', async (req, res) => {
    const { userId, message, timestamp } = req.body;
    
    if (!userId || !message) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    console.log(`📨 HTTP用户消息 [${userId}]: ${message}`);
    
    try {
        // 从请求中获取店铺信息
        const shopId = req.domainValidation?.matchedShop?.id;
        
        if (shopId) {
            // 保存用户消息到数据库
            await database.saveMessage({
                shopId,
                userId,
                message,
                sender: 'user',
                timestamp: timestamp ? new Date(timestamp) : new Date()
            });
        }
        
        // 转发给所有WebSocket客服
        const userMessage = {
            type: 'user_message',
            userId: userId,
            message: message,
            timestamp: timestamp,
            shopId: shopId,
            connectionType: 'HTTP'
        };
        
        staffs.forEach((staff, staffId) => {
            if (staff.ws && staff.ws.readyState === WebSocket.OPEN) {
                staff.ws.send(JSON.stringify(userMessage));
            }
        });
        
        // 通知手机端管理系统有新消息
        broadcastToStaffs({
            type: 'new_message',
            shopId,
            userId,
            message: {
                content: message,
                sender: 'user',
                timestamp: timestamp || Date.now()
            }
        });
        
        // 自动回复(延迟3秒)
        setTimeout(async () => {
            const autoReply = generateAutoReply(message);
            const replyMessage = {
                id: messageIdCounter++,
                type: 'staff_message',
                message: autoReply,
                staffName: '智能客服',
                timestamp: Date.now()
            };
            
            // 保存自动回复到数据库
            if (shopId) {
                await database.saveMessage({
                    shopId,
                    userId,
                    message: autoReply,
                    sender: 'system',
                    timestamp: new Date()
                });
            }
            
            // 添加到用户消息队列
            if (!messageQueue.has(userId)) {
                messageQueue.set(userId, []);
            }
            messageQueue.get(userId).push(replyMessage);
            
            console.log(`🤖 自动回复给HTTP用户 [${userId}]: ${autoReply}`);
        }, 3000);
        
        res.json({ success: true, message: '消息已发送' });
    } catch (error) {
        console.error('保存消息失败:', error);
        res.json({ success: true, message: '消息已发送' }); // 即使保存失败也返回成功，不影响用户体验
    }
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

// ============ 移动端管理API ============

// 获取管理员的所有店铺列表
app.get('/api/admin/shops', requireAuth, async (req, res) => {
    try {
        let shops = [];
        
        if (req.user.role === 'super_admin') {
            // 超级管理员可以看到所有店铺
            shops = await database.getAllShops();
        } else {
            // 普通用户只能看到自己的店铺
            shops = await database.getUserShops(req.user.id);
        }
        
        res.json(shops);
    } catch (error) {
        console.error('获取店铺列表失败:', error);
        res.status(500).json({ error: '获取店铺列表失败' });
    }
});

// 获取管理员统计数据
app.get('/api/admin/stats', requireAuth, async (req, res) => {
    try {
        const stats = await database.getOverallStats(req.user.role === 'super_admin' ? null : req.user.id);
        res.json(stats);
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({ error: '获取统计数据失败' });
    }
});

// 获取店铺的用户对话列表
app.get('/api/shops/:shopId/conversations', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        // 检查用户是否有权限查看该店铺
        const hasPermission = await checkShopPermission(req.user, shopId);
        if (!hasPermission) {
            return res.status(403).json({ error: '无权限访问该店铺' });
        }
        
        // 获取该店铺的所有对话
        const conversations = await database.getShopConversations(shopId);
        
        res.json(conversations);
    } catch (error) {
        console.error('获取对话列表失败:', error);
        res.status(500).json({ error: '获取对话列表失败' });
    }
});

// 获取具体用户的聊天消息
app.get('/api/shops/:shopId/users/:userId/messages', requireAuth, async (req, res) => {
    try {
        const { shopId, userId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        // 检查权限
        const hasPermission = await checkShopPermission(req.user, shopId);
        if (!hasPermission) {
            return res.status(403).json({ error: '无权限访问该店铺' });
        }
        
        // 获取聊天消息
        const messages = await database.getChatMessages(shopId, userId, parseInt(page), parseInt(limit));
        
        res.json(messages);
    } catch (error) {
        console.error('获取聊天消息失败:', error);
        res.status(500).json({ error: '获取聊天消息失败' });
    }
});

// 发送管理员回复消息
app.post('/api/shops/:shopId/users/:userId/reply', requireAuth, async (req, res) => {
    try {
        const { shopId, userId } = req.params;
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: '消息内容不能为空' });
        }
        
        // 检查权限
        const hasPermission = await checkShopPermission(req.user, shopId);
        if (!hasPermission) {
            return res.status(403).json({ error: '无权限访问该店铺' });
        }
        
        // 保存消息到数据库
        const messageId = await database.saveMessage({
            shopId,
            userId,
            message,
            sender: 'admin',
            adminId: req.user.id,
            timestamp: new Date()
        });
        
        // 通过WebSocket发送消息给用户（如果在线）
        sendToUser(userId, {
            type: 'admin_reply',
            message: message,
            timestamp: Date.now()
        });
        
        // 通过WebSocket通知其他客服
        broadcastToStaffs({
            type: 'admin_reply_sent',
            shopId,
            userId,
            message,
            adminName: req.user.username,
            timestamp: Date.now()
        });
        
        res.json({ 
            success: true, 
            messageId,
            message: '消息发送成功' 
        });
    } catch (error) {
        console.error('发送回复失败:', error);
        res.status(500).json({ error: '发送回复失败' });
    }
});

// 获取未读消息统计
app.get('/api/admin/unread-stats', requireAuth, async (req, res) => {
    try {
        let stats = {};
        
        if (req.user.role === 'super_admin') {
            // 超级管理员获取所有店铺的统计
            stats = await database.getAllUnreadStats();
        } else {
            // 普通用户只能看到自己店铺的统计
            const userShops = await database.getUserShops(req.user.id);
            for (const shop of userShops) {
                const shopStats = await database.getShopUnreadStats(shop.id);
                stats[shop.id] = shopStats;
            }
        }
        
        res.json(stats);
    } catch (error) {
        console.error('获取未读统计失败:', error);
        res.status(500).json({ error: '获取未读统计失败' });
    }
});

// 标记消息为已读
app.post('/api/shops/:shopId/users/:userId/mark-read', requireAuth, async (req, res) => {
    try {
        const { shopId, userId } = req.params;
        
        // 检查权限
        const hasPermission = await checkShopPermission(req.user, shopId);
        if (!hasPermission) {
            return res.status(403).json({ error: '无权限访问该店铺' });
        }
        
        // 标记消息为已读
        await database.markMessagesAsRead(shopId, userId, req.user.id);
        
        res.json({ success: true, message: '消息已标记为已读' });
    } catch (error) {
        console.error('标记已读失败:', error);
        res.status(500).json({ error: '标记已读失败' });
    }
});

// 权限检查辅助函数
async function checkShopPermission(user, shopId) {
    if (user.role === 'super_admin') {
        return true; // 超级管理员有所有权限
    }
    
    try {
        const userShops = await database.getUserShops(user.id);
        return userShops.some(shop => shop.id === shopId);
    } catch (error) {
        console.error('检查权限失败:', error);
        return false;
    }
}

// ============ 充值续费API ============

// 创建续费订单
app.post('/api/shops/:shopId/renew', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        // 先获取店铺信息
        const shop = await database.getShopById(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查用户是否有权限为此店铺续费
        const userShops = await database.getUserShops(req.user.id);
        const userShop = userShops.find(s => s.id === shopId);
        if (!userShop || userShop.userRole !== 'owner') {
            return res.status(403).json({ error: '只有店主可以为店铺续费' });
        }
        
        // 构造订单数据
        const orderData = {
            shop_id: shopId,
            user_id: req.user.id,
            amount: 2000.00,
            months: 12
        };
        
        const order = await database.createRenewalOrder(orderData);
        
        res.json({
            success: true,
            message: '续费订单创建成功',
            order: {
                orderId: order.id,
                shopId: order.shop_id,
                shopName: shop.name,
                amount: order.amount,
                months: order.months,
                status: order.status,
                currentExpiry: shop.expiryDate || new Date().toISOString(),
                newExpiry: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000).toISOString()
            }
        });
    } catch (error) {
        console.error('创建续费订单失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 生成支付二维码
app.post('/api/orders/:orderId/qrcode', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod } = req.body; // 'alipay' 或 'wechat'
        
        if (!['alipay', 'wechat'].includes(paymentMethod)) {
            return res.status(400).json({ error: '支付方式不支持' });
        }
        
        const qrData = await database.generatePaymentQRCode(orderId, paymentMethod);
        
        res.json({
            success: true,
            qrData
        });
    } catch (error) {
        console.error('生成支付二维码失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 检查订单支付状态
app.get('/api/orders/:orderId/status', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await database.checkOrderStatus(orderId);
        
        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('查询订单状态失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 模拟支付成功（测试用）
app.post('/api/orders/:orderId/mock-payment', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await database.mockPaymentSuccess(orderId);
        
        res.json({
            success: true,
            message: '支付成功',
            result
        });
    } catch (error) {
        console.error('模拟支付失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 获取店铺续费历史
app.get('/api/shops/:shopId/renewal-history', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        const history = await database.getShopRenewalHistory(shopId);
        
        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('获取续费历史失败:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 付费开通API ============

// 创建付费开通订单
app.post('/api/shops/:shopId/activate', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        // 先获取店铺信息
        const shop = await database.getShopById(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查用户是否有权限开通此店铺
        const userShops = await database.getUserShops(req.user.id);
        const userShop = userShops.find(s => s.id === shopId);
        if (!userShop || userShop.userRole !== 'owner') {
            return res.status(403).json({ error: '只有店主可以付费开通店铺' });
        }
        
        // 构造订单数据
        const orderData = {
            user_id: req.user.id,
            shop_name: shop.name,
            domain: shop.domain,
            amount: 2000.00,
            months: 12
        };
        
        const order = await database.createActivationOrder(orderData);
        
        res.json({
            success: true,
            message: '付费开通订单创建成功',
            order: {
                orderId: order.id,
                shopName: order.shop_name,
                amount: order.amount,
                months: order.months,
                status: order.status,
                expiresAt: new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000).toISOString()
            }
        });
    } catch (error) {
        console.error('创建付费开通订单失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 生成付费开通支付二维码
app.post('/api/activation-orders/:orderId/qrcode', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { paymentMethod } = req.body;
        
        if (!['alipay', 'wechat'].includes(paymentMethod)) {
            return res.status(400).json({ error: '不支持的支付方式' });
        }
        
        const qrData = await database.generateActivationPaymentQRCode(orderId, paymentMethod);
        
        res.json({
            success: true,
            message: '支付二维码生成成功',
            qrData
        });
    } catch (error) {
        console.error('生成付费开通支付二维码失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 查询付费开通订单状态
app.get('/api/activation-orders/:orderId/status', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await database.getActivationOrderStatus(orderId);
        
        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('查询付费开通订单状态失败:', error.message);
        res.status(404).json({ error: error.message });
    }
});

// 模拟付费开通支付成功
app.post('/api/activation-orders/:orderId/mock-success', requireAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await database.mockActivationPaymentSuccess(orderId);
        
        res.json({
            success: true,
            message: '付费开通支付成功',
            ...result
        });
    } catch (error) {
        console.error('模拟付费开通支付失败:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 获取店铺付费开通历史
app.get('/api/shops/:shopId/activation-history', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        const history = await database.getShopActivationHistory(shopId);
        
        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('获取付费开通历史失败:', error.message);
        res.status(500).json({ error: error.message });
    }
});

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
    ws.on('message', async (data) => {
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
                    
                    // 保存到数据库（需要店铺ID，可能从WebSocket连接中获取）
                    try {
                        // 这里简化处理，使用第一个店铺的ID，实际应用中需要正确识别店铺
                        const shops = await database.getAllShops();
                        if (shops.length > 0) {
                            await database.saveMessage({
                                shopId: shops[0].id,
                                userId: message.userId,
                                message: message.message,
                                sender: 'user',
                                timestamp: new Date()
                            });
                        }
                    } catch (error) {
                        console.error('WebSocket用户消息保存失败:', error);
                    }
                    
                    // 转发给所有客服
                    broadcastToStaffs({
                        type: 'user_message',
                        userId: message.userId,
                        message: message.message,
                        timestamp: message.timestamp
                    });
                    
                    // 模拟客服自动回复
                    setTimeout(async () => {
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
                        
                        // 保存自动回复到数据库
                        try {
                            const shops = await database.getAllShops();
                            if (shops.length > 0) {
                                await database.saveMessage({
                                    shopId: shops[0].id,
                                    userId: message.userId,
                                    message: autoReply,
                                    sender: 'system',
                                    timestamp: new Date()
                                });
                            }
                        } catch (error) {
                            console.error('WebSocket自动回复保存失败:', error);
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
    console.log(`🚀 QuickTalk 客服系统启动成功！`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 项目主页: http://localhost:${PORT}`);
    console.log(`�️  桌面端:`);
    console.log(`   📊 管理后台: http://localhost:${PORT}/admin`);
    console.log(`   � 客服聊天: http://localhost:${PORT}/customer`);
    console.log(`📱 移动端:`);
    console.log(`   📊 管理后台: http://localhost:${PORT}/mobile/admin`);
    console.log(`   � 客服聊天: http://localhost:${PORT}/mobile/customer`);
    console.log(`🔧 开发工具:`);
    console.log(`   🎛️  代码生成器: http://localhost:${PORT}/code-generator`);
    console.log(`   🧪 SDK 演示: http://localhost:${PORT}/sdk-demo`);
    console.log(`�🔌 WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log(`🎯 项目结构: 桌面端/移动端分离，文件组织清晰`);
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
