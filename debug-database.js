/**
 * 数据库调试脚本 - 查看用户和店铺数据
 */

const Database = require('./database-sqlite');

async function debugDatabase() {
    const db = new Database();
    
    console.log('=== 🔍 数据库调试信息 ===\n');
    
    try {
        // 1. 查看所有用户
        console.log('📋 所有用户:');
        const users = await db.getAllUsers();
        users.forEach(user => {
            console.log(`  👤 ${user.username} (ID: ${user.id}) - 角色: ${user.role}`);
        });
        
        // 2. 查看所有店铺
        console.log('\n🏪 所有店铺:');
        const shops = await db.getAllShops();
        shops.forEach(shop => {
            console.log(`  🏬 ${shop.name} (ID: ${shop.id}) - 所有者ID: ${shop.ownerId} - 状态: ${shop.approvalStatus}`);
        });
        
        // 3. 查找shop_owner用户
        console.log('\n🎯 查找shop_owner用户:');
        const shopOwner = users.find(u => u.username === 'shop_owner');
        if (shopOwner) {
            console.log(`  ✅ 找到用户: ${shopOwner.username} (ID: ${shopOwner.id})`);
            
            // 4. 查看该用户的店铺
            console.log('\n🔍 shop_owner的店铺关联:');
            const userShops = await db.getUserShops(shopOwner.id);
            console.log(`  📊 关联店铺数量: ${userShops.length}`);
            userShops.forEach(shop => {
                console.log(`    🏬 店铺: ${shop.name} - 角色: ${shop.userRole} - 状态: ${shop.approvalStatus}`);
            });
            
            // 5. 检查shop_owner直接拥有的店铺
            console.log('\n🔍 shop_owner直接拥有的店铺:');
            const ownedShops = shops.filter(shop => shop.ownerId === shopOwner.id);
            console.log(`  📊 拥有店铺数量: ${ownedShops.length}`);
            ownedShops.forEach(shop => {
                console.log(`    🏬 店铺: ${shop.name} - 状态: ${shop.approvalStatus}`);
            });
            
        } else {
            console.log('  ❌ 未找到shop_owner用户');
        }
        
        // 6. 检查用户店铺关联表
        console.log('\n📋 用户店铺关联详情:');
        if (db.userShops && db.userShops.size > 0) {
            for (const [userId, userShopsList] of db.userShops.entries()) {
                const user = users.find(u => u.id === userId);
                console.log(`  👤 用户 ${user ? user.username : userId}:`);
                userShopsList.forEach(us => {
                    const shop = shops.find(s => s.id === us.shopId);
                    console.log(`    🔗 店铺: ${shop ? shop.name : us.shopId} - 角色: ${us.role}`);
                });
            }
        } else {
            console.log('  ⚠️ 用户店铺关联表为空或未初始化');
        }
        
    } catch (error) {
        console.error('❌ 调试过程中出错:', error);
    }
    
    console.log('\n=== 调试完成 ===');
    process.exit(0);
}

debugDatabase().catch(console.error);
