module.exports = function(app, database, modularApp = null) {

// ========== 集成新的模块化客户端API ==========
if (modularApp && modularApp.initialized) {
    console.log('🔌 集成模块化客户端API...');
    
    // 引入客户端API路由集成模块
    const { integrateClientApiRoutes } = require('./src/client-api/routes');
    
    // 集成客户端API路由
    integrateClientApiRoutes(app, modularApp);
}

// 用户认证中间件
function requireAuth(req, res, next) {
    // 从多种来源获取 sessionId：header、body、cookie
    const sessionId = req.headers['x-session-id'] || 
                     req.body.sessionId || 
                     (req.headers.cookie && req.headers.cookie.split(';').find(c => c.trim().startsWith('sessionId='))?.split('=')[1]);
    
    console.log('🔍 [AUTH] 认证检查:', { sessionId: sessionId ? sessionId.substring(0, 20) + '...' : 'null', path: req.path });
    
    if (!sessionId) {
        console.log('❌ [AUTH] 没有会话ID');
        return res.status(401).json({ error: '需要登录' });
    }
    
    database.validateSession(sessionId).then(user => {
        if (!user) {
            console.log('❌ [AUTH] 会话验证失败');
            return res.status(401).json({ error: '会话已过期，请重新登录' });
        }
        console.log('✅ [AUTH] 认证成功:', { userId: user.id, role: user.role });
        req.user = user;
        req.sessionId = sessionId;
        next();
    }).catch(err => {
        console.log('❌ [AUTH] 认证异常:', err.message);
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
        const { username, password, email, role = 'user' } = req.body;
        
        if (!username || !password || !email) {
            return res.status(400).json({ error: '用户名、密码和邮箱为必填项' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: '密码长度至少6位' });
        }
        
        // 确保只有超级管理员才能指定特殊角色，其他用户默认为普通用户
        const finalRole = role === 'super_admin' ? 'user' : (role || 'user');
        
        const user = await database.registerUser({ username, password, email, role: finalRole });
        
        console.log(`👤 新用户注册: ${username} (${finalRole})`);
        res.json({ 
            success: true, 
            message: '注册成功，您可以创建店铺成为店主',
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
        // 使用统一的用户信息获取函数
        const completeUserInfo = await database.getCompleteUserInfo(req.user.id);
        res.json({
            success: true,
            ...completeUserInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取当前用户信息（别名）
app.get('/api/auth/user', requireAuth, async (req, res) => {
    try {
        // 使用统一的用户信息获取函数
        const completeUserInfo = await database.getCompleteUserInfo(req.user.id);
        res.json({
            success: true,
            ...completeUserInfo
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建店铺
app.post('/api/shops', requireAuth, async (req, res) => {
    try {
        const { name, domain, description } = req.body;
        
        if (!name || !domain || !description) {
            return res.status(400).json({ error: '店铺名称、域名和业务描述为必填项' });
        }
        
        const shop = await database.createShop(req.user.id, { name, domain, description });
        
        console.log(`🏪 创建新店铺: ${name} by ${req.user.username}`);
        res.json({
            success: true,
            message: '店铺创建成功，等待管理员审核',
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
app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        await database.deleteSession(req.sessionId);
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
        const members = shop.members || [];
        const userShop = members.find(m => m.userId === req.user.id);
        if (!userShop || !['owner', 'manager'].includes(userShop.role)) {
            return res.status(403).json({ error: '无权限查看员工列表' });
        }
        
        // 获取员工信息
        const employees = members
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
        const members = shop.members || [];
        const userShop = members.find(m => m.userId === req.user.id);
        if (!userShop || userShop.role !== 'owner') {
            return res.status(403).json({ error: '只有店主可以添加员工' });
        }
        
        // 查找要添加的用户
        const targetUser = Array.from(database.users.values()).find(u => u.username === username);
        if (!targetUser) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        // 检查用户是否已经是该店铺成员
        const existingMember = members.find(m => m.userId === targetUser.id);
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
        
        // 同时在用户-店铺关联表中添加关系
        const userShops = database.userShops.get(targetUser.id) || [];
        userShops.push({
            shopId: shopId,
            role: role,
            joinedAt: new Date(),
            permissions: role === 'manager' ? ['manage_chat', 'view_reports'] : ['manage_chat']
        });
        database.userShops.set(targetUser.id, userShops);
        
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
        
        // 同时从用户-店铺关联表中移除关系
        const userShops = database.userShops.get(employeeId) || [];
        const userShopIndex = userShops.findIndex(us => us.shopId === shopId);
        if (userShopIndex !== -1) {
            userShops.splice(userShopIndex, 1);
            database.userShops.set(employeeId, userShops);
        }
        
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
        
        // 使用SQLite数据库方法获取店铺
        const shop = await database.getShopById(shopId);
        if (!shop) {
            return res.status(404).json({ error: '店铺不存在' });
        }
        
        // 检查权限：只有店主可以更新店铺信息
        if (shop.owner_id !== req.user.id) {
            return res.status(403).json({ error: '只有店主可以更新店铺信息' });
        }
        
        // 检查域名是否重复（排除当前店铺）
        const existingShopWithDomain = await database.getShopByDomain(domain);
        if (existingShopWithDomain && existingShopWithDomain.id !== shopId) {
            return res.status(400).json({ error: '域名已被使用' });
        }
        
        // 更新店铺信息
        await database.updateShop(shopId, {
            name: name,
            domain: domain
        });
        
        // 重新获取更新后的店铺信息
        const updatedShop = await database.getShopById(shopId);
        
        console.log(`🏪 更新店铺: ${name} (${domain})`);
        res.json({ success: true, message: '店铺信息更新成功', shop: updatedShop });
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

// ============ 超级管理员专用API ============

// 获取所有店主及其店铺统计
app.get('/api/admin/shop-owners-stats', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { keyword } = req.query;
        const stats = await database.searchShopOwners(keyword);
        
        console.log(`📊 超级管理员查看店主统计: ${req.user.username}, 关键词: ${keyword || '全部'}`);
        res.json({
            success: true,
            stats,
            total: stats.length
        });
    } catch (error) {
        console.error('获取店主统计错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 获取特定店主详细信息
app.get('/api/admin/shop-owner/:ownerId', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { ownerId } = req.params;
        const details = await database.getShopOwnerDetails(ownerId);
        
        console.log(`👤 超级管理员查看店主详情: ${details.owner.username}`);
        res.json({
            success: true,
            ...details
        });
    } catch (error) {
        console.error('获取店主详情错误:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 获取系统整体统计
app.get('/api/admin/system-stats', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const stats = await database.getSystemStats();
        
        console.log(`📈 超级管理员查看系统统计: ${req.user.username}`);
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('获取系统统计错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 切换店主账号状态（启用/禁用）
app.put('/api/admin/shop-owner/:ownerId/status', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { status } = req.body;
        
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ error: '无效的状态值' });
        }
        
        const updatedUser = await database.toggleShopOwnerStatus(ownerId, status);
        
        console.log(`🔄 超级管理员${status === 'active' ? '启用' : '禁用'}店主: ${updatedUser.username}`);
        res.json({
            success: true,
            message: `店主账号已${status === 'active' ? '启用' : '禁用'}`,
            user: { ...updatedUser, password: undefined }
        });
    } catch (error) {
        console.error('切换店主状态错误:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// 强制删除店主及其所有店铺（危险操作）
app.delete('/api/admin/shop-owner/:ownerId', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { ownerId } = req.params;
        const { confirm } = req.body;
        
        if (!confirm || confirm !== 'DELETE_ALL_DATA') {
            return res.status(400).json({ error: '需要确认删除操作' });
        }
        
        const user = await database.getUserById(ownerId);
        if (!user || user.role !== 'shop_owner') {
            return res.status(404).json({ error: '店主不存在' });
        }
        
        // 获取店主的所有店铺
        const userShops = database.userShops.get(ownerId) || [];
        const ownedShops = userShops.filter(us => us.role === 'owner');
        
        // 删除所有店铺
        for (const us of ownedShops) {
            database.shops.delete(us.shopId);
        }
        
        // 删除用户-店铺关系
        database.userShops.delete(ownerId);
        
        // 删除用户
        database.users.delete(ownerId);
        
        console.log(`🗑️ 超级管理员删除店主: ${user.username} 及其 ${ownedShops.length} 个店铺`);
        res.json({
            success: true,
            message: `已删除店主 ${user.username} 及其 ${ownedShops.length} 个店铺`
        });
    } catch (error) {
        console.error('删除店主错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============ 店铺审核管理 ============

// 获取待审核店铺列表
app.get('/api/admin/pending-shops', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const pendingShops = await database.getPendingShops();
        
        console.log(`📋 超级管理员查看待审核店铺: ${req.user.username}, 数量: ${pendingShops.length}`);
        res.json({
            success: true,
            shops: pendingShops,
            total: pendingShops.length
        });
    } catch (error) {
        console.error('获取待审核店铺错误:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 审核店铺（通过/拒绝）
app.put('/api/admin/review-shop/:shopId', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
        const { shopId } = req.params;
        const { approved, note } = req.body;
        
        if (typeof approved !== 'boolean') {
            return res.status(400).json({ error: '审核结果必须为布尔值' });
        }
        
        const reviewedShop = await database.reviewShop(shopId, { approved, note }, req.user.id);
        
        console.log(`🔍 超级管理员审核店铺: ${reviewedShop.name} - ${approved ? '通过' : '拒绝'}`);
        res.json({
            success: true,
            message: `店铺${approved ? '审核通过' : '审核拒绝'}`,
            shop: reviewedShop
        });
    } catch (error) {
        console.error('审核店铺错误:', error.message);
        res.status(400).json({ error: error.message });
    }
});

// ============ 对话和消息相关API ============

// 获取店铺的对话列表
app.get('/api/shops/:shopId/conversations', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.params;
        
        // 检查用户是否有权限访问该店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限访问该店铺的对话' });
        }
        
        const conversations = await database.getShopConversations(shopId);
        res.json({ conversations });
    } catch (error) {
        console.error('获取店铺对话列表失败:', error.message);
        res.status(500).json({ error: '获取对话列表失败' });
    }
});

// 获取对话信息
app.get('/api/conversations/:conversationId', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // conversationId 格式: shopId_userId (例如: shop_123_user_456)
        const parts = conversationId.split('_');
        if (parts.length < 3) {
            return res.status(400).json({ error: '无效的对话ID格式' });
        }
        
        const shopId = parts.slice(0, 2).join('_'); // shop_123
        const userId = parts.slice(2).join('_'); // user_456
        
        // 检查用户是否有权限访问该店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限访问该对话' });
        }
        
        // 获取对话信息
        const conversation = await database.getAsync(`
            SELECT c.*, s.name as shop_name 
            FROM conversations c
            JOIN shops s ON c.shop_id = s.id
            WHERE c.shop_id = ? AND c.user_id = ?
        `, [shopId, userId]);
        
        if (!conversation) {
            return res.status(404).json({ error: '对话不存在' });
        }
        
        res.json({
            id: conversationId,
            customer_name: conversation.user_name || `用户${userId}`,
            customer_id: userId,
            shop_name: conversation.shop_name,
            shop_id: shopId,
            last_message: conversation.last_message,
            last_message_at: conversation.last_message_at,
            unread_count: conversation.unread_count,
            status: conversation.status
        });
    } catch (error) {
        console.error('获取对话信息失败:', error.message);
        res.status(500).json({ error: '获取对话信息失败' });
    }
});

// 获取对话的消息列表
app.get('/api/conversations/:conversationId/messages', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 100 } = req.query;
        
        console.log('🔍 [DEBUG] 获取对话消息:', {
            conversationId,
            userId: req.user.id,
            userRole: req.user.role
        });
        
        // conversationId 格式: shopId_userId (例如: shop_1757591780450_1_brand_new_user_810960)
        // 需要正确解析包含多个下划线的用户ID
        
        // 先获取用户的店铺列表，用于正确分割 conversationId
        const userShops = await database.getUserShops(req.user.id);
        console.log('🔍 [DEBUG] 用户店铺列表:', userShops.map(s => ({ id: s.id, name: s.name })));
        
        // 查找匹配的店铺ID来正确分割conversationId
        let shopId = null;
        let userId = null;
        
        for (const shop of userShops) {
            if (conversationId.startsWith(shop.id + '_')) {
                shopId = shop.id;
                userId = conversationId.substring(shop.id.length + 1); // +1 for the underscore
                break;
            }
        }
        
        // 如果是超级管理员，尝试从conversationId中提取shop_开头的部分
        if (!shopId && req.user.role === 'super_admin') {
            const shopMatch = conversationId.match(/^(shop_\d+_\d+)_(.+)$/);
            if (shopMatch) {
                shopId = shopMatch[1];
                userId = shopMatch[2];
            }
        }
        
        if (!shopId || !userId) {
            return res.status(400).json({ error: '无效的对话ID格式或无权限访问该对话' });
        }
        
        console.log('🔍 [DEBUG] 解析对话ID:', { conversationId, shopId, userId });
        
        // 权限检查 - 由于我们已经在上面根据用户店铺列表进行了匹配，这里只需要确认访问权限
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        console.log('🔍 [DEBUG] 权限检查:', {
            isSuperAdmin: req.user.role === 'super_admin',
            shopMatch: userShops.some(shop => shop.id === shopId),
            hasAccess
        });
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限访问该对话的消息' });
        }
        
        const messages = await database.getConversationMessages(shopId, userId, parseInt(limit));
        res.json(messages);
    } catch (error) {
        console.error('获取对话消息失败:', error.message);
        res.status(500).json({ error: '获取对话消息失败' });
    }
});

// 发送消息到对话
app.post('/api/conversations/:conversationId/messages', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: '消息内容不能为空' });
        }
        
        // conversationId 格式: shopId_userId (例如: shop_1757591780450_1_user_1757591780450_3)
        // 需要正确解析包含多个下划线的ID
        const userIndex = conversationId.lastIndexOf('_user_');
        if (userIndex === -1) {
            return res.status(400).json({ error: '无效的对话ID格式' });
        }
        
        const shopId = conversationId.substring(0, userIndex);
        const userId = conversationId.substring(userIndex + 1); // 只跳过开头的"_"，保留"user_"前缀
        
        console.log(`🔍 解析对话ID: conversationId=${conversationId}, shopId=${shopId}, userId=${userId}`);
        
        // 检查用户是否有权限访问该店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限向该对话发送消息' });
        }
        
        // 创建消息
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await database.runAsync(`
            INSERT INTO messages (id, shop_id, user_id, admin_id, message, sender, created_at)
            VALUES (?, ?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP)
        `, [messageId, shopId, userId, req.user.id, content.trim()]);
        
        // 更新对话的最后消息
        await database.runAsync(`
            UPDATE conversations 
            SET last_message = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE shop_id = ? AND user_id = ?
        `, [content.trim(), shopId, userId]);
        
        // 🚀 新增：通过WebSocket推送消息给客户端
        let webSocketPushed = false;
        if (global.wsManager) {
            try {
                webSocketPushed = await global.wsManager.pushMessageToUser(userId, content.trim(), 'admin');
                console.log(`📨 管理后台消息WebSocket推送: ${userId} -> "${content.trim()}" (${webSocketPushed ? '成功' : '失败'})`);
            } catch (error) {
                console.error('❌ WebSocket推送失败:', error);
            }
        }
        
        res.json({
            success: true,
            message: {
                id: messageId,
                content: content.trim(),
                sender_type: 'admin',
                sender_id: req.user.id,
                created_at: new Date().toISOString()
            },
            // 添加WebSocket推送状态信息
            webSocketPushed: webSocketPushed
        });
    } catch (error) {
        console.error('发送消息失败:', error.message);
        res.status(500).json({ error: '发送消息失败' });
    }
});

// 标记对话为已读
app.put('/api/conversations/:conversationId/read', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // 使用改进的解析逻辑
        const userShops = await database.getUserShops(req.user.id);
        
        let shopId = null;
        let userId = null;
        
        for (const shop of userShops) {
            if (conversationId.startsWith(shop.id + '_')) {
                shopId = shop.id;
                userId = conversationId.substring(shop.id.length + 1);
                break;
            }
        }
        
        if (!shopId && req.user.role === 'super_admin') {
            const shopMatch = conversationId.match(/^(shop_\d+_\d+)_(.+)$/);
            if (shopMatch) {
                shopId = shopMatch[1];
                userId = shopMatch[2];
            }
        }
        
        if (!shopId || !userId) {
            return res.status(400).json({ error: '无效的对话ID格式或无权限访问该对话' });
        }
        
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限标记该对话为已读' });
        }
        
        await database.markMessagesAsRead(shopId, userId, req.user.id);
        
        res.json({ success: true, message: '对话已标记为已读' });
    } catch (error) {
        console.error('标记对话为已读失败:', error.message);
        res.status(500).json({ error: '标记对话为已读失败' });
    }
});

// 标记对话为已读 - 兼容前端的mark-read路径
app.post('/api/conversations/:conversationId/mark-read', requireAuth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // 使用改进的解析逻辑
        const userShops = await database.getUserShops(req.user.id);
        
        let shopId = null;
        let userId = null;
        
        for (const shop of userShops) {
            if (conversationId.startsWith(shop.id + '_')) {
                shopId = shop.id;
                userId = conversationId.substring(shop.id.length + 1);
                break;
            }
        }
        
        if (!shopId && req.user.role === 'super_admin') {
            const shopMatch = conversationId.match(/^(shop_\d+_\d+)_(.+)$/);
            if (shopMatch) {
                shopId = shopMatch[1];
                userId = shopMatch[2];
            }
        }
        
        if (!shopId || !userId) {
            return res.status(400).json({ error: '无效的对话ID格式或无权限访问该对话' });
        }
        
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限标记该对话为已读' });
        }
        
        await database.markMessagesAsRead(shopId, userId, req.user.id);
        
        res.json({ success: true, message: '对话已标记为已读' });
    } catch (error) {
        console.error('标记对话为已读失败:', error.message);
        res.status(500).json({ error: '标记对话为已读失败' });
    }
});

// ========== 集成代码相关API ==========

// 生成集成代码
app.post('/api/integration/generate-code', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.body;
        
        if (!shopId) {
            return res.status(400).json({ error: '店铺ID不能为空' });
        }
        
        // 检查用户是否有权限访问该店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限访问该店铺' });
        }
        
        // 生成或获取API密钥
        let apiKey = await database.getShopApiKey(shopId);
        if (!apiKey) {
            apiKey = generateApiKey();
            await database.saveShopApiKey(shopId, apiKey);
        }
        
        // 生成集成代码
        const integrationCode = generateIntegrationCodeTemplate(shopId, apiKey);
        
        res.json({
            success: true,
            apiKey: apiKey,
            integrationCode: integrationCode
        });
    } catch (error) {
        console.error('生成集成代码失败:', error.message);
        res.status(500).json({ error: '生成集成代码失败' });
    }
});

