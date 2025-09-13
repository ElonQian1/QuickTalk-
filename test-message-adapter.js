const MessageAdapter = require('./src/database/MessageAdapter.js');
const SQLiteDatabase = require('./database-sqlite.js');

async function testMessageAdapter() {
    const database = new SQLiteDatabase();
    
    // 等待数据库初始化完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const adapter = new MessageAdapter(database);
    
    try {
        const messages = await adapter.getConversationMessages('shop_1757591780450_1_user_67bi6gybb_1757684317815');
        console.log('客户端应该收到的消息:');
        messages.forEach(msg => {
            console.log(`- ${msg.sender_type}: ${msg.content}`);
        });
    } catch (err) {
        console.error('❌ 错误:', err);
    }
}

testMessageAdapter();
