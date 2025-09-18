/**
 * 店铺数据访问层
 * 负责店铺相关的所有数据库操作
 */
const DatabaseCore = require('./database-core');

class ShopRepository {
    constructor(databaseCore) {
        this.db = databaseCore;
    }

    /**
     * 初始化店铺相关表
     */
    async initializeTables() {
        // 创建店铺表
        await this.db.createTableIfNotExists('shops', `
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            api_key TEXT UNIQUE,
            owner_username TEXT,
            owner_password TEXT,
            owner_email TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_used_at DATETIME,
            settings TEXT DEFAULT '{}'
        `);

        // 创建店铺使用统计表
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

        // 创建索引
        await this.db.createIndexIfNotExists('idx_shops_api_key', 'shops', 'api_key');
        await this.db.createIndexIfNotExists('idx_shops_domain', 'shops', 'domain');
        await this.db.createIndexIfNotExists('idx_shops_status', 'shops', 'status');
        await this.db.createIndexIfNotExists('idx_shop_usage_shop_id', 'shop_usage_stats', 'shop_id');
        await this.db.createIndexIfNotExists('idx_shop_usage_date', 'shop_usage_stats', 'date');

        console.log('✅ 店铺相关表初始化完成');
    }

    /**
     * 创建新店铺
     */
    async createShop(shopData) {
        const {
            id,
            name,
            domain,
            api_key,
            owner_username,
            owner_password,
            owner_email,
            settings = '{}'
        } = shopData;

        const sql = `
            INSERT INTO shops (
                id, name, domain, api_key, owner_username, 
                owner_password, owner_email, settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await this.db.run(sql, [
            id, name, domain, api_key, owner_username,
            owner_password, owner_email, JSON.stringify(settings)
        ]);

        console.log(`🏪 新店铺创建成功: ${name} (${id})`);
        return result;
    }

    /**
     * 根据ID获取店铺
     */
    async getShopById(shopId) {
        const sql = 'SELECT * FROM shops WHERE id = ?';
        const shop = await this.db.get(sql, [shopId]);
        
        if (shop && shop.settings) {
            shop.settings = JSON.parse(shop.settings);
        }
        
        return shop;
    }

    /**
     * 根据API密钥获取店铺
     */
    async getShopByApiKey(apiKey) {
        const sql = 'SELECT * FROM shops WHERE api_key = ?';
        const shop = await this.db.get(sql, [apiKey]);
        
        if (shop && shop.settings) {
            shop.settings = JSON.parse(shop.settings);
        }
        
        return shop;
    }

    /**
     * 根据域名获取店铺
     */
    async getShopByDomain(domain) {
        const sql = 'SELECT * FROM shops WHERE domain = ?';
        const shop = await this.db.get(sql, [domain]);
        
        if (shop && shop.settings) {
            shop.settings = JSON.parse(shop.settings);
        }
        
        return shop;
    }

    /**
     * 获取所有店铺
     */
    async getAllShops() {
        const sql = 'SELECT * FROM shops ORDER BY created_at DESC';
        const shops = await this.db.query(sql);
        
        return shops.map(shop => {
            if (shop.settings) {
                shop.settings = JSON.parse(shop.settings);
            }
            return shop;
        });
    }

    /**
     * 获取活跃店铺
     */
    async getActiveShops() {
        const sql = 'SELECT * FROM shops WHERE status = ? ORDER BY last_used_at DESC';
        const shops = await this.db.query(sql, ['active']);
        
        return shops.map(shop => {
            if (shop.settings) {
                shop.settings = JSON.parse(shop.settings);
            }
            return shop;
        });
    }

    /**
     * 更新店铺API密钥
     */
    async updateApiKey(shopId, newApiKey) {
        const sql = `
            UPDATE shops 
            SET api_key = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        const result = await this.db.run(sql, [newApiKey, shopId]);
        console.log(`🔑 店铺 ${shopId} API密钥已更新`);
        return result;
    }

