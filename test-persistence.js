const Database = require('./database-sqlite');

async function testPersistence() {
    try {
        const db = new Database();
        
        // 等待数据库初始化完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 创建一个新的测试用户
        const userData = {
            username: 'test_persistence_' + Date.now(),
            password: 'testpass123',
            email: 'test_' + Date.now() + '@example.com',
            role: 'user'
        };
        
        console.log('创建测试用户:', userData.username);
        const createdUser = await db.createUser(userData);
        
        if (createdUser) {
            console.log('✅ 用户创建成功，ID:', createdUser.id);
            console.log('用户名:', createdUser.username);
            console.log('邮箱:', createdUser.email);
            console.log('创建时间:', createdUser.created_at);
            console.log('\n请重启服务器后运行以下命令验证数据持久化:');
            console.log(`node -e "const Database = require('./database-sqlite'); const db = new Database(); setTimeout(() => { db.db.get('SELECT * FROM users WHERE id = \\'${createdUser.id}\\'', (err, row) => { console.log('重启后用户数据:', row); process.exit(0); }); }, 2000);"`);
        } else {
            console.log('❌ 用户创建失败');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

testPersistence();