// 重新生成API密钥
app.post('/api/integration/regenerate-key', requireAuth, async (req, res) => {
    try {
        const { shopId } = req.body;
        
        if (!shopId) {
            return res.status(400).json({ error: '店铺ID不能为空' });
        }
        
        // 检查用户是否有权限访问该店铺
        const userShops = await database.getUserShops(req.user.id);
        const hasAccess = req.user.role === 'super_admin' || 
                        userShops.some(shop => shop.id === shopId);
        
        if (!hasAccess) {
            return res.status(403).json({ error: '没有权限访问该店铺' });
        }
        
        // 生成新的API密钥
        const newApiKey = generateApiKey();
        await database.saveShopApiKey(shopId, newApiKey);
        
        // 生成新的集成代码
        const integrationCode = generateIntegrationCodeTemplate(shopId, newApiKey);
        
        res.json({
            success: true,
            apiKey: newApiKey,
            integrationCode: integrationCode
        });
    } catch (error) {
        console.error('重新生成API密钥失败:', error.message);
        res.status(500).json({ error: '重新生成API密钥失败' });
    }
});

// 生成API密钥的辅助函数
function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 生成集成代码模板的辅助函数
function generateIntegrationCodeTemplate(shopId, apiKey) {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3030';
    
    return `<!-- QuickTalk客服系统集成代码 -->
<script>
(function() {
    // 配置
    var config = {
        shopId: '${shopId}',
        apiKey: '${apiKey}',
        serverUrl: '${serverUrl}',
        chatButtonText: '💬 在线客服',
        chatButtonColor: '#007AFF',
        position: 'bottom-right'
    };
    
    // 创建聊天按钮
    var chatButton = document.createElement('div');
    chatButton.id = 'quicktalk-chat-button';
    chatButton.innerHTML = config.chatButtonText;
    chatButton.style.cssText = \`
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: \${config.chatButtonColor};
        color: white;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 10000;
        transition: all 0.3s ease;
    \`;
    
    // 鼠标悬停效果
    chatButton.onmouseover = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
    };
    
    chatButton.onmouseout = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    };
    
    // 点击打开聊天窗口
    chatButton.onclick = function() {
        openChatWindow();
    };
    
    // 打开聊天窗口
    function openChatWindow() {
        var chatUrl = config.serverUrl + '/chat?shop=' + encodeURIComponent(config.shopId) + 
                     '&key=' + encodeURIComponent(config.apiKey);
        
        window.open(chatUrl, 'quicktalk-chat', 
                   'width=400,height=600,resizable=yes,scrollbars=yes');
    }
    
    // 页面加载完成后添加按钮
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.appendChild(chatButton);
        });
    } else {
        document.body.appendChild(chatButton);
    }
})();
</script>
<!-- End QuickTalk客服系统集成代码 -->`;
}

};
