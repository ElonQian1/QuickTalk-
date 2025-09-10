// 测试登录功能
const Database = require('./database.js');

async function testLogin() {
    const db = new Database();
    
    console.log('🧪 测试登录功能...');
    console.log('👥 当前数据库用户数量:', db.users.size);
    
    // 列出所有用户
    console.log('\n📋 所有用户账号:');
    for (const [id, user] of db.users) {
        console.log(`   - ${user.username} (${user.role}) - 密码哈希: ${user.password}`);
    }
    
    // 测试 shop_owner 登录
    try {
        console.log('\n🔐 测试 shop_owner 登录...');
        const result = await db.loginUser('shop_owner', '123456');
        console.log('✅ shop_owner 登录成功!', result);
    } catch (error) {
        console.log('❌ shop_owner 登录失败:', error.message);
        
        // 手动验证密码哈希
        const shopOwner = Array.from(db.users.values()).find(u => u.username === 'shop_owner');
        if (shopOwner) {
            const expectedHash = db.hashPassword('123456');
            console.log('🔍 密码验证详情:');
            console.log('   存储的密码哈希:', shopOwner.password);
            console.log('   期望的密码哈希:', expectedHash);
            console.log('   哈希是否匹配:', shopOwner.password === expectedHash);
        }
    }
    
    // 测试其他账号
    const testAccounts = [
        ['admin', 'admin123'],
        ['reviewer', 'reviewer123'],
        ['shop_owner2', '123456']
    ];
    
    for (const [username, password] of testAccounts) {
        try {
            const result = await db.loginUser(username, password);
            console.log(`✅ ${username} 登录成功!`);
        } catch (error) {
            console.log(`❌ ${username} 登录失败:`, error.message);
        }
    }
}

testLogin().catch(console.error);
