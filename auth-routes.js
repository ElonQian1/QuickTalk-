module.exports = function(app, database) {

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

// 获取店铺员工列表
app.get('/api/shops/:shopId/employees', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const shop = database.shops.get(shopId);
        
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查权限：只有店主和管理员可以查看员工列表
        const userShop = shop.members.find(m => m.userId === req.user.id);
        if (!userShop || !['owner', 'manager'].includes(userShop.role)) {
            return res.status(403).json({ error: '无权限查看员工列表' });
        }
        
        // 获取员工信息
        const employees = shop.members
            .filter(member => member.role !== 'owner')
            .map(member => {
                const user = database.users.get(member.userId);
                return {
                    id: member.userId,
                    username: user.username,
                    role: member.role,
                    joinedAt: member.joinedAt
                };
            });
        
        res.json({ success: true, employees });
    } catch (error) {
        console.error('获取员工列表错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 添加员工到店铺
app.post('/api/shops/:shopId/employees', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { username, role } = req.body;
        
        if (!username || !role) {
            return res.status(400).json({ error: '用户名和角色为必填项' });
        }
        
        if (!['employee', 'manager'].includes(role)) {
            return res.status(400).json({ error: '无效的角色类型' });
        }
        
        const shop = database.shops.get(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查权限：只有店主可以添加员工
        const userShop = shop.members.find(m => m.userId === req.user.id);
        if (!userShop || userShop.role !== 'owner') {
            return res.status(403).json({ error: '只有店主可以添加员工' });
        }
        
        // 查找要添加的用户
        const targetUser = Array.from(database.users.values()).find(u => u.username === username);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 检查用户是否已经是该店铺成员
        const existingMember = shop.members.find(m => m.userId === targetUser.id);
        if (existingMember) {
            return res.status(400).json({ error: '用户已经是该店铺成员' });
        }
        
        // 添加员工
        shop.members.push({
            userId: targetUser.id,
            role: role,
            joinedAt: new Date(),
            permissions: role === 'manager' ? ['manage_chat', 'view_reports'] : ['manage_chat']
        });
        
        console.log(`👥 添加员工: ${username} 加入店铺 ${shop.name} (角色: ${role})`);
        res.json({ success: true, message: '员工添加成功' });
    } catch (error) {
        console.error('添加员工错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 移除店铺员工
app.delete('/api/shops/:shopId/employees/:employeeId', requireAuth, async (req, res) => {
    try {
        const { shopId, employeeId } = req.params;
        
        const shop = database.shops.get(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查权限：只有店主可以移除员工
        const userShop = shop.members.find(m => m.userId === req.user.id);
        if (!userShop || userShop.role !== 'owner') {
            return res.status(403).json({ error: '只有店主可以移除员工' });
        }
        
        // 查找要移除的员工
        const memberIndex = shop.members.findIndex(m => m.userId === employeeId);
        if (memberIndex === -1) {
            return res.status(404).json({ error: '员工不存在' });
        }
        
        const member = shop.members[memberIndex];
        if (member.role === 'owner') {
            return res.status(400).json({ error: '不能移除店主' });
        }
        
        // 移除员工
        shop.members.splice(memberIndex, 1);
        
        const user = database.users.get(employeeId);
        console.log(`👥 移除员工: ${user.username} 离开店铺 ${shop.name}`);
        res.json({ success: true, message: '员工移除成功' });
    } catch (error) {
        console.error('移除员工错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 更新店铺信息
app.put('/api/shops/:shopId', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { name, domain } = req.body;
        
        if (!name || !domain) {
            return res.status(400).json({ error: '店铺名称和域名为必填项' });
        }
        
        const shop = database.shops.get(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查权限：只有店主可以更新店铺信息
        const userShop = shop.members.find(m => m.userId === req.user.id);
        if (!userShop || userShop.role !== 'owner') {
            return res.status(403).json({ error: '只有店主可以更新店铺信息' });
        }
        
        // 检查域名是否重复（排除当前店铺）
        for (const [id, existingShop] of database.shops) {
            if (id !== shopId && existingShop.domain === domain) {
                return res.status(400).json({ error: '域名已被使用' });
            }
        }
        
        // 更新店铺信息
        shop.name = name;
        shop.domain = domain;
        shop.updatedAt = new Date();
        
        console.log(`🏪 更新店铺: ${name} (${domain})`);
        res.json({ success: true, message: '店铺信息更新成功', shop });
    } catch (error) {
        console.error('更新店铺错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 个人资料管理 ============

// 获取个人资料
app.get('/api/auth/profile', requireAuth, async (req, res) => {
    try {
        const user = await database.getUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 不返回密码
        const { password, ...userProfile } = user;
        res.json({ success: true, profile: userProfile });
    } catch (error) {
        console.error('获取个人资料错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 更新个人资料
app.put('/api/auth/profile', requireAuth, async (req, res) => {
    try {
        const { username, email, currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        // 验证必填字段
        if (!username || !email) {
            return res.status(400).json({ error: '用户名和邮箱为必填项' });
        }
        
        // 如果要修改密码，验证当前密码
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: '修改密码需要提供当前密码' });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({ error: '新密码长度至少6位' });
            }
            
            // 验证当前密码
            const currentUser = await database.getUserById(userId);
            const isValidPassword = await database.validatePassword(currentPassword, currentUser.password);
            if (!isValidPassword) {
                return res.status(400).json({ error: '当前密码不正确' });
            }
        }
        
        // 检查用户名是否被其他用户使用
        const existingUser = await database.getUserByUsername(username);
        if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ error: '用户名已被使用' });
        }
        
        // 检查邮箱是否被其他用户使用
        const existingEmail = await database.getUserByEmail(email);
        if (existingEmail && existingEmail.id !== userId) {
            return res.status(400).json({ error: '邮箱已被使用' });
        }
        
        // 更新用户信息
        const updateData = { username, email };
        if (newPassword) {
            updateData.password = await database.hashPassword(newPassword);
        }
        
        const updatedUser = await database.updateUser(userId, updateData);
        
        // 不返回密码
        const { password, ...userProfile } = updatedUser;
        
        console.log(`👤 用户更新个人资料: ${username}`);
        res.json({ success: true, message: '个人资料更新成功', profile: userProfile });
    } catch (error) {
        console.error('更新个人资料错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

};
