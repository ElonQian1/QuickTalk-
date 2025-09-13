const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function checkMessages() {
    console.log('🔍 检查消息表结构...');
    
    const dbPath = path.join(__dirname, 'data', 'customer_service.db');
    const db = new sqlite3.Database(dbPath);
    
    try {
        const messages = await new Promise((resolve, reject) => {
            db.all(
                'SELECT id, shop_id, user_id, message, sender, admin_id, created_at FROM messages WHERE shop_id = ? ORDER BY created_at DESC LIMIT 10',
                ['shop_1757591780450_1'],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        console.log('📋 最近的消息:');
        messages.forEach(msg => {
            console.log(`- ${msg.id}: ${msg.sender} -> ${msg.message.substring(0, 50)}...`);
            console.log(`  admin_id: ${msg.admin_id}, created_at: ${msg.created_at}`);
        });
    } catch (err) {
        console.error('❌ 错误:', err);
    } finally {
        db.close();
    }
}

checkMessages();
