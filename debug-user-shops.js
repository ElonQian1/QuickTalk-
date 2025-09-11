const Database = require('./database-sqlite');

async function debugUserShops() {
    try {
        const database = new Database();
        await database.init();
        console.log('\n=== 调试用户店铺关联关系 ===\n');

        // 1. 检查shop_owner用户
        console.log('1. 检查shop_owner用户信息:');
        const user = await database.getUserByUsername('shop_owner');
        if (user) {
            console.log(`✅ 用户ID: ${user.id}, 用户名: ${user.username}, 角色: ${user.role}`);
        } else {
            console.log('❌ 找不到shop_owner用户');
            return;
        }

        // 2. 检查user_shops关联表
        console.log('\n2. 检查user_shops关联表:');
        const db = database.db;
        const userShopsRows = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM user_shops WHERE user_id = ?', [user.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log(`用户 ${user.id} 在user_shops表中的记录数:`, userShopsRows.length);
        if (userShopsRows.length > 0) {
            console.log('关联的店铺ID:', userShopsRows.map(row => row.shop_id));
        }

        // 3. 检查所有店铺
        console.log('\n3. 检查所有店铺:');
        const allShopsRows = await new Promise((resolve, reject) => {
            db.all('SELECT id, name, domain, owner_id FROM shops LIMIT 5', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        console.log('前5个店铺:', allShopsRows);

        // 4. 测试getUserShops方法
        console.log('\n4. 测试getUserShops方法:');
        const userShops = await database.getUserShops(user.id);
        console.log('getUserShops返回:', {
            type: typeof userShops,
            isArray: Array.isArray(userShops),
            length: userShops ? userShops.length : 'N/A',
            content: userShops
        });

        // 5. 测试getAllShops方法
        console.log('\n5. 测试getAllShops方法:');
        const allShops = await database.getAllShops();
        console.log('getAllShops返回:', {
            type: typeof allShops,
            isArray: Array.isArray(allShops),
            length: allShops ? allShops.length : 'N/A',
            firstItem: allShops && allShops[0] ? allShops[0] : 'N/A'
        });

        // 6. 如果user_shops为空，创建关联
        if (userShopsRows.length === 0 && allShopsRows.length > 0) {
            console.log('\n6. 创建用户店铺关联:');
            // 将前3个店铺关联给shop_owner
            for (let i = 0; i < Math.min(3, allShopsRows.length); i++) {
                const shop = allShopsRows[i];
                await new Promise((resolve, reject) => {
                    db.run('INSERT OR IGNORE INTO user_shops (user_id, shop_id, role, permissions) VALUES (?, ?, ?, ?)', 
                        [user.id, shop.id, 'owner', 'read,write,manage'], 
                        function(err) {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
                console.log(`✅ 关联店铺 ${shop.id} (${shop.name}) 给用户 ${user.username}`);
            }

            // 再次测试getUserShops
            console.log('\n7. 重新测试getUserShops方法:');
            const userShopsAfter = await database.getUserShops(user.id);
            console.log('getUserShops返回(创建关联后):', {
                type: typeof userShopsAfter,
                isArray: Array.isArray(userShopsAfter),
                length: userShopsAfter ? userShopsAfter.length : 'N/A',
                content: userShopsAfter
            });
        }

        await database.close();
        console.log('\n=== 调试完成 ===');

    } catch (error) {
        console.error('调试过程出错:', error);
    }
}

debugUserShops();
