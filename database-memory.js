// 数据库模拟层 - 生产环境请替换为真实数据库
class Database {
    constructor() {
        // 模拟数据存储
        this.users = new Map(); // 用户表
        this.shops = new Map(); // 店铺表
        this.userShops = new Map(); // 用户-店铺关系表
        this.sessions = new Map(); // 会话表
        
        // 充值续费相关
        this.renewalOrders = new Map(); // 续费订单
        this.paymentQRCodes = new Map(); // 支付二维码缓存
        
        // 付费开通相关
        this.activationOrders = new Map(); // 付费开通订单
        this.activationQRCodes = new Map(); // 付费开通二维码缓存
        
        // 初始化一些测试数据
        this.initTestData();
    }
    
    initTestData() {
        // 创建超级管理员
        const superAdminId = 'admin_' + Date.now();
        this.users.set(superAdminId, {
            id: superAdminId,
            username: 'admin',
            password: this.hashPassword('admin123'),
            email: 'admin@system.com',
            role: 'super_admin',
            status: 'active',
            createdAt: new Date(),
            lastLoginAt: null
        });
        
        // 创建测试店主
        const shopOwnerId = 'user_' + Date.now();
        this.users.set(shopOwnerId, {
            id: shopOwnerId,
            username: 'shop_owner',
            password: this.hashPassword('123456'),
            email: 'owner@shop.com',
            role: 'shop_owner',
            status: 'active',
            createdAt: new Date(),
            lastLoginAt: null
        });
        
        // 创建测试店铺
        const shopId = 'shop_' + Date.now();
        this.shops.set(shopId, {
            id: shopId,
            name: '测试店铺',
            domain: 'test-shop.com',
            ownerId: shopOwnerId,
            status: 'active',
            createdAt: new Date(),
            api_key: 'sk_test_1234567890abcdef1234567890abcdef',
            apiKeyCreatedAt: new Date()
        });
        
        // 建立用户-店铺关系
        this.userShops.set(shopOwnerId, [{
            shopId: shopId,
            role: 'owner',
            permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
        }]);

        // 创建待审核测试店铺（用于测试付费开通）
        const pendingShopId = 'pending_shop_' + Date.now();
        this.shops.set(pendingShopId, {
            id: pendingShopId,
            name: '待审核测试店铺',
            domain: 'pending-shop.com',
            description: '这是一个待审核的测试店铺，可以用于测试付费开通功能',
            ownerId: shopOwnerId,
            status: 'pending', // 待审核状态
            createdAt: new Date(),
            api_key: null,
            apiKeyCreatedAt: null
        });

        // 更新用户-店铺关系，包含待审核店铺
        this.userShops.set(shopOwnerId, [
            {
                shopId: shopId,
                role: 'owner',
                permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
            },
            {
                shopId: pendingShopId,
                role: 'owner',
                permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
            }
        ]);
        
        console.log('🎯 初始化测试数据完成');
        console.log('📋 超级管理员: admin / admin123');
        console.log('🏪 店主账号: shop_owner / 123456');
    }
    
    // 简单密码哈希 (生产环境请使用 bcrypt)
    hashPassword(password) {
        return Buffer.from(password).toString('base64');
    }
    
