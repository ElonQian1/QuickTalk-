// 店铺数据访问层
class ShopRepository {
    constructor(database) {
        this.db = database;
    }

    /**
     * 根据API密钥获取店铺
     */
    async getShopByApiKey(apiKey) {
        // 检查是否为SQLite数据库实例
        if (this.db.getShopByApiKey && typeof this.db.getShopByApiKey === 'function') {
            // 直接调用SQLite数据库的方法
            return await this.db.getShopByApiKey(apiKey);
        } else {
            // 使用内存数据库的方法
            return await this.db.getShopByApiKey(apiKey);
        }
    }

    /**
     * 根据店铺ID获取店铺
     */
    async getShopById(shopId) {
        // 检查是否为SQLite数据库实例
        if (this.db.getShopById && typeof this.db.getShopById === 'function') {
            // 直接调用SQLite数据库的方法
            return await this.db.getShopById(shopId);
        } else {
            // 使用内存数据库的方法
            const shops = await this.db.getAllShops();
            return shops.find(shop => shop.id === shopId) || null;
        }
    }

    /**
     * 根据域名获取店铺
     */
    async getShopByDomain(domain) {
        const shops = await this.db.getAllShops();
        return shops.find(shop => shop.domain === domain) || null;
    }

    /**
     * 获取所有店铺
     */
    async getAllShops() {
        return await this.db.getAllShops();
    }

    /**
     * 更新店铺最后使用时间（适配SQLite和内存数据库）
     */
    async updateLastUsed(shopId) {
        try {
            // 检查是否为SQLite数据库实例
            if (this.db.run && typeof this.db.run === 'function') {
                // SQLite数据库：更新shops表的updated_at字段
                const stmt = this.db.prepare(`
                    UPDATE shops 
                    SET updated_at = datetime('now', 'localtime') 
                    WHERE id = ?
                `);
                const result = stmt.run(shopId);
                
                if (result.changes > 0) {
                    console.log(`✅ 店铺 ${shopId} 使用时间已更新 (SQLite)`);
                    return true;
                } else {
                    console.log(`⚠️ 店铺 ${shopId} 不存在 (SQLite)`);
                    return false;
                }
            } else if (this.db.shops && this.db.shops instanceof Map) {
                // database-memory.js 使用 Map 结构，直接更新
                const shop = this.db.shops.get(shopId);
                if (shop) {
                    shop.updated_at = new Date();
                    console.log(`✅ 店铺 ${shopId} 使用时间已更新 (Memory)`);
                    return true;
                } else {
                    console.log(`⚠️ 店铺 ${shopId} 不存在 (Memory)`);
                    return false;
                }
            } else {
                // 其他数据库类型，暂时跳过更新
                console.log(`⚠️ 跳过店铺 ${shopId} 使用时间更新（不支持的数据库类型）`);
                return true; // 返回true以避免阻塞主流程
            }
        } catch (error) {
            console.error(`❌ 更新店铺 ${shopId} 使用时间失败:`, error);
            return false;
        }
    }

    /**
     * 创建新店铺（适配内存数据库）
     */
    async createShop(shopData) {
        const shopId = shopData.id;
        const shop = {
            id: shopId,
            name: shopData.name,
            domain: shopData.domain,
            api_key: shopData.api_key,
            owner_id: shopData.owner_id || 'default_owner',
            status: shopData.status || 'active',
            created_at: new Date(),
            updated_at: new Date()
        };
        
        this.db.shops.set(shopId, shop);
        return shop;
    }

    /**
     * 更新店铺API密钥
     */
    async updateApiKey(shopId, newApiKey) {
        await this.db.updateShopApiKey(shopId, newApiKey);
        return await this.getShopById(shopId);
    }

    /**
     * 验证店铺状态
     */
    async isShopActive(shopId) {
        const shop = await this.getShopById(shopId);
        return shop && shop.status === 'active';
    }
}

module.exports = ShopRepository;
