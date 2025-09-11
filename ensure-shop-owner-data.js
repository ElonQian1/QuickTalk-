const Database = require('./database-sqlite');

async function ensureShopOwnerData() {
    const database = new Database();
    
    try {
        await database.init();
        console.log('✅ 数据库初始化成功');
        
        // 1. 查找或创建 shop_owner 用户
        let user = await database.getAsync('SELECT * FROM users WHERE username = ?', ['shop_owner']);
        
        if (!user) {
            console.log('创建 shop_owner 用户...');
            await database.runAsync('INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)', 
                ['shop_owner', database.hashPassword('123456'), 'user', 'shop_owner@test.com']);
            user = await database.getAsync('SELECT * FROM users WHERE username = ?', ['shop_owner']);
        }
        
        console.log('✅ shop_owner 用户:', user.id, user.username);
        
        // 2. 检查是否有店铺
        const shopCount = await database.getAsync('SELECT COUNT(*) as count FROM shops');
        console.log('📊 总店铺数:', shopCount.count);
        
        if (shopCount.count === 0) {
            console.log('创建测试店铺...');
            for (let i = 1; i <= 3; i++) {
                await database.runAsync(
                    'INSERT INTO shops (name, domain, description, owner_id, approval_status) VALUES (?, ?, ?, ?, ?)',
                    [`测试店铺${i}`, `shop${i}.test.com`, `这是测试店铺${i}`, user.id, 'approved']
                );
            }
        }
        
        // 3. 检查用户店铺关联
        const userShopsCount = await database.getAsync('SELECT COUNT(*) as count FROM user_shops WHERE user_id = ?', [user.id]);
        console.log('👤 用户店铺关联数:', userShopsCount.count);
        
        if (userShopsCount.count === 0) {
            console.log('创建用户店铺关联...');
            const shops = await database.allAsync('SELECT id FROM shops LIMIT 3');
            
            for (const shop of shops) {
                await database.runAsync(
                    'INSERT INTO user_shops (user_id, shop_id, role, permissions, joined_at) VALUES (?, ?, ?, ?, ?)',
                    [user.id, shop.id, 'owner', JSON.stringify(['read', 'write', 'manage']), new Date().toISOString()]
                );
                console.log(`✅ 关联店铺 ${shop.id} 给用户 ${user.id}`);
            }
        }
        
        // 4. 验证最终结果
        console.log('\n=== 验证结果 ===');
        const finalUserShops = await database.getUserShops(user.id);
        console.log('🎯 getUserShops 返回:', {
            type: typeof finalUserShops,
            isArray: Array.isArray(finalUserShops),
            length: finalUserShops ? finalUserShops.length : 'N/A',
            data: finalUserShops
        });
        
        await database.close();
        console.log('\n✅ 数据设置完成！');
        
    } catch (error) {
        console.error('❌ 设置过程出错:', error);
    }
}

ensureShopOwnerData();
