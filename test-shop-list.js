/**
 * 店铺列表功能测试脚本
 * 用于验证手机端店铺管理模块是否正常工作
 */

const Database = require('./database-sqlite');

async function testShopListFunctionality() {
    console.log('🧪 开始测试店铺列表功能...\n');
    
    const database = new Database();
    await database.init();
    
    try {
        // 1. 测试获取所有店铺
        console.log('1. 测试获取所有店铺');
        const allShops = await database.getAllShops();
        console.log(`   找到 ${allShops.length} 个店铺`);
        
        if (allShops.length > 0) {
            console.log('   前3个店铺：');
            allShops.slice(0, 3).forEach((shop, index) => {
                console.log(`   ${index + 1}. ${shop.name} (${shop.domain}) - 状态: ${shop.approvalStatus}`);
            });
        }
        
        // 2. 测试获取用户店铺
        console.log('\n2. 测试获取用户店铺');
        const users = await database.getAllUsers();
        
        for (const user of users.slice(0, 2)) {
            const userShops = await database.getUserShops(user.id);
            console.log(`   用户 ${user.username} 拥有 ${userShops.length} 个店铺`);
            
            if (userShops.length > 0) {
                userShops.forEach(shop => {
                    console.log(`     - ${shop.name} (${shop.domain})`);
                });
            }
        }
        
        // 3. 测试API返回格式
        console.log('\n3. 测试API返回格式');
        const testUser = users.find(u => u.role !== 'super_admin');
        if (testUser) {
            const shops = await database.getUserShops(testUser.id);
            console.log(`   用户 ${testUser.username} 的店铺数据格式：`);
            if (shops.length > 0) {
                const firstShop = shops[0];
                console.log(`     ID: ${firstShop.id}`);
                console.log(`     名称: ${firstShop.name}`);
                console.log(`     域名: ${firstShop.domain}`);
                console.log(`     状态: ${firstShop.approvalStatus}`);
                console.log(`     创建时间: ${firstShop.createdAt}`);
                console.log(`     描述: ${firstShop.description || '无'}`);
            }
        }
        
        // 4. 测试权限验证
        console.log('\n4. 测试权限验证');
        const superAdmin = users.find(u => u.role === 'super_admin');
        const regularUser = users.find(u => u.role !== 'super_admin');
        
        if (superAdmin) {
            const adminShops = await database.getAllShops();
            console.log(`   超级管理员可以看到所有 ${adminShops.length} 个店铺`);
        }
        
        if (regularUser) {
            const userShops = await database.getUserShops(regularUser.id);
            console.log(`   普通用户 ${regularUser.username} 只能看到自己的 ${userShops.length} 个店铺`);
        }
        
        console.log('\n✅ 店铺列表功能测试完成！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
    }
}

// 运行测试
if (require.main === module) {
    testShopListFunctionality()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('测试脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = testShopListFunctionality;
