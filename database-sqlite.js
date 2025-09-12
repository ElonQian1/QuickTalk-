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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
            )`,
            
            // 消息表
            `CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                admin_id TEXT,
                message TEXT NOT NULL,
                sender TEXT NOT NULL CHECK (sender IN ('user', 'admin', 'system')),
                is_read BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                read_at DATETIME,
                FOREIGN KEY (shop_id) REFERENCES shops(id),
                FOREIGN KEY (admin_id) REFERENCES users(id)
            )`,
            
            // 对话表 (用于管理用户会话)
            `CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                shop_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT,
                last_message TEXT,
                last_message_at DATETIME,
                unread_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shop_id) REFERENCES shops(id),
                UNIQUE(shop_id, user_id)
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

    // 统一的用户完整信息获取函数
    async getCompleteUserInfo(userId) {
        // 获取用户基本信息（不包含密码）
        const user = await this.getAsync('SELECT id, username, email, role, created_at, last_login_at FROM users WHERE id = ?', [userId]);
        if (!user) {
            throw new Error('用户不存在');
        }
        
        // 获取用户的店铺权限
        const userShops = await this.getUserShops(userId);
        
        return {
            user,
            shops: userShops
        };
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
        
        // 使用统一的用户信息获取函数
        const completeUserInfo = await this.getCompleteUserInfo(user.id);
        
        return {
            ...completeUserInfo,
            sessionId
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
        // 自动添加updated_at字段
        const updatesWithTimestamp = {
            ...updates,
            updated_at: new Date().toISOString()
        };
        
        const setClause = Object.keys(updatesWithTimestamp).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(updatesWithTimestamp), id];
        
        await this.runAsync(`UPDATE shops SET ${setClause} WHERE id = ?`, values);
        return await this.getShopById(id);
    }

    async updateShopApiKey(shopId, apiKey) {
        await this.runAsync(`
            UPDATE shops 
            SET api_key = ?, api_key_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [apiKey, shopId]);
        return await this.getShopById(shopId);
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
                review_note = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [approvalStatus, reviewedAt, reviewerId, note, shopId]);
        
        if (approved) {
            // 审核通过，设置到期时间和激活状态
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            
            await this.runAsync(`
                UPDATE shops SET 
                    expires_at = ?,
                    service_status = 'active',
                    updated_at = CURRENT_TIMESTAMP
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

    // 生成支付二维码（续费）
    async generatePaymentQRCode(orderId, paymentMethod) {
        // 检查订单是否存在
        const order = await this.getAsync('SELECT * FROM renewal_orders WHERE id = ?', [orderId]);
        if (!order) {
            throw new Error('订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态异常，无法生成支付二维码');
        }

        // 生成模拟二维码数据
        const qrData = {
            orderId: orderId,
            paymentMethod: paymentMethod,
            amount: order.amount,
            qrCodeUrl: `https://api.example.com/qr/${paymentMethod}/${orderId}`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15分钟后过期
        };

        // 可以存储到缓存或数据库中
        return qrData;
    }

    // 生成付费开通支付二维码
    async generateActivationPaymentQRCode(orderId, paymentMethod) {
        // 检查订单是否存在
        const order = await this.getAsync('SELECT * FROM activation_orders WHERE id = ?', [orderId]);
        if (!order) {
            throw new Error('付费开通订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态异常，无法生成支付二维码');
        }

        // 生成模拟二维码数据
        const qrData = {
            orderId: orderId,
            paymentMethod: paymentMethod,
            amount: order.amount,
            shopName: order.shop_name,
            qrCodeUrl: `https://api.example.com/qr/${paymentMethod}/${orderId}`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15分钟后过期
        };

        return qrData;
    }

    // 获取付费开通订单状态
    async getActivationOrderStatus(orderId) {
        const order = await this.getAsync('SELECT * FROM activation_orders WHERE id = ?', [orderId]);
        if (!order) {
            throw new Error('付费开通订单不存在');
        }
        return order;
    }

    // 模拟续费支付成功
    async mockPaymentSuccess(orderId) {
        const order = await this.getAsync('SELECT * FROM renewal_orders WHERE id = ?', [orderId]);
        if (!order) {
            throw new Error('续费订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态异常，无法完成支付');
        }

        // 更新订单状态
        await this.runAsync(`
            UPDATE renewal_orders 
            SET status = 'completed', paid_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [orderId]);

        // 更新店铺到期时间
        const shop = await this.getAsync('SELECT * FROM shops WHERE id = ?', [order.shop_id]);
        if (shop) {
            const currentExpiry = shop.expires_at ? new Date(shop.expires_at) : new Date();
            const newExpiry = new Date(currentExpiry.getTime() + order.months * 30 * 24 * 60 * 60 * 1000);
            
            await this.runAsync(`
                UPDATE shops 
                SET expires_at = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [newExpiry.toISOString(), order.shop_id]);
        }

        return {
            orderId: orderId,
            status: 'completed',
            paidAt: new Date().toISOString(),
            newExpiryDate: shop ? new Date(new Date(shop.expires_at || new Date()).getTime() + order.months * 30 * 24 * 60 * 60 * 1000).toISOString() : null
        };
    }

    // 模拟付费开通支付成功
    async mockActivationPaymentSuccess(orderId) {
        const order = await this.getAsync('SELECT * FROM activation_orders WHERE id = ?', [orderId]);
        if (!order) {
            throw new Error('付费开通订单不存在');
        }

        if (order.status !== 'pending') {
            throw new Error('订单状态异常，无法完成支付');
        }

        // 更新订单状态
        await this.runAsync(`
            UPDATE activation_orders 
            SET status = 'completed', paid_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [orderId]);

        // 查找对应的店铺并激活
        const shop = await this.getAsync('SELECT * FROM shops WHERE domain = ?', [order.domain]);
        if (shop) {
            const expiryDate = new Date(Date.now() + order.months * 30 * 24 * 60 * 60 * 1000);
            
            await this.runAsync(`
                UPDATE shops 
                SET approval_status = 'approved', 
                    reviewed_at = CURRENT_TIMESTAMP,
                    expires_at = ?,
                    review_note = '付费开通自动审核通过',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [expiryDate.toISOString(), shop.id]);

            return {
                orderId: orderId,
                shopId: shop.id,
                shopName: order.shop_name,
                status: 'completed',
                approvalStatus: 'approved',
                expiryDate: expiryDate.toISOString(),
                paidAt: new Date().toISOString()
            };
        } else {
            throw new Error('找不到对应的店铺');
        }
    }

    // 获取店铺续费历史
    async getShopRenewalHistory(shopId) {
        const history = await this.allAsync(`
            SELECT * FROM renewal_orders 
            WHERE shop_id = ? 
            ORDER BY created_at DESC
        `, [shopId]);
        
        return history;
    }

    // 获取店铺付费开通历史  
    async getShopActivationHistory(shopId) {
        // 通过店铺信息查找激活历史
        const shop = await this.getAsync('SELECT * FROM shops WHERE id = ?', [shopId]);
        if (!shop) {
            return [];
        }

        const history = await this.allAsync(`
            SELECT * FROM activation_orders 
            WHERE domain = ? 
            ORDER BY created_at DESC
        `, [shop.domain]);
        
        return history;
    }

    // =================== API密钥管理 ===================
    
    async generateApiKeyForShop(shopId) {
        const shop = await this.getAsync('SELECT * FROM shops WHERE id = ?', [shopId]);
        if (!shop) {
            throw new Error('店铺不存在');
        }

        // 生成API密钥
        const apiKey = 'sk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
        
        // 更新店铺的API密钥
        await this.runAsync(`
            UPDATE shops 
            SET api_key = ?, api_key_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [apiKey, shopId]);

        return apiKey;
    }

    async getShopApiKeyInfo(shopId) {
        const shop = await this.getAsync('SELECT id, name, api_key, api_key_created_at FROM shops WHERE id = ?', [shopId]);
        if (!shop) {
            throw new Error('店铺不存在');
        }

        return {
            shopId: shop.id,
            shopName: shop.name,
            hasApiKey: !!shop.api_key,
            apiKeyCreatedAt: shop.api_key_created_at,
            maskedKey: shop.api_key ? shop.api_key.substring(0, 12) + '****' + shop.api_key.substring(shop.api_key.length - 4) : null
        };
    }

    // =================== 消息和对话管理 ===================
    
    // 保存消息
    async saveMessage({ shopId, userId, message, sender, adminId = null, timestamp = new Date() }) {
        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
        
        await this.runAsync(`
            INSERT INTO messages (id, shop_id, user_id, admin_id, message, sender, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [messageId, shopId, userId, adminId, message, sender, timestamp.toISOString()]);

        // 更新或创建对话记录
        await this.updateConversation(shopId, userId, message, timestamp);
        
        return messageId;
    }

    // 更新对话记录
    async updateConversation(shopId, userId, lastMessage, timestamp) {
        // 先尝试更新现有对话
        const result = await this.runAsync(`
            UPDATE conversations 
            SET last_message = ?, last_message_at = ?, unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE shop_id = ? AND user_id = ?
        `, [lastMessage, timestamp.toISOString(), shopId, userId]);

        // 如果没有更新任何记录，说明是新对话，需要创建
        if (result.changes === 0) {
            const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            await this.runAsync(`
                INSERT INTO conversations (id, shop_id, user_id, user_name, last_message, last_message_at, unread_count)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            `, [conversationId, shopId, userId, `用户${userId}`, lastMessage, timestamp.toISOString()]);
        }
    }

    // 获取店铺的所有对话
    async getShopConversations(shopId) {
        const conversations = await this.allAsync(`
            SELECT * FROM conversations 
            WHERE shop_id = ? AND status = 'active'
            ORDER BY last_message_at DESC
        `, [shopId]);

        return conversations.map(conv => ({
            id: `${conv.shop_id}_${conv.user_id}`, // 生成对话ID格式：shopId_userId
            customer_id: conv.user_id,
            customer_name: conv.user_name || `用户${conv.user_id}`,
            last_message: conv.last_message,
            last_message_at: conv.last_message_at,
            unread_count: conv.unread_count,
            status: conv.status,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            // 兼容旧格式
            userId: conv.user_id,
            userName: conv.user_name || `用户${conv.user_id}`,
            lastMessage: conv.last_message,
            lastMessageTime: conv.last_message_at
        }));
    }

    // 获取聊天消息
    async getChatMessages(shopId, userId, page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        
        const messages = await this.allAsync(`
            SELECT m.*, u.username as admin_name
            FROM messages m
            LEFT JOIN users u ON m.admin_id = u.id
            WHERE m.shop_id = ? AND m.user_id = ?
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [shopId, userId, limit, offset]);

        return messages.reverse().map(msg => ({
            id: msg.id,
            content: msg.message,
            sender: msg.sender,
            adminName: msg.admin_name,
            timestamp: msg.created_at,
            isRead: msg.is_read
        }));
    }

    // 获取对话消息 - 移动端API专用
    async getConversationMessages(shopId, userId, limit = 100) {
        try {
            const messages = await this.allAsync(`
                SELECT m.*, u.username as admin_name
                FROM messages m
                LEFT JOIN users u ON m.admin_id = u.id
                WHERE m.shop_id = ? AND m.user_id = ?
                ORDER BY m.created_at ASC
                LIMIT ?
            `, [shopId, userId, limit]);

            return messages.map(msg => ({
                id: msg.id,
                shop_id: msg.shop_id,
                user_id: msg.user_id,
                content: msg.message,
                sender_type: msg.sender,
                sender_id: msg.admin_id,
                admin_name: msg.admin_name,
                created_at: msg.created_at,
                is_read: msg.is_read
            }));
        } catch (error) {
            console.error('获取对话消息失败:', error);
            return [];
        }
    }

    // 标记消息为已读
    async markMessagesAsRead(shopId, userId, adminId) {
        await this.runAsync(`
            UPDATE messages 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE shop_id = ? AND user_id = ? AND sender = 'user' AND is_read = FALSE
        `, [shopId, userId]);

        // 重置对话的未读计数
        await this.runAsync(`
            UPDATE conversations 
            SET unread_count = 0, updated_at = CURRENT_TIMESTAMP
            WHERE shop_id = ? AND user_id = ?
        `, [shopId, userId]);
    }

    // 获取店铺未读消息统计
    async getShopUnreadStats(shopId) {
        const result = await this.getAsync(`
            SELECT COUNT(*) as unread_count
            FROM messages 
            WHERE shop_id = ? AND sender = 'user' AND is_read = FALSE
        `, [shopId]);

        return result ? result.unread_count : 0;
    }

    // 获取所有店铺未读消息统计
    async getAllUnreadStats() {
        const results = await this.allAsync(`
            SELECT m.shop_id, s.name as shop_name, COUNT(*) as unread_count
            FROM messages m
            JOIN shops s ON m.shop_id = s.id
            WHERE m.sender = 'user' AND m.is_read = FALSE
            GROUP BY m.shop_id, s.name
        `);

        const stats = {};
        results.forEach(row => {
            stats[row.shop_id] = {
                shopName: row.shop_name,
                unreadCount: row.unread_count
            };
        });

        return stats;
    }

    // 获取总体统计信息
    async getOverallStats(userId = null) {
        let shopCondition = '';
        let params = [];
        
        if (userId) {
            // 普通用户只能看自己的店铺统计
            shopCondition = `AND s.owner_id = ?`;
            params.push(userId);
        }

        const stats = await this.getAsync(`
            SELECT 
                COUNT(DISTINCT s.id) as total_shops,
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(DISTINCT CASE WHEN m.sender = 'user' AND m.is_read = FALSE THEN m.id END) as unread_messages
            FROM shops s
            LEFT JOIN conversations c ON s.id = c.shop_id
            LEFT JOIN messages m ON s.id = m.shop_id
            WHERE s.status = 'active' ${shopCondition}
        `, params);

        return {
            totalShops: stats?.total_shops || 0,
            totalConversations: stats?.total_conversations || 0,
            unreadMessages: stats?.unread_messages || 0
        };
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = SQLiteDatabase;
