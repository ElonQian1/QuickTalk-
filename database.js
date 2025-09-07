// 数据库模拟层 - 生产环境请替换为真实数据库
class Database {
    constructor() {
        // 模拟数据存储
        this.users = new Map(); // 用户表
        this.shops = new Map(); // 店铺表
        this.userShops = new Map(); // 用户-店铺关系表
        this.sessions = new Map(); // 会话表
        
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
            createdAt: new Date()
        });
        
        // 建立用户-店铺关系
        this.userShops.set(shopOwnerId, [{
            shopId: shopId,
            role: 'owner',
            permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
        }]);
        
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
        const { username, password, email, role = 'employee' } = userData;
        
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
            createdAt: new Date()
        };
        
        this.shops.set(shopId, newShop);
        
        // 待审核的店铺暂不添加权限，审核通过后再添加
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
            // 审核通过，为店主添加店铺权限
            const userShops = this.userShops.get(shop.ownerId) || [];
            userShops.push({
                shopId,
                role: 'owner',
                permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
            });
            this.userShops.set(shop.ownerId, userShops);
            
            console.log(`✅ 店铺审核通过: ${shop.name} (${shop.domain})`);
        } else {
            console.log(`❌ 店铺审核拒绝: ${shop.name} (${shop.domain}) - ${note}`);
        }
        
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
        return Array.from(this.shops.values());
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
}

module.exports = Database;
