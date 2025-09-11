const Database = require('./database-sqlite');
const sqlite3 = require('sqlite3');

async function directDatabaseCheck() {
    console.log('=== 直接数据库检查 ===\n');
    
    // 直接打开数据库
    const db = new sqlite3.Database('./data/customer_service.db');
    
    return new Promise((resolve, reject) => {
        // 1. 检查用户表
        db.all("SELECT id, username, role FROM users WHERE username = 'shop_owner'", [], (err, rows) => {
            if (err) {
                console.error('查询用户失败:', err);
                reject(err);
                return;
            }
            
            console.log('1. shop_owner 用户信息:', rows);
            
            if (rows.length === 0) {
                console.log('❌ 找不到 shop_owner 用户');
                db.close();
                resolve();
                return;
            }
            
            const user = rows[0];
            
            // 2. 检查 user_shops 关联
            db.all("SELECT * FROM user_shops WHERE user_id = ?", [user.id], (err, userShops) => {
                if (err) {
                    console.error('查询用户店铺关联失败:', err);
                    reject(err);
                    return;
                }
                
                console.log('2. user_shops 关联记录:', userShops);
                
                // 3. 检查所有店铺
                db.all("SELECT id, name, domain, owner_id FROM shops LIMIT 5", [], (err, shops) => {
                    if (err) {
                        console.error('查询店铺失败:', err);
                        reject(err);
                        return;
                    }
                    
                    console.log('3. 前5个店铺:', shops);
                    
                    // 4. 如果没有关联，创建一些
                    if (userShops.length === 0 && shops.length > 0) {
                        console.log('4. 创建用户店铺关联...');
                        const shop = shops[0];
                        
                        db.run("INSERT OR REPLACE INTO user_shops (user_id, shop_id, role, permissions) VALUES (?, ?, 'owner', 'read,write,manage')", 
                            [user.id, shop.id], function(err) {
                                if (err) {
                                    console.error('创建关联失败:', err);
                                    reject(err);
                                    return;
                                }
                                
                                console.log('✅ 成功创建关联: 用户', user.id, '-> 店铺', shop.id);
                                
                                // 5. 验证创建结果
                                db.all("SELECT * FROM user_shops WHERE user_id = ?", [user.id], (err, newUserShops) => {
                                    if (err) {
                                        console.error('验证关联失败:', err);
                                        reject(err);
                                        return;
                                    }
                                    
                                    console.log('5. 创建后的用户店铺关联:', newUserShops);
                                    db.close();
                                    resolve();
                                });
                            });
                    } else {
                        db.close();
                        resolve();
                    }
                });
            });
        });
    });
}

directDatabaseCheck().then(() => {
    console.log('\n=== 检查完成 ===');
}).catch(err => {
    console.error('检查过程出错:', err);
});