    /**
     * 更新店铺域名
     */
    async updateDomain(shopId, newDomain) {
        const sql = `
            UPDATE shops 
            SET domain = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        const result = await this.db.run(sql, [newDomain, shopId]);
        console.log(`🌐 店铺 ${shopId} 域名已更新为: ${newDomain}`);
        return result;
    }

    /**
     * 更新店铺信息
     */
    async updateShop(shopId, updateData) {
        const allowedFields = ['name', 'domain', 'owner_email', 'status', 'settings'];
        const updates = [];
        const values = [];

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(key === 'settings' ? JSON.stringify(value) : value);
            }
        }

        if (updates.length === 0) {
            throw new Error('没有有效的更新字段');
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(shopId);

        const sql = `UPDATE shops SET ${updates.join(', ')} WHERE id = ?`;
        const result = await this.db.run(sql, values);
        
        console.log(`🏪 店铺 ${shopId} 信息已更新`);
        return result;
    }

    /**
     * 更新店铺最后使用时间
     */
    async updateLastUsed(shopId) {
        // 兼容现有表结构，使用updated_at字段而不是last_used_at
        const sql = `
            UPDATE shops 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `;
        
        await this.db.run(sql, [shopId]);
    }

    /**
     * 删除店铺
     */
    async deleteShop(shopId) {
        const sql = 'DELETE FROM shops WHERE id = ?';
        const result = await this.db.run(sql, [shopId]);
        
        console.log(`🗑️ 店铺 ${shopId} 已删除`);
        return result;
    }

    /**
     * 检查店铺是否存在
     */
    async shopExists(shopId) {
        const sql = 'SELECT 1 FROM shops WHERE id = ?';
        const result = await this.db.get(sql, [shopId]);
        return !!result;
    }

    /**
     * 检查API密钥是否存在
     */
    async apiKeyExists(apiKey) {
        const sql = 'SELECT 1 FROM shops WHERE api_key = ?';
        const result = await this.db.get(sql, [apiKey]);
        return !!result;
    }

    /**
     * 检查域名是否已被使用
     */
    async domainExists(domain) {
        const sql = 'SELECT 1 FROM shops WHERE domain = ?';
        const result = await this.db.get(sql, [domain]);
        return !!result;
    }

    /**
     * 记录店铺使用统计
     */
    async recordUsageStats(shopId, statsData = {}) {
        const today = new Date().toISOString().split('T')[0];
        const {
            requests = 1,
            messages = 0,
            uniqueVisitors = 0
        } = statsData;

        const sql = `
            INSERT INTO shop_usage_stats (shop_id, date, total_requests, total_messages, unique_visitors)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(shop_id, date) DO UPDATE SET
                total_requests = total_requests + ?,
                total_messages = total_messages + ?,
                unique_visitors = CASE WHEN ? > 0 THEN unique_visitors + ? ELSE unique_visitors END
        `;

        await this.db.run(sql, [
            shopId, today, requests, messages, uniqueVisitors,
            requests, messages, uniqueVisitors, uniqueVisitors
        ]);
    }

    /**
     * 获取店铺使用统计
     */
    async getUsageStats(shopId, days = 30) {
        const sql = `
            SELECT 
                date,
                total_requests,
                total_messages,
                unique_visitors
            FROM shop_usage_stats 
            WHERE shop_id = ? 
                AND date >= date('now', '-${days} days')
            ORDER BY date DESC
        `;

        return await this.db.query(sql, [shopId]);
    }

    /**
     * 获取店铺总统计
     */
    async getTotalStats(shopId) {
        const sql = `
            SELECT 
                COUNT(*) as total_days,
                SUM(total_requests) as total_requests,
                SUM(total_messages) as total_messages,
                SUM(unique_visitors) as total_visitors,
                MAX(date) as last_active_date
            FROM shop_usage_stats 
            WHERE shop_id = ?
        `;

        return await this.db.get(sql, [shopId]);
    }
}

module.exports = ShopRepository;
