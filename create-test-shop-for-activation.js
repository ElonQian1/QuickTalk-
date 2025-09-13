const Database = require('./database-sqlite');

async function createTestShopForActivation() {
    console.log('🧪 创建测试店铺用于付费开通功能测试...\n');

    try {
        const database = new Database();
        await database.init();

        // 获取shop_owner用户
        const users = await database.getAllUsers();
        const shopOwner = users.find(u => u.username === 'shop_owner');
        
        if (!shopOwner) {
            console.log('❌ 找不到shop_owner用户');
            return;
        }

        console.log('✅ 找到shop_owner用户:', shopOwner.username);

        // 创建一个未激活的测试店铺
        const testShopData = {
            name: '待开通测试店铺',
            domain: 'test-activation.com',
            description: '这是一个专门用于测试付费开通功能的店铺'
        };

        const shopId = await database.createShop(shopOwner.id, testShopData);
        console.log('✅ 测试店铺创建成功!');
        console.log('📋 店铺信息:', {
            id: shopId,
            name: testShopData.name,
            domain: testShopData.domain,
            owner: shopOwner.username
        });

        console.log('\n💡 现在可以用这个店铺测试付费开通功能:');
        console.log('   1. 访问 http://localhost:3030/mobile/admin');
        console.log('   2. 使用 shop_owner / 123456 登录');
        console.log('   3. 找到"待开通测试店铺"并点击"付费开通"按钮');
        console.log('   4. 完成付费开通流程测试');

        await database.close();

    } catch (error) {
        console.error('❌ 创建测试店铺失败:', error.message);
    }
}

// 运行创建测试店铺
createTestShopForActivation();
