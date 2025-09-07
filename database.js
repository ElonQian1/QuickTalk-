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
    
    // 创建店铺
    async createShop(ownerId, shopData) {
        const { name, domain } = shopData;
        
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
            ownerId,
            status: 'active',
            createdAt: new Date()
        };
        
        this.shops.set(shopId, newShop);
        
        // 为店主添加店铺权限
        const userShops = this.userShops.get(ownerId) || [];
        userShops.push({
            shopId,
            role: 'owner',
            permissions: ['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']
        });
        this.userShops.set(ownerId, userShops);
        
        return newShop;
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
}

module.exports = Database;
