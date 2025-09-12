const Database = require('./database-sqlite');

async function initConversationTestData() {
    const database = new Database();
    
    // 等待数据库初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
        console.log('🚀 开始创建对话测试数据...');
        
        // 获取现有用户和店铺
        const admin = await database.getUserByUsername('admin');
        const shopOwner = await database.getUserByUsername('shop_owner');
        
        if (!admin || !shopOwner) {
            console.log('⚠️ 基础用户不存在，先创建基础用户...');
            return;
        }
        
        // 检查是否已有店铺
        let shops = await database.getUserShops(shopOwner.id);
        
        if (shops.length === 0) {
            console.log('📦 创建测试店铺...');
            // 创建测试店铺
            const shopId = 'shop_' + Date.now() + '_1';
            await database.runAsync(`
                INSERT INTO shops (id, owner_id, name, domain, status, approval_status, service_status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [shopId, shopOwner.id, '测试服装店', 'test-shop.com', 'active', 'approved', 'active']);
            
            // 刷新店铺列表
            shops = await database.getUserShops(shopOwner.id);
        }
        
        const shop = shops[0];
        console.log('🏪 使用店铺:', shop.name, shop.id);
        
        // 创建测试对话
        const testUsers = [
            { id: 'user_1757591780450_1', name: '张小明' },
            { id: 'user_1757591780450_2', name: '李美丽' },
            { id: 'user_1757591780450_3', name: '王大强' }
        ];
        
        for (const user of testUsers) {
            // 检查对话是否已存在
            const existingConversation = await database.getAsync(`
                SELECT id FROM conversations WHERE shop_id = ? AND user_id = ?
            `, [shop.id, user.id]);
            
            if (!existingConversation) {
                console.log(`💬 创建对话: ${user.name} (${user.id})`);
                
                // 创建对话
                await database.runAsync(`
                    INSERT INTO conversations (id, shop_id, user_id, user_name, last_message, last_message_at, unread_count, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    `${shop.id}_${user.id}`,
                    shop.id,
                    user.id,
                    user.name,
                    '您好，请问有什么可以帮助您的吗？',
                    new Date().toISOString(),
                    2,
                    'active'
                ]);
                
                // 创建一些测试消息
                const messages = [
                    { sender: 'user', content: '你好，我想了解一下这件衣服的材质', time: -5 },
                    { sender: 'admin', content: '您好！这件衣服是100%纯棉材质，透气性很好', time: -4 },
                    { sender: 'user', content: '有其他颜色吗？', time: -3 },
                    { sender: 'admin', content: '有的，我们有黑色、白色、蓝色三种颜色可选', time: -2 },
                    { sender: 'user', content: '好的，我再考虑一下', time: -1 }
                ];
                
                for (const [index, msg] of messages.entries()) {
                    const messageId = `msg_${Date.now()}_${user.id}_${index}`;
                    const messageTime = new Date(Date.now() + msg.time * 60000).toISOString(); // 分钟前的时间
                    
                    await database.runAsync(`
                        INSERT INTO messages (id, shop_id, user_id, admin_id, message, sender, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        messageId,
                        shop.id,
                        user.id,
                        msg.sender === 'admin' ? shopOwner.id : null,
                        msg.content,
                        msg.sender,
                        messageTime
                    ]);
                }
                
                // 更新对话的最后消息
                const lastMessage = messages[messages.length - 1];
                await database.runAsync(`
                    UPDATE conversations 
                    SET last_message = ?, last_message_at = ?
                    WHERE shop_id = ? AND user_id = ?
                `, [lastMessage.content, new Date().toISOString(), shop.id, user.id]);
            } else {
                console.log(`✅ 对话已存在: ${user.name}`);
            }
        }
        
        console.log('✅ 对话测试数据创建完成！');
        console.log('📱 现在您可以访问 http://localhost:3030/mobile/admin 测试三级导航架构');
        console.log('🎯 测试流程: 消息总览 → 点击店铺 → 查看对话列表 → 点击客户 → 进入聊天界面');
        
    } catch (error) {
        console.error('❌ 创建测试数据失败:', error);
    }
    
    process.exit(0);
}

// 运行脚本
initConversationTestData();
