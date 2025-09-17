/**
 * 数据库初始化器
 * 负责创建表结构、索引和初始化测试数据
 * 从database-sqlite.js迁移而来，适配新的Repository架构
 */

const bcrypt = require('bcrypt');

class DatabaseInitializer {
    constructor(databaseCore) {
        this.db = databaseCore;
    }

    /**
     * 初始化所有数据库表和数据
     */
    async initialize() {
        console.log('🔧 开始初始化数据库结构...');
        
        try {
            await this.createAllTables();
            await this.createAllIndexes();
            await this.runMigrations();
            await this.initTestData();
            
            console.log('✅ 数据库结构初始化完成');
        } catch (error) {
            console.error('❌ 数据库结构初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建所有表
     */
    async createAllTables() {
        console.log('📋 创建数据库表...');

        // 用户表
        await this.db.createTableIfNotExists('users', `
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME
        `);

        // 店铺表
        await this.db.createTableIfNotExists('shops', `
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            api_key TEXT UNIQUE,
            owner_id TEXT,
            owner_username TEXT,
            owner_password TEXT,
            owner_email TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME,
            settings TEXT DEFAULT '{}',
            FOREIGN KEY (owner_id) REFERENCES users(id)
        `);

        // 对话表
        await this.db.createTableIfNotExists('conversations', `
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            customer_name TEXT,
            customer_email TEXT,
            customer_id TEXT,
            admin_id TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_message_at DATETIME,
            FOREIGN KEY (shop_id) REFERENCES shops(id),
            FOREIGN KEY (admin_id) REFERENCES users(id)
        `);

        // 消息表
        await this.db.createTableIfNotExists('messages', `
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            shop_id TEXT NOT NULL,
            content TEXT NOT NULL,
            sender_type TEXT NOT NULL,
            sender_id TEXT,
            sender_name TEXT,
            message_type TEXT DEFAULT 'text',
            file_url TEXT,
            file_type TEXT,
            file_size INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT 0,
            metadata TEXT DEFAULT '{}',
            FOREIGN KEY (conversation_id) REFERENCES conversations(id),
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        `);

        // 文件表
        await this.db.createTableIfNotExists('files', `
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            path TEXT NOT NULL,
            size INTEGER NOT NULL,
            type TEXT NOT NULL,
            uploaded_by TEXT,
            shop_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        `);

        // 会话表
        await this.db.createTableIfNotExists('sessions', `
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            shop_id TEXT,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        `);

        // 付费开通订单表
        await this.db.createTableIfNotExists('activation_orders', `
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_method TEXT,
            transaction_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME,
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        `);

        // 店铺使用统计表
        await this.db.createTableIfNotExists('shop_usage_stats', `
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id TEXT NOT NULL,
            date DATE NOT NULL,
            total_requests INTEGER DEFAULT 0,
            total_messages INTEGER DEFAULT 0,
            unique_visitors INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id),
            UNIQUE(shop_id, date)
        `);

        console.log('✅ 所有表创建完成');
    }

    /**
     * 创建所有索引
     */
    async createAllIndexes() {
        console.log('🔍 创建数据库索引...');

        // 用户表索引
        await this.db.createIndexIfNotExists('idx_users_username', 'users', 'username');
        await this.db.createIndexIfNotExists('idx_users_email', 'users', 'email');
        await this.db.createIndexIfNotExists('idx_users_role', 'users', 'role');

        // 店铺表索引
        await this.db.createIndexIfNotExists('idx_shops_api_key', 'shops', 'api_key');
        await this.db.createIndexIfNotExists('idx_shops_domain', 'shops', 'domain');
        await this.db.createIndexIfNotExists('idx_shops_owner_id', 'shops', 'owner_id');
        await this.db.createIndexIfNotExists('idx_shops_status', 'shops', 'status');

        // 对话表索引
        await this.db.createIndexIfNotExists('idx_conversations_shop_id', 'conversations', 'shop_id');
        // 暂时注释掉customer_id索引，避免与现有数据库结构冲突
        // await this.db.createIndexIfNotExists('idx_conversations_customer_id', 'conversations', 'customer_id');
        await this.db.createIndexIfNotExists('idx_conversations_status', 'conversations', 'status');

        // 消息表索引
        // 暂时注释掉有问题的索引，避免与现有数据库结构冲突
        // await this.db.createIndexIfNotExists('idx_messages_conversation_id', 'messages', 'conversation_id');
        await this.db.createIndexIfNotExists('idx_messages_shop_id', 'messages', 'shop_id');
        // await this.db.createIndexIfNotExists('idx_messages_timestamp', 'messages', 'timestamp');
        await this.db.createIndexIfNotExists('idx_messages_sender_type', 'messages', 'sender_type');

        // 文件表索引
        await this.db.createIndexIfNotExists('idx_files_shop_id', 'files', 'shop_id');
        await this.db.createIndexIfNotExists('idx_files_type', 'files', 'type');

        // 会话表索引
        await this.db.createIndexIfNotExists('idx_sessions_user_id', 'sessions', 'user_id');
        await this.db.createIndexIfNotExists('idx_sessions_expires_at', 'sessions', 'expires_at');

        // 统计表索引
        await this.db.createIndexIfNotExists('idx_shop_usage_shop_id', 'shop_usage_stats', 'shop_id');
        await this.db.createIndexIfNotExists('idx_shop_usage_date', 'shop_usage_stats', 'date');

        console.log('✅ 所有索引创建完成');
    }

    /**
     * 运行数据库迁移
     */
    async runMigrations() {
        console.log('🔄 运行数据库迁移...');
        
        // 这里可以添加版本迁移逻辑
        // 目前暂时为空，未来可以添加表结构变更的迁移脚本
        
        console.log('✅ 数据库迁移完成');
    }

    /**
     * 初始化测试数据
     */
    async initTestData() {
        console.log('📝 初始化测试数据...');

        try {
            // 检查是否已有数据
            const existingUsers = await this.db.query('SELECT COUNT(*) as count FROM users');
            if (existingUsers[0].count > 0) {
                console.log('ℹ️ 发现已有数据，跳过测试数据初始化');
                return;
            }

            // 创建默认超级管理员
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await this.db.run(
                'INSERT INTO users (id, username, password, email, role) VALUES (?, ?, ?, ?, ?)',
                ['admin', 'admin', hashedPassword, 'admin@quicktalk.com', 'super_admin']
            );

            // 创建测试店铺
            await this.db.run(
                'INSERT INTO shops (id, name, domain, api_key, owner_id, status) VALUES (?, ?, ?, ?, ?, ?)',
                ['shop1', '测试店铺', 'test.com', 'test-api-key-123', 'admin', 'active']
            );

            console.log('✅ 测试数据初始化完成');
            console.log('🔑 默认管理员账号: admin / admin123');
        } catch (error) {
            console.error('❌ 测试数据初始化失败:', error);
            throw error;
        }
    }
}

module.exports = DatabaseInitializer;