const Database = require('./database-sqlite.js');

/**
 * 修复对话同步问题 - 确保 messages 表中的消息在 conversations 表中有对应的对话记录
 */
async function fixConversationSync() {
    const db = new Database('./data/customer_service.db');
    
    try {
        console.log('=== 开始修复对话同步问题 ===\n');
        
        // 1. 查找 messages 表中没有对应 conversations 记录的消息
        console.log('1. 查找孤立的消息（没有对应对话记录）:');
        const orphanMessages = await db.getAllAsync(`
            SELECT DISTINCT 
                m.shop_id,
                m.user_id,
                COUNT(*) as message_count,
                MIN(m.created_at) as first_message_at,
                MAX(m.created_at) as last_message_at,
                (SELECT message FROM messages m2 WHERE m2.shop_id = m.shop_id AND m2.user_id = m.user_id ORDER BY created_at DESC LIMIT 1) as last_message
            FROM messages m
            LEFT JOIN conversations c ON (c.shop_id = m.shop_id AND c.user_id = m.user_id)
            WHERE c.id IS NULL
            GROUP BY m.shop_id, m.user_id
            ORDER BY last_message_at DESC
        `);
        
        console.log(`   发现 ${orphanMessages.length} 个孤立对话需要创建`);
        
        // 2. 为每个孤立消息创建对话记录
        for (const msg of orphanMessages) {
            const conversationId = `${msg.shop_id}_${msg.user_id}`;
            const userName = msg.user_id.includes('test_') || msg.user_id.includes('customer_') || msg.user_id.includes('final_') || msg.user_id.includes('user_correct_') 
                ? `测试用户${msg.user_id}` 
                : `匿名客户${msg.user_id}`;
            
            console.log(`   创建对话: ${conversationId}`);
            console.log(`     - 用户: ${userName}`);
            console.log(`     - 消息数: ${msg.message_count}`);
            console.log(`     - 最后消息: "${msg.last_message}"`);
            
            await db.runAsync(`
                INSERT INTO conversations (
                    id, shop_id, user_id, user_name, 
                    last_message, last_message_at, 
                    unread_count, status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                conversationId,
                msg.shop_id,
                msg.user_id,
                userName,
                msg.last_message,
                msg.last_message_at,
                msg.message_count, // 将消息数设为未读数
                'active',
                msg.first_message_at,
                msg.last_message_at
            ]);
        }
        
        console.log(`\n✅ 成功创建 ${orphanMessages.length} 个对话记录`);
        
        // 3. 验证修复结果
        console.log('\n3. 验证修复结果:');
        const totalConversations = await db.getAllAsync('SELECT COUNT(*) as count FROM conversations');
        const totalMessages = await db.getAllAsync('SELECT COUNT(DISTINCT shop_id || "_" || user_id) as count FROM messages');
        
        console.log(`   对话表记录数: ${totalConversations[0].count}`);
        console.log(`   消息表中的唯一对话: ${totalMessages[0].count}`);
        console.log(`   同步状态: ${totalConversations[0].count === totalMessages[0].count ? '✅ 已同步' : '❌ 仍有差异'}`);
        
        // 4. 显示最新的对话列表
        console.log('\n4. 最新对话列表:');
        const latestConversations = await db.getShopConversations('shop_1757591780450_1');
        console.log(`   店铺 shop_1757591780450_1 的对话数: ${latestConversations.length}`);
        latestConversations.slice(0, 5).forEach((conv, index) => {
            console.log(`   ${index + 1}. ${conv.customer_name}: "${conv.last_message}" (${conv.last_message_at})`);
        });
        
        console.log('\n=== 对话同步修复完成 ===');
        
    } catch (error) {
        console.error('❌ 修复失败:', error);
    }
}

fixConversationSync().catch(console.error);
