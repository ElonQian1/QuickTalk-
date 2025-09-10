const Database = require('./database-sqlite');

async function checkAndAddShops() {
    const db = new Database();
    await db.init();
    
    console.log('检查现有店铺...');
    const allShops = await db.getAllShops();
    console.log(`找到 ${allShops.length} 个店铺:`);
    console.log(allShops);
    
    // 检查用户
    const users = await db.getAllUsers();
    console.log(`\n找到 ${users.length} 个用户:`);
    users.forEach(user => {
        console.log(`- ${user.username} (ID: ${user.id}, 角色: ${user.role})`);
    });
    
    // 如果没有店铺，创建一些测试数据
    if (allShops.length === 0) {
        console.log('\n没有找到店铺，创建测试数据...');
        
        // 确保有测试用户
        let testUser = users.find(u => u.username === 'admin');
        if (!testUser) {
            console.log('创建测试管理员用户...');
            const userId = await db.createUser('admin', 'admin123', 'super_admin');
            testUser = { id: userId, username: 'admin', role: 'super_admin' };
        }
        
        // 创建测试店铺
        const shopData = [
            {
                name: '淘宝旗舰店',
                domain: 'shop1.taobao.com',
                description: '我们的主要淘宝店铺',
                ownerId: testUser.id
            },
            {
                name: '京东专营店',
                domain: 'shop.jd.com',
                description: '京东平台专营店',
                ownerId: testUser.id
            },
            {
                name: '天猫超市',
                domain: 'tmall.shop.com',
                description: '天猫平台超市店铺',
                ownerId: testUser.id
            }
        ];
        
        for (const shop of shopData) {
            try {
                const shopId = await db.createShop(
                    shop.name,
                    shop.domain,
                    shop.description,
                    shop.ownerId
                );
                console.log(`✅ 创建店铺: ${shop.name} (ID: ${shopId})`);
            } catch (error) {
                console.error(`❌ 创建店铺失败: ${shop.name}`, error.message);
            }
        }
        
        // 重新检查
        const newShops = await db.getAllShops();
        console.log(`\n现在有 ${newShops.length} 个店铺:`);
        newShops.forEach(shop => {
            console.log(`- ${shop.name} (${shop.domain}) - 状态: ${shop.approvalStatus}`);
        });
    }
    
    process.exit(0);
}

checkAndAddShops().catch(console.error);
