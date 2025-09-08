const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// SQLite数据库实现
class SQLiteDatabase {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, 'data', 'customer_service.db');
        this.init();
    }

    async init() {
        try {
            // 确保data目录存在
            const fs = require('fs');
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath);
            await this.createTables();
            await this.initTestData();
            console.log('SQLite数据库初始化完成');
        } catch (error) {
            console.error('数据库初始化失败:', error);
        }
    }

    // 创建所有表
    async createTables() {
        const tables = [
            // 用户表
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                status TEXT NOT NULL DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login_at DATETIME
            )`,
            
            // 店铺表
            `CREATE TABLE IF NOT EXISTS shops (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                name TEXT NOT NULL,
                domain TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                approval_status TEXT NOT NULL DEFAULT 'pending',
                service_status TEXT NOT NULL DEFAULT 'inactive',
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reviewed_at DATETIME,
                reviewed_by TEXT,
                review_note TEXT,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id)
            )`,
            
            // 用户会话表
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            
            // 用户-店铺关联表
            `CREATE TABLE IF NOT EXISTS user_shops (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                shop_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                permissions TEXT, -- JSON字符串存储权限数组
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shop_id) REFERENCES shops(id),
                UNIQUE(user_id, shop_id)
            )`,
            
            // 续费订单表
            `CREATE TABLE IF NOT EXISTS renewal_orders (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                months INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                qr_code_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                paid_at DATETIME,
                FOREIGN KEY (shop_id) REFERENCES shops(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            
            // 付费开通订单表
            `CREATE TABLE IF NOT EXISTS activation_orders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                shop_name TEXT NOT NULL,
                domain TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                months INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                qr_code_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                paid_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            
            // 支付二维码缓存表
            `CREATE TABLE IF NOT EXISTS payment_qr_codes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                order_id TEXT NOT NULL,
                qr_code_url TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            await this.runAsync(sql);
        }
    }

    // Promise化的数据库操作
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    allAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // 密码哈希
    hashPassword(password) {
        return bcrypt.hashSync(password, 10);
    }

    verifyPassword(password, hash) {
        return bcrypt.compareSync(password, hash);
    }

    // 初始化测试数据
    async initTestData() {
        try {
            // 检查是否已有管理员用户
            const existingAdmin = await this.getAsync(
                'SELECT id FROM users WHERE username = ?', 
                ['admin']
            );

            if (!existingAdmin) {
                // 创建超级管理员
                const superAdminId = 'admin_' + Date.now();
                await this.runAsync(`
                    INSERT INTO users (id, username, password, email, role, status) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    superAdminId,
                    'admin',
                    this.hashPassword('admin123'),
                    'admin@system.com',
                    'super_admin',
                    'active'
                ]);

                // 创建测试店主
                const shopOwnerId = 'user_' + Date.now();
                await this.runAsync(`
                    INSERT INTO users (id, username, password, email, role, status) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    shopOwnerId,
                    'shop_owner',
                    this.hashPassword('123456'),
                    'owner@shop.com',
                    'shop_owner',
                    'active'
                ]);

                console.log('测试数据初始化完成');
            }
        } catch (error) {
            console.error('初始化测试数据失败:', error);
        }
    }

    // =================== 用户管理 ===================
    
    async createUser(userData) {
        const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const hashedPassword = this.hashPassword(userData.password);
        
        await this.runAsync(`
            INSERT INTO users (id, username, password, email, role, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id,
            userData.username,
            hashedPassword,
            userData.email,
            userData.role || 'user',
            userData.status || 'active'
        ]);
        
        return await this.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    }

    async getUserByUsername(username) {
        return await this.getAsync('SELECT * FROM users WHERE username = ?', [username]);
    }

    async getUserById(id) {
        return await this.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    }

    async updateUser(id, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        
        await this.runAsync(`UPDATE users SET ${setClause} WHERE id = ?`, values);
        return await this.getUserById(id);
    }

    async deleteUser(id) {
        await this.runAsync('DELETE FROM users WHERE id = ?', [id]);
        return true;
    }

    async getAllUsers() {
        return await this.allAsync('SELECT * FROM users ORDER BY created_at DESC');
    }

    // 用户注册
    async registerUser(userData) {
        const { username, password, email, role = 'user' } = userData;
        
        // 检查用户名是否已存在
        const existingUser = await this.getAsync('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            throw new Error('用户名或邮箱已存在');
        }
        
        const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const hashedPassword = this.hashPassword(password);
        
        await this.runAsync(`
            INSERT INTO users (id, username, password, email, role, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, username, hashedPassword, email, role, 'active']);
        
        const newUser = await this.getAsync('SELECT * FROM users WHERE id = ?', [id]);
        
        // 返回不包含密码的用户信息
        const { password: _, ...userInfo } = newUser;
        return userInfo;
    }

    // 获取用户的店铺列表
    async getUserShops(userId) {
        const userShops = await this.allAsync(`
            SELECT s.id, s.name, s.domain, s.description, s.created_at, s.expires_at,
                   us.role as userRole, us.permissions,
                   s.approval_status as approvalStatus,
                   s.submitted_at as submittedAt,
                   s.reviewed_at as reviewedAt,
                   s.reviewed_by as reviewedBy,
                   s.review_note as reviewNote
            FROM shops s 
            JOIN user_shops us ON s.id = us.shop_id 
            WHERE us.user_id = ? 
            ORDER BY us.joined_at DESC
        `, [userId]);
        
        return userShops.map(shop => ({
            id: shop.id,
            name: shop.name,
            domain: shop.domain,
            description: shop.description,
            userRole: shop.userRole,
            approvalStatus: shop.approvalStatus,
            submittedAt: shop.submittedAt,
            reviewedAt: shop.reviewedAt,
            reviewedBy: shop.reviewedBy,
            reviewNote: shop.reviewNote,
            expiryDate: shop.expires_at,
            permissions: shop.permissions ? JSON.parse(shop.permissions) : [],
            members: [] // 初始化成员列表
        }));
    }

    // 用户登录
    async loginUser(username, password) {
        const user = await this.getAsync('SELECT * FROM users WHERE username = ?', [username]);
        
        if (!user || !this.verifyPassword(password, user.password)) {
            throw new Error('用户名或密码错误');
        }
        
        // 更新最后登录时间
        await this.runAsync('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        // 创建会话
        const sessionId = await this.createSession(user.id);
        
        // 获取用户的店铺权限
        const userShops = await this.getShopsByOwner(user.id);
        
        // 返回不包含密码的用户信息和会话信息
        const { password: _, ...userInfo } = user;
        return {
            user: userInfo,
            sessionId,
            shops: userShops
        };
    }

    // =================== 会话管理 ===================
    
    async createSession(userId) {
        const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7天后过期

        await this.runAsync(`
            INSERT INTO sessions (id, user_id, expires_at) 
            VALUES (?, ?, ?)
        `, [sessionId, userId, expiresAt.toISOString()]);

        return sessionId;
    }

    async validateSession(sessionId) {
        const session = await this.getAsync(`
            SELECT s.*, u.* FROM sessions s 
            JOIN users u ON s.user_id = u.id 
            WHERE s.id = ? AND s.expires_at > datetime('now')
        `, [sessionId]);

        return session;
    }

    async deleteSession(sessionId) {
        await this.runAsync('DELETE FROM sessions WHERE id = ?', [sessionId]);
        return true;
    }

    // =================== 店铺管理 ===================
    
    async createShop(ownerId, shopData) {
        const { name, domain, description = '' } = shopData;
        
        // 检查域名是否已存在
        const existingShop = await this.getAsync('SELECT id FROM shops WHERE domain = ?', [domain]);
        if (existingShop) {
            throw new Error('域名已存在');
        }
        
        const id = 'shop_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await this.runAsync(`
            INSERT INTO shops (id, owner_id, name, domain, description, status, approval_status, service_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            ownerId,
            name,
            domain,
            description,
            'pending', // 店铺状态
            'pending', // 审核状态
            'inactive'  // 服务状态
        ]);
        
        // 将店主添加到用户店铺关联中（即使是待审核状态也要显示）
        await this.runAsync(`
            INSERT INTO user_shops (user_id, shop_id, role, permissions) 
            VALUES (?, ?, ?, ?)
        `, [
            ownerId,
            id,
            'owner',
            JSON.stringify(['view_shop']) // 待审核状态只有查看权限
        ]);
        
        console.log(`🏪 新店铺申请: ${name} (${domain}) 等待审核`);
        return await this.getAsync('SELECT * FROM shops WHERE id = ?', [id]);
    }

    async getShopById(id) {
        const shop = await this.getAsync(`
            SELECT *,
                   approval_status as approvalStatus,
                   submitted_at as submittedAt,
                   reviewed_at as reviewedAt,
                   reviewed_by as reviewedBy,
                   review_note as reviewNote,
                   expires_at as expiryDate,
                   owner_id as ownerId
            FROM shops WHERE id = ?
        `, [id]);
        
        if (shop) {
            return {
                ...shop,
                members: [] // 初始化成员列表
            };
        }
        return null;
    }

    async getShopByDomain(domain) {
        return await this.getAsync('SELECT * FROM shops WHERE domain = ?', [domain]);
    }

    async getShopsByOwner(ownerId) {
        return await this.allAsync('SELECT * FROM shops WHERE owner_id = ? ORDER BY created_at DESC', [ownerId]);
    }

    async updateShop(id, updates) {
        const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updates), id];
        
        await this.runAsync(`UPDATE shops SET ${setClause} WHERE id = ?`, values);
        return await this.getShopById(id);
    }

    async deleteShop(id) {
        await this.runAsync('DELETE FROM shops WHERE id = ?', [id]);
        return true;
    }

    async getAllShops() {
        const shops = await this.allAsync(`
            SELECT s.*, u.username as owner_username,
                   s.approval_status as approvalStatus,
                   s.submitted_at as submittedAt,
                   s.reviewed_at as reviewedAt,
                   s.reviewed_by as reviewedBy,
                   s.review_note as reviewNote,
                   s.expires_at as expiryDate,
                   s.owner_id as ownerId
            FROM shops s 
            JOIN users u ON s.owner_id = u.id 
            ORDER BY s.created_at DESC
        `);
        
        return shops.map(shop => ({
            ...shop,
            members: [] // 初始化成员列表
        }));
    }
    
    // 获取待审核店铺列表
    async getPendingShops() {
        const shops = await this.allAsync(`
            SELECT s.*, u.username as owner_username,
                   s.approval_status as approvalStatus,
                   s.submitted_at as submittedAt,
                   s.reviewed_at as reviewedAt,
                   s.reviewed_by as reviewedBy,
                   s.review_note as reviewNote,
                   s.expires_at as expiryDate
            FROM shops s 
            JOIN users u ON s.owner_id = u.id 
            WHERE s.approval_status = 'pending'
            ORDER BY s.created_at ASC
        `);
        
        return shops.map(shop => ({
            ...shop,
            ownerId: shop.owner_id,
            members: [] // 初始化成员列表
        }));
    }
    
    // 添加员工到店铺
    async addStaffToShop(shopId, staffId, role, permissions) {
        // 检查是否已经是成员
        const existing = await this.getAsync(`
            SELECT id FROM user_shops WHERE user_id = ? AND shop_id = ?
        `, [staffId, shopId]);
        
        if (existing) {
            throw new Error('用户已经是该店铺的成员');
        }
        
        await this.runAsync(`
            INSERT INTO user_shops (user_id, shop_id, role, permissions) 
            VALUES (?, ?, ?, ?)
        `, [staffId, shopId, role, JSON.stringify(permissions)]);
        
        return true;
    }
    
    // 店铺审核方法
    async reviewShop(shopId, reviewData, reviewerId) {
        const { approved, note = '' } = reviewData;
        
        const shop = await this.getAsync('SELECT * FROM shops WHERE id = ?', [shopId]);
        if (!shop) {
            throw new Error('店铺不存在');
        }
        
        if (shop.approval_status !== 'pending') {
            throw new Error('店铺已经审核过了');
        }
        
        const approvalStatus = approved ? 'approved' : 'rejected';
        const reviewedAt = new Date().toISOString();
        
        // 更新店铺审核状态
        await this.runAsync(`
            UPDATE shops SET 
                approval_status = ?, 
                reviewed_at = ?, 
                reviewed_by = ?, 
                review_note = ?
            WHERE id = ?
        `, [approvalStatus, reviewedAt, reviewerId, note, shopId]);
        
        if (approved) {
            // 审核通过，设置到期时间和激活状态
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            
            await this.runAsync(`
                UPDATE shops SET 
                    expires_at = ?,
                    service_status = 'active'
                WHERE id = ?
            `, [expiryDate.toISOString(), shopId]);
            
            // 更新店主权限
            await this.runAsync(`
                UPDATE user_shops SET 
                    permissions = ?
                WHERE shop_id = ? AND role = 'owner'
            `, [JSON.stringify(['manage_staff', 'view_chats', 'handle_chats', 'manage_shop']), shopId]);
        }
        
        return await this.getAsync('SELECT * FROM shops WHERE id = ?', [shopId]);
    }

    // =================== 订单管理 ===================
    
    async createRenewalOrder(orderData) {
        const id = 'renewal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await this.runAsync(`
            INSERT INTO renewal_orders (id, shop_id, user_id, amount, months, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id,
            orderData.shop_id,
            orderData.user_id,
            orderData.amount,
            orderData.months,
            'pending'
        ]);
        
        return await this.getAsync('SELECT * FROM renewal_orders WHERE id = ?', [id]);
    }

    async createActivationOrder(orderData) {
        const id = 'activation_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        await this.runAsync(`
            INSERT INTO activation_orders (id, user_id, shop_name, domain, amount, months, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            orderData.user_id,
            orderData.shop_name,
            orderData.domain,
            orderData.amount,
            orderData.months,
            'pending'
        ]);
        
        return await this.getAsync('SELECT * FROM activation_orders WHERE id = ?', [id]);
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = SQLiteDatabase;