    // 验证密码
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }
    
    // 用户注册
    async registerUser(userData) {
        const { username, password, email, role = 'user' } = userData;
        
        // 检查用户名是否已存在
        for (const user of this.users.values()) {
            if (user.username === username) {
                throw new Error('用户名已存在');
            }
            if (user.email === email) {
                throw new Error('邮箱已存在');
            }
        }
        
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newUser = {
            id: userId,
            username,
            password: this.hashPassword(password),
            email,
            role,
            status: 'active',
            createdAt: new Date(),
            lastLoginAt: null
        };
        
        this.users.set(userId, newUser);
        
        // 返回不包含密码的用户信息
        const { password: _, ...userInfo } = newUser;
        return userInfo;
    }
    
    // 用户登录
    async loginUser(username, password) {
        let user = null;
        for (const u of this.users.values()) {
            if (u.username === username) {
                user = u;
                break;
            }
        }
        
        if (!user || !this.verifyPassword(password, user.password)) {
            throw new Error('用户名或密码错误');
        }
        
        // 更新最后登录时间
        user.lastLoginAt = new Date();
        
        // 创建会话
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.sessions.set(sessionId, {
            userId: user.id,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时
        });
        
        // 获取用户的店铺权限
        const userShops = this.userShops.get(user.id) || [];
        const shops = userShops.map(us => {
            const shop = this.shops.get(us.shopId);
            return {
                ...shop,
                userRole: us.role,
                permissions: us.permissions
            };
        });
        
        const { password: _, ...userInfo } = user;
        return {
            sessionId,
            user: userInfo,
            shops
        };
    }
    
    // 创建店铺（需要审核）
    async createShop(ownerId, shopData) {
        const { name, domain, description = '' } = shopData;
        
        // 检查域名是否已存在
        for (const shop of this.shops.values()) {
            if (shop.domain === domain) {
                throw new Error('域名已存在');
            }
        }
        
        const shopId = 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const newShop = {
            id: shopId,
            name,
            domain,
            description,
            ownerId,
            status: 'pending', // 改为待审核状态
            approvalStatus: 'pending', // 新增审核状态字段
            submittedAt: new Date(), // 提交时间
            reviewedAt: null, // 审核时间
            reviewedBy: null, // 审核人
            reviewNote: '', // 审核备注
            createdAt: new Date(),
            expiryDate: null, // 到期时间，审核通过后设置
            members: [] // 初始化成员列表
        };
        
        this.shops.set(shopId, newShop);
        
        // 将店主添加到用户店铺关联中（即使是待审核状态也要显示）
        const userShops = this.userShops.get(ownerId) || [];
        userShops.push({
            shopId: shopId,
            role: 'owner',
            joinedAt: new Date(),
            permissions: ['view_shop'] // 待审核状态只有查看权限
        });
        this.userShops.set(ownerId, userShops);
        
        console.log(`🏪 新店铺申请: ${name} (${domain}) 等待审核`);
        
        return newShop;
    }
    
    // 店铺审核方法
    async reviewShop(shopId, reviewData, reviewerId) {
        const { approved, note = '' } = reviewData;
        const shop = this.shops.get(shopId);
        
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        if (shop.approvalStatus !== 'pending') {
            throw new Error('该店铺已经审核过了');
        }
        
        // 更新审核状态
        shop.approvalStatus = approved ? 'approved' : 'rejected';
        shop.status = approved ? 'active' : 'rejected';
        shop.reviewedAt = new Date();
        shop.reviewedBy = reviewerId;
        shop.reviewNote = note;
        
        if (approved) {
            // 设置到期时间（审核通过后30天）
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            shop.expiryDate = expiryDate;
            
            // 审核通过，更新店主的店铺权限
            const userShops = this.userShops.get(shop.ownerId) || [];
            const existingShop = userShops.find(us => us.shopId === shopId);
            
            if (existingShop) {
                // 更新现有权限
                existingShop.permissions = ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop'];
            } else {
                // 如果不存在则添加（兜底逻辑）
                userShops.push({
                    shopId,
                    role: 'owner',
                    joinedAt: new Date(),
                    permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
                });
            }
            this.userShops.set(shop.ownerId, userShops);
            
            // 将店主添加到店铺成员列表
            shop.members.push({
                userId: shop.ownerId,
                role: 'owner',
                joinedAt: new Date(),
                permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
            });
            
            console.log(`✅ 店铺审核通过: ${shop.name} (${shop.domain})`);
        } else {
            console.log(`❌ 店铺审核拒绝: ${shop.name} (${shop.domain}) - ${note}`);
        }
        
        return shop;
    }
    
    // 更新待审核店铺信息
    async updatePendingShop(userId, shopId, updates) {
        const shop = this.shops.get(shopId);
        
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        if (shop.ownerId !== userId) {
            throw new Error('无权限修改此店铺');
        }
        
        if (shop.approvalStatus !== 'pending') {
            throw new Error('只能修改待审核的店铺');
        }
        
        const { name, domain, description } = updates;
        
        // 验证域名唯一性（排除当前店铺）
        if (domain && domain !== shop.domain) {
            for (const [id, existingShop] of this.shops) {
                if (id !== shopId && existingShop.domain === domain) {
                    throw new Error('域名已存在');
                }
            }
        }
        
        // 更新店铺信息
        if (name) shop.name = name;
        if (domain) shop.domain = domain;
        if (description !== undefined) shop.description = description;
        
        shop.updatedAt = new Date();
        
        console.log(`✏️ 店铺信息更新: ${shop.name} by user ${userId}`);
        
        return shop;
    }

    // 重新提交店铺审核
    async resubmitShopForReview(userId, shopId) {
        const shop = this.shops.get(shopId);
        
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        if (shop.ownerId !== userId) {
            throw new Error('无权限操作此店铺');
        }
        
        if (shop.approvalStatus === 'pending') {
            throw new Error('店铺已在审核中，无需重复提交');
        }
        
        // 重置审核状态
        shop.approvalStatus = 'pending';
        shop.submittedAt = new Date();
        shop.reviewedAt = null;
        shop.reviewedBy = null;
        shop.reviewNote = '';
        
        console.log(`🔄 店铺重新提交审核: ${shop.name} by user ${userId}`);
        
        return shop;
    }
    
    // 获取待审核的店铺
    async getPendingShops() {
        const pendingShops = [];
        for (const shop of this.shops.values()) {
            if (shop.approvalStatus === 'pending') {
                const owner = this.users.get(shop.ownerId);
                pendingShops.push({
                    ...shop,
                    ownerInfo: {
                        id: owner.id,
                        username: owner.username,
                        email: owner.email
                    }
                });
            }
        }
        return pendingShops;
    }
    
    // 添加员工到店铺
    async addStaffToShop(shopId, staffId, role = 'employee', permissions = ['view_chats', 'handle_chats']) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        const user = this.users.get(staffId);
        if (!user) {
            throw new Error('用户不存在');
        }
        
        const userShops = this.userShops.get(staffId) || [];
        
        // 检查是否已经是该店铺成员
        const existingShop = userShops.find(us => us.shopId === shopId);
        if (existingShop) {
            throw new Error('用户已经是该店铺成员');
        }
        
        userShops.push({
            shopId,
            role,
            permissions
        });
        this.userShops.set(staffId, userShops);
        
        return true;
    }
    
    // 获取用户的店铺列表
    async getUserShops(userId) {
        const userShops = this.userShops.get(userId) || [];
        return userShops.map(us => {
            const shop = this.shops.get(us.shopId);
            return {
                ...shop,
                userRole: us.role,
                permissions: us.permissions
            };
        });
    }
    
    // 验证会话
    async validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }
        
        if (session.expiresAt < new Date()) {
            this.sessions.delete(sessionId);
            return null;
        }
        
        const user = this.users.get(session.userId);
        if (!user) {
            return null;
        }
        
        const { password: _, ...userInfo } = user;
        return userInfo;
    }
    
    // 获取所有用户 (仅超级管理员)
    async getAllUsers() {
        return Array.from(this.users.values()).map(user => {
            const { password: _, ...userInfo } = user;
            return userInfo;
        });
    }
    
    // 获取所有店铺 (仅超级管理员)
    async getAllShops() {
        return Array.from(this.shops.values()).map(shop => ({
            ...shop,
            userCount: this.getShopUserCount(shop.id)
        }));
    }
    
    // 获取店铺用户数量
    getShopUserCount(shopId) {
        return Array.from(this.users.values()).filter(user => user.shopId === shopId).length;
    }
    
    // 更新店铺API密钥
    async updateShopApiKey(shopId, apiKey) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        shop.api_key = apiKey;
        shop.updatedAt = new Date();
        
        console.log(`🔑 店铺 "${shop.name}" API密钥已更新`);
        return shop;
    }
    
    // 通过API密钥查找店铺
    async getShopByApiKey(apiKey) {
        for (const shop of this.shops.values()) {
            if (shop.api_key === apiKey) {
                return shop;
            }
        }
        return null;
    }
    
    // 验证API密钥
    async verifyApiKey(apiKey, domain = null) {
        const shop = await this.getShopByApiKey(apiKey);
        if (!shop) {
            return { valid: false, reason: 'API密钥无效' };
        }
        
        // 如果提供了域名，验证域名匹配
        if (domain) {
            const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
            const shopDomain = shop.domain.toLowerCase().replace(/^www\./, '');
            
            if (normalizedDomain !== shopDomain && 
                !normalizedDomain.endsWith('.' + shopDomain) &&
                normalizedDomain !== 'localhost') {
                return { 
                    valid: false, 
                    reason: '域名不匹配',
                    shop: shop
                };
            }
        }
        
        return { 
            valid: true, 
            shop: shop,
            reason: '验证通过'
        };
    }
    
    // 根据ID获取用户
    async getUserById(userId) {
        return this.users.get(userId) || null;
    }
    
    // 根据邮箱获取用户
    async getUserByEmail(email) {
        for (let user of this.users.values()) {
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }
    
    // 更新用户信息
    async updateUser(userId, updateData) {
        const user = this.users.get(userId);
        if (!user) {
            throw new Error('用户不存在');
        }
        
        // 更新用户数据
        const updatedUser = {
            ...user,
            ...updateData,
            updatedAt: new Date()
        };
        
        this.users.set(userId, updatedUser);
        return updatedUser;
    }
    
    // 根据用户名获取用户
    async getUserByUsername(username) {
        for (let user of this.users.values()) {
            if (user.username === username) {
                return user;
            }
        }
        return null;
    }
    
    // 验证密码
    async validatePassword(plainPassword, hashedPassword) {
        // 在真实环境中，这里应该使用bcrypt等库进行密码验证
        return this.hashPassword(plainPassword) === hashedPassword;
    }

    // ============ 超级管理员专用方法 ============

    // 获取所有店主及其店铺统计
    async getShopOwnersStats() {
        const stats = [];
        
        // 遍历所有用户，找出店主
        for (const user of this.users.values()) {
            if (user.role === 'shop_owner') {
                const userShops = this.userShops.get(user.id) || [];
                const ownedShops = userShops.filter(us => us.role === 'owner');
                
                const shopDetails = ownedShops.map(us => {
                    const shop = this.shops.get(us.shopId);
                    return {
                        ...shop,
                        memberCount: this.getShopMemberCount(us.shopId)
                    };
                });
                
                stats.push({
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        createdAt: user.createdAt,
                        lastLoginAt: user.lastLoginAt
                    },
                    shopsCount: ownedShops.length,
                    shops: shopDetails,
                    totalMembers: shopDetails.reduce((sum, shop) => sum + shop.memberCount, 0)
                });
            }
        }
        
        return stats;
    }

    // 获取店铺成员数量
    getShopMemberCount(shopId) {
        let count = 0;
        for (const userShops of this.userShops.values()) {
            if (userShops.some(us => us.shopId === shopId)) {
                count++;
            }
        }
        return count;
    }

    // 获取系统整体统计
    async getSystemStats() {
        const totalUsers = this.users.size;
        const totalShops = this.shops.size;
        
        // 按角色统计用户
        const usersByRole = {};
        for (const user of this.users.values()) {
            usersByRole[user.role] = (usersByRole[user.role] || 0) + 1;
        }
        
        // 按状态统计店铺
        const shopsByStatus = {};
        for (const shop of this.shops.values()) {
            shopsByStatus[shop.status] = (shopsByStatus[shop.status] || 0) + 1;
        }
        
        return {
            totalUsers,
            totalShops,
            usersByRole,
            shopsByStatus,
            timestamp: new Date()
        };
    }

    // 获取特定店主的详细信息
    async getShopOwnerDetails(ownerId) {
        const user = this.users.get(ownerId);
        if (!user || user.role !== 'shop_owner') {
            throw new Error('店主不存在');
        }
        
        const userShops = this.userShops.get(ownerId) || [];
        const ownedShops = userShops.filter(us => us.role === 'owner');
        
        const shopDetails = ownedShops.map(us => {
            const shop = this.shops.get(us.shopId);
            return {
                ...shop,
                memberCount: this.getShopMemberCount(us.shopId),
                members: this.getShopMembers(us.shopId)
            };
        });
        
        const { password: _, ...ownerInfo } = user;
        
        return {
            owner: ownerInfo,
            shopsCount: ownedShops.length,
            shops: shopDetails,
            totalMembers: shopDetails.reduce((sum, shop) => sum + shop.memberCount, 0)
        };
    }

    // 获取店铺成员详情
    getShopMembers(shopId) {
        const members = [];
        for (const [userId, userShops] of this.userShops.entries()) {
            const shopRole = userShops.find(us => us.shopId === shopId);
            if (shopRole) {
                const user = this.users.get(userId);
                if (user) {
                    const { password: _, ...memberInfo } = user;
                    members.push({
                        ...memberInfo,
                        shopRole: shopRole.role,
                        permissions: shopRole.permissions
                    });
                }
            }
        }
        return members;
    }

    // 搜索店主
    async searchShopOwners(keyword) {
        const stats = await this.getShopOwnersStats();
        
        if (!keyword) {
            return stats;
        }
        
        return stats.filter(stat => 
            stat.user.username.toLowerCase().includes(keyword.toLowerCase()) ||
            stat.user.email.toLowerCase().includes(keyword.toLowerCase()) ||
            stat.shops.some(shop => 
                shop.name.toLowerCase().includes(keyword.toLowerCase()) ||
                shop.domain.toLowerCase().includes(keyword.toLowerCase())
            )
        );
    }

    // 禁用/启用店主账号
    async toggleShopOwnerStatus(ownerId, status) {
        const user = this.users.get(ownerId);
        if (!user || user.role !== 'shop_owner') {
            throw new Error('店主不存在');
        }
        
        user.status = status;
        user.updatedAt = new Date();
        
        // 同时更新该店主的所有店铺状态
        const userShops = this.userShops.get(ownerId) || [];
        const ownedShops = userShops.filter(us => us.role === 'owner');
        
        for (const us of ownedShops) {
            const shop = this.shops.get(us.shopId);
            if (shop) {
                shop.status = status === 'active' ? 'active' : 'suspended';
                shop.updatedAt = new Date();
            }
        }
        
        return user;
    }

    // ============ API密钥管理 ============
    
    // 为店铺生成API密钥
    async generateApiKeyForShop(shopId) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        const crypto = require('crypto');
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const signature = crypto.createHash('sha256')
            .update(`${shopId}-${shop.domain}-${timestamp}-${randomBytes}`)
            .digest('hex');
        
        const apiKey = `sk_${shopId}_${signature.substring(0, 32)}`;
        
        // 更新店铺信息，添加API密钥
        shop.apiKey = apiKey;
        shop.apiKeyCreatedAt = new Date();
        shop.updatedAt = new Date();
        
        this.shops.set(shopId, shop);
        return apiKey;
    }
    
    // 根据API密钥获取店铺信息
    async getShopByApiKey(apiKey) {
        for (const shop of this.shops.values()) {
            if (shop.apiKey === apiKey && shop.status === 'active') {
                return shop;
            }
        }
        return null;
    }
    
    // 更新店铺API密钥
    async updateShopApiKey(shopId) {
        return await this.generateApiKeyForShop(shopId);
    }
    
    // 删除店铺API密钥
    async deleteShopApiKey(shopId) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        delete shop.apiKey;
        delete shop.apiKeyCreatedAt;
        shop.updatedAt = new Date();
        
        this.shops.set(shopId, shop);
        return true;
    }
    
    // 验证API密钥有效性
    async validateApiKey(apiKey) {
        const shop = await this.getShopByApiKey(apiKey);
        return shop !== null;
    }
    
    // 获取店铺的API密钥信息
    async getShopApiKeyInfo(shopId) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        return {
            hasApiKey: !!shop.apiKey,
            apiKey: shop.apiKey,
            createdAt: shop.apiKeyCreatedAt,
            maskedKey: shop.apiKey ? shop.apiKey.substring(0, 12) + '****' + shop.apiKey.substring(shop.apiKey.length - 4) : null
        };
    }

    // ============ 充值续费功能 ============

    // 创建续费订单
    async createRenewalOrder(shopId, userId) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }

        if (shop.ownerId !== userId) {
            throw new Error('无权限为此店铺续费');
        }

        if (shop.approvalStatus !== 'approved') {
            throw new Error('只有已审核通过的店铺才能续费');
        }

        const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const renewalOrder = {
            orderId,
            shopId,
            shopName: shop.name,
            userId,
            amount: 2000, // 2000元一年
            status: 'pending', // pending, paid, expired
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟过期
            renewalPeriod: 365, // 续费365天
        };

        this.renewalOrders.set(orderId, renewalOrder);
        
        console.log(`💰 创建续费订单: ${shop.name} - ¥${renewalOrder.amount}`);
        
        return renewalOrder;
    }

    // 生成支付二维码（模拟）
    async generatePaymentQRCode(orderId, paymentMethod) {
        const order = this.renewalOrders.get(orderId);
        if (!order) {
            throw new Error('订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态不正确');
        }

        // 模拟生成二维码数据
        const qrData = {
            orderId,
            paymentMethod, // 'alipay' 或 'wechat'
            amount: order.amount,
            qrCodeUrl: this.generateMockQRCode(orderId, paymentMethod, order.amount),
            expiresAt: order.expiresAt
        };

        this.paymentQRCodes.set(orderId, qrData);
        
        console.log(`📱 生成${paymentMethod === 'alipay' ? '支付宝' : '微信'}支付二维码: 订单${orderId}`);
        
        return qrData;
    }

    // 模拟生成二维码URL
    generateMockQRCode(orderId, paymentMethod, amount) {
        // 实际项目中这里应该调用支付宝/微信的API生成真实二维码
        // 现在使用在线二维码生成服务来模拟
        
        const paymentData = {
            orderId,
            paymentMethod,
            amount,
            merchant: 'QuickTalk客服系统',
            timestamp: Date.now()
        };
        
        // 模拟支付链接
        const paymentUrl = paymentMethod === 'alipay' 
            ? `alipays://platformapi/startapp?saId=10000007&qrcode=https://qr.alipay.com/tsx${orderId}${Date.now()}`
            : `weixin://wxpay/bizpayurl?pr=${orderId}${Date.now()}`;
        
        // 使用免费二维码生成API
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}`;
        
        console.log(`🎨 生成${paymentMethod === 'alipay' ? '支付宝' : '微信'}二维码:`, qrCodeUrl);
        
        return qrCodeUrl;
    }

    // 模拟支付成功回调
    async processPaymentSuccess(orderId) {
        const order = this.renewalOrders.get(orderId);
        if (!order) {
            throw new Error('订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单已处理');
        }

        // 更新订单状态
        order.status = 'paid';
        order.paidAt = new Date();

        // 为店铺续费
        const shop = this.shops.get(order.shopId);
        if (shop) {
            const currentExpiry = shop.expiryDate || new Date();
            const newExpiry = new Date(Math.max(currentExpiry.getTime(), new Date().getTime()));
            newExpiry.setDate(newExpiry.getDate() + order.renewalPeriod);
            
            shop.expiryDate = newExpiry;
            shop.lastRenewalDate = new Date();
            
            console.log(`✅ 店铺续费成功: ${shop.name} 到期时间延长至 ${newExpiry.toLocaleDateString()}`);
        }

        // 清理二维码缓存
        this.paymentQRCodes.delete(orderId);

        return {
            success: true,
            orderId,
            shop,
            newExpiryDate: shop.expiryDate
        };
    }

    // 检查订单状态
    async checkOrderStatus(orderId) {
        const order = this.renewalOrders.get(orderId);
        if (!order) {
            throw new Error('订单不存在');
        }

        // 检查订单是否过期
        if (order.status === 'pending' && new Date() > order.expiresAt) {
            order.status = 'expired';
            this.paymentQRCodes.delete(orderId);
        }

        return order;
    }

    // 获取店铺续费历史
    async getShopRenewalHistory(shopId) {
        const renewalHistory = [];
        for (const order of this.renewalOrders.values()) {
            if (order.shopId === shopId) {
                renewalHistory.push(order);
            }
        }

        return renewalHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 模拟支付成功（用于测试）
    async mockPaymentSuccess(orderId) {
        console.log(`🧪 模拟支付成功: 订单 ${orderId}`);
        return await this.processPaymentSuccess(orderId);
    }

    // ==================== 付费开通功能 ====================
    
    // 创建付费开通订单
    async createActivationOrder(shopId, userId) {
        const shop = this.shops.get(shopId);
        if (!shop) {
            throw new Error('店铺不存在');
        }

        if (shop.status !== 'pending') {
            throw new Error('只有未审核通过的店铺才能付费开通');
        }

        // 验证用户是否是店铺拥有者
        const userShops = this.userShops.get(userId) || [];
        const isOwner = userShops.some(us => us.shopId === shopId);
        if (!isOwner) {
            throw new Error('只有店铺拥有者才能付费开通');
        }

        const orderId = `activation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30分钟后过期

        const activationOrder = {
            orderId,
            shopId,
            userId,
            shopName: shop.name,
            amount: 2000, // 付费开通价格: ¥2000
            status: 'pending', // pending, paid, expired, cancelled
            paymentMethod: null,
            createdAt: new Date(),
            expiresAt,
            paidAt: null
        };

        this.activationOrders.set(orderId, activationOrder);
        
        console.log(`💎 创建付费开通订单: ${shop.name} (${shopId}) - ¥2000`);
        
        return activationOrder;
    }

    // 生成付费开通支付二维码
    async generateActivationPaymentQRCode(orderId, paymentMethod) {
        const order = this.activationOrders.get(orderId);
        if (!order) {
            throw new Error('开通订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态不正确');
        }

        // 模拟生成二维码数据
        const qrData = {
            orderId,
            paymentMethod, // 'alipay' 或 'wechat'
            amount: order.amount,
            qrCodeUrl: this.generateActivationMockQRCode(orderId, paymentMethod, order.amount),
            expiresAt: order.expiresAt
        };

        this.activationQRCodes.set(orderId, qrData);
        
        console.log(`📱 生成${paymentMethod === 'alipay' ? '支付宝' : '微信'}付费开通二维码: 订单${orderId}`);
        
        return qrData;
    }

    // 模拟生成付费开通二维码URL
    generateActivationMockQRCode(orderId, paymentMethod, amount) {
        const paymentData = {
            orderId,
            paymentMethod,
            amount,
            type: 'activation', // 标识为付费开通
            merchant: 'QuickTalk客服系统-付费开通',
            timestamp: Date.now()
        };
        
        // 模拟支付链接
        const paymentUrl = paymentMethod === 'alipay' 
            ? `alipays://platformapi/startapp?saId=10000007&qrcode=https://qr.alipay.com/activation${orderId}${Date.now()}`
            : `weixin://wxpay/bizpayurl?pr=activation${orderId}${Date.now()}`;
        
        // 使用免费二维码生成API
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(paymentUrl)}`;
        
        console.log(`🎨 生成${paymentMethod === 'alipay' ? '支付宝' : '微信'}付费开通二维码:`, qrCodeUrl);
        
        return qrCodeUrl;
    }

    // 处理付费开通支付成功
    async processActivationPaymentSuccess(orderId) {
        const order = this.activationOrders.get(orderId);
        if (!order) {
            throw new Error('开通订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态不正确');
        }

        // 更新订单状态
        order.status = 'paid';
        order.paidAt = new Date();

        // 自动审核通过店铺
        const shop = this.shops.get(order.shopId);
        if (shop) {
            const oldStatus = shop.status;
            shop.status = 'approved';
            shop.approvedAt = new Date();
            shop.approvedBy = 'system_auto'; // 系统自动审核
            shop.approvalMethod = 'paid_activation'; // 付费开通方式
            
            // 设置店铺有效期为1年
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            shop.expiresAt = expiresAt;

            console.log(`🎉 付费开通成功: ${shop.name} (${shop.id}) 已自动审核通过`);
            console.log(`⏰ 店铺有效期至: ${expiresAt.toLocaleDateString()}`);
        }

        // 清理二维码缓存
        this.activationQRCodes.delete(orderId);

        console.log(`💰 付费开通支付成功: 订单 ${orderId}, 金额: ¥${order.amount}`);
        
        return {
            success: true,
            order,
            shop,
            message: '付费开通成功，店铺已自动审核通过！'
        };
    }

    // 获取付费开通订单状态
    async getActivationOrderStatus(orderId) {
        const order = this.activationOrders.get(orderId);
        if (!order) {
            throw new Error('开通订单不存在');
        }

        // 检查订单是否过期
        if (order.status === 'pending' && new Date() > order.expiresAt) {
            order.status = 'expired';
            this.activationQRCodes.delete(orderId);
        }

        return order;
    }

    // 获取店铺付费开通历史
    async getShopActivationHistory(shopId) {
        const activationHistory = [];
        for (const order of this.activationOrders.values()) {
            if (order.shopId === shopId) {
                activationHistory.push(order);
            }
        }

        return activationHistory.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 模拟付费开通支付成功（用于测试）
    async mockActivationPaymentSuccess(orderId) {
        console.log(`🧪 模拟付费开通支付成功: 订单 ${orderId}`);
        return await this.processActivationPaymentSuccess(orderId);
    }
}

module.exports = Database;
