const Database = require('./database-sqlite.js');

async function testMessageSaving() {
    try {
        const db = new Database();
        
        console.log('=== 测试消息保存功能 ===');
        
        // 1. 查看现有消息
        console.log('\n1. 查看现有消息：');
        const allMessages = await db.allAsync('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10');
        console.log('现有消息数量:', allMessages.length);
        allMessages.forEach((msg, index) => {
            console.log(`${index + 1}. [${msg.sender}] ${msg.message} (店铺:${msg.shop_id}, 用户:${msg.user_id})`);
        });
        
        // 2. 查看对话记录
        console.log('\n2. 查看对话记录：');
        const conversations = await db.allAsync('SELECT * FROM conversations ORDER BY last_message_at DESC');
        console.log('对话记录数量:', conversations.length);
        conversations.forEach((conv, index) => {
            console.log(`${index + 1}. 店铺:${conv.shop_id}, 用户:${conv.user_id}, 未读:${conv.unread_count}, 最后消息:"${conv.last_message}"`);
        });
        
        // 3. 查看特定店铺的消息
        const targetShopId = 'shop_1757591780450_1'; // 时尚服装店的ID
        console.log(`\n3. 查看店铺 ${targetShopId} 的消息：`);
        const shopMessages = await db.allAsync(
            'SELECT * FROM messages WHERE shop_id = ? ORDER BY created_at DESC',
            [targetShopId]
        );
        console.log(`店铺消息数量: ${shopMessages.length}`);
        shopMessages.forEach((msg, index) => {
            console.log(`${index + 1}. [${msg.sender}] ${msg.message} (时间:${msg.created_at})`);
        });
        
        // 4. 查看该店铺的对话记录
        console.log(`\n4. 查看店铺 ${targetShopId} 的对话记录：`);
        try {
            const shopConversations = await db.getShopConversations(targetShopId);
            console.log(`对话数量: ${shopConversations ? shopConversations.length : 'null'}`);
            if (shopConversations && Array.isArray(shopConversations)) {
                shopConversations.forEach((conv, index) => {
                    console.log(`${index + 1}. 用户:${conv.userId}, 未读:${conv.unreadCount}, 最后消息:"${conv.lastMessage}"`);
                });
            } else {
                console.log('getShopConversations 返回值异常:', typeof shopConversations, shopConversations);
            }
        } catch (error) {
            console.error('获取对话记录失败:', error);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}

testMessageSaving();
