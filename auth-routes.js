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

// 店主权限检查
function requireShopOwner(req, res, next) {
    if (!['super_admin', 'shop_owner'].includes(req.user.role)) {
        return res.status(403).json({ error: '需要店主权限' });
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

// 添加员工到店铺
app.post('/api/shops/:shopId/staff', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { staffId, role = 'employee', permissions = ['view_chats', 'handle_chats'] } = req.body;
        
        // 检查用户是否有权限管理该店铺的员工
        const userShops = await database.getUserShops(req.user.id);
        const shop = userShops.find(s => s.id === shopId);
        
        if (!shop || (!shop.permissions.includes('manage_staff') && req.user.role !== 'super_admin')) {
            return res.status(403).json({ error: '没有权限管理该店铺员工' });
        }
        
        await database.addStaffToShop(shopId, staffId, role, permissions);
        
        console.log(`👥 添加员工到店铺: ${staffId} -> ${shopId}`);
        res.json({
            success: true,
            message: '员工添加成功'
        });
    } catch (error) {
        console.error('添加员工失败:', error.message);
        res.status(400).json({ error: error.message });
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

// 根据店铺过滤客服消息
app.get('/api/messages', requireAuth, (req, res) => {
    const { shopId, userId, lastId = 0 } = req.query;
    
    try {
        // 检查用户是否有权限访问该店铺的消息
        database.getUserShops(req.user.id).then(userShops => {
            const hasAccess = req.user.role === 'super_admin' || 
                            userShops.some(shop => shop.id === shopId && 
                                          shop.permissions.includes('view_chats'));
            
            if (!hasAccess) {
                return res.status(403).json({ error: '没有权限查看该店铺的消息' });
            }
            
            // 这里应该根据shopId过滤消息
            // 当前返回用户的消息队列
            const userMessages = messageQueue.get(userId) || [];
            const newMessages = userMessages.filter(msg => msg.id > parseInt(lastId));
            
            res.json({ messages: newMessages });
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
