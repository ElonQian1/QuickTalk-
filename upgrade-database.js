const Database = require('./database-sqlite.js');

async function upgradeDatabase() {
    try {
        const db = new Database();
        
        console.log('=== 数据库升级：添加API密钥列 ===');
        
        // 检查是否已经有api_key列
        try {
            await db.runAsync('SELECT api_key FROM shops LIMIT 1');
            console.log('✅ api_key 列已存在，无需升级');
            return;
        } catch (error) {
            if (error.message.includes('no such column: api_key')) {
                console.log('🔧 需要添加 api_key 列');
            } else {
                throw error;
            }
        }
        
        // 添加api_key列
        console.log('正在添加 api_key 列到 shops 表...');
        await db.runAsync('ALTER TABLE shops ADD COLUMN api_key TEXT');
        console.log('✅ api_key 列添加成功');
        
        // 为现有店铺生成API密钥
        function generateApiKey() {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let result = 'sk_';
            for (let i = 0; i < 32; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
        
        console.log('正在为现有店铺生成API密钥...');
        const shops = await db.allAsync('SELECT id, name, domain FROM shops WHERE api_key IS NULL');
        
        for (const shop of shops) {
            const apiKey = generateApiKey();
            await db.runAsync(
                'UPDATE shops SET api_key = ?, updated_at = ? WHERE id = ?',
                [apiKey, new Date().toISOString(), shop.id]
            );
            console.log(`✅ 为店铺 "${shop.name}" (${shop.domain}) 生成API密钥: ${apiKey}`);
        }
        
        console.log('🎉 数据库升级完成！');
        
        // 显示更新后的店铺信息
        console.log('\n=== 更新后的店铺信息 ===');
        const updatedShops = await db.allAsync('SELECT id, name, domain, api_key FROM shops');
        updatedShops.forEach(shop => {
            console.log(`店铺: ${shop.name}`);
            console.log(`域名: ${shop.domain}`);
            console.log(`API密钥: ${shop.api_key}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('数据库升级失败:', error);
        process.exit(1);
    }
}

upgradeDatabase();
