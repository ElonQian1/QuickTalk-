// 测试shop_owner用户的店铺数据
const Database = require('./database-sqlite');

// 测试shop_owner用户的店铺数据
const Database = require('./database-sqlite');

async function testShopOwnerData() {
    console.log('🧪 测试shop_owner用户的店铺数据...\n');
    
    try {
        const database = new Database();
        await database.init();
        console.log('✅ 数据库初始化成功');
        
        // 1. 查找shop_owner用户
        const users = await database.allAsync('SELECT * FROM users WHERE username = ?', ['shop_owner']);
        
        if (users.length === 0) {
            console.log('❌ 未找到shop_owner用户');
            // 查看所有用户
            const allUsers = await database.allAsync('SELECT username, role FROM users');
            console.log('📋 所有用户:', allUsers);
            return;
        }
        
        const user = users[0];
        console.log('✅ 找到用户:', user.username, 'ID:', user.id, 'Role:', user.role);
        
        // 2. 直接查询user_shops表
        const userShopsRaw = await database.allAsync('SELECT * FROM user_shops WHERE user_id = ?', [user.id]);
        console.log('📋 user_shops表记录数:', userShopsRaw.length);
        
        if (userShopsRaw.length > 0) {
            console.log('📄 前3条user_shops记录:', userShopsRaw.slice(0, 3));
        } else {
            console.log('⚠️ user_shops表中没有该用户的记录');
            // 查看该用户拥有的店铺（owner_id）
            const ownedShops = await database.allAsync('SELECT * FROM shops WHERE owner_id = ?', [user.id]);
            console.log('👤 用户作为owner的店铺数量:', ownedShops.length);
            if (ownedShops.length > 0) {
                console.log('🏪 用户拥有的店铺:', ownedShops.slice(0, 3).map(s => ({id: s.id, name: s.name, domain: s.domain})));
            }
        }
        
        // 3. 使用getUserShops方法
        const userShops = await database.getUserShops(user.id);
        console.log('🏪 getUserShops返回数据类型:', typeof userShops);
        console.log('🏪 是否为数组:', Array.isArray(userShops));
        console.log('🏪 数组长度:', userShops ? userShops.length : 'undefined');
        
        if (userShops && userShops.length > 0) {
            console.log('📦 前3个店铺数据:', userShops.slice(0, 3));
        } else {
            console.log('⚠️ getUserShops返回空数组或undefined');
        }
        
        // 4. 查看所有店铺表数据
        const allShops = await database.allAsync('SELECT COUNT(*) as count FROM shops');
        console.log('📊 shops表总记录数:', allShops[0].count);
        
        // 5. 模拟API返回
        console.log('\n🔄 模拟API调用结果:');
        const apiResult = userShops || [];
        console.log('API将返回数组长度:', apiResult.length);
        if (apiResult.length > 0) {
            console.log('API返回数据预览:', JSON.stringify(apiResult.slice(0, 1), null, 2));
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        throw error;
    }
}
}

// 运行测试
testShopOwnerData().then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
}).catch(error => {
    console.error('测试异常:', error);
    process.exit(1);
});
