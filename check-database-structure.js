const Database = require('./database-sqlite.js');

async function checkDatabaseStructure() {
    try {
        const db = new Database();
        
        console.log('=== 检查数据库表结构 ===');
        
        // 检查conversations表结构
        console.log('\n--- conversations表结构 ---');
        try {
            const conversationsSchema = await db.allAsync("PRAGMA table_info(conversations)");
            console.log('conversations列:', conversationsSchema.map(col => `${col.name} (${col.type})`));
        } catch (error) {
            console.log('conversations表不存在或有问题:', error.message);
        }
        
        // 检查messages表结构
        console.log('\n--- messages表结构 ---');
        try {
            const messagesSchema = await db.allAsync("PRAGMA table_info(messages)");
            console.log('messages列:', messagesSchema.map(col => `${col.name} (${col.type})`));
        } catch (error) {
            console.log('messages表不存在或有问题:', error.message);
        }
        
        // 检查shops表结构
        console.log('\n--- shops表结构 ---');
        try {
            const shopsSchema = await db.allAsync("PRAGMA table_info(shops)");
            console.log('shops列:', shopsSchema.map(col => `${col.name} (${col.type})`));
        } catch (error) {
            console.log('shops表不存在或有问题:', error.message);
        }
        
        // 检查现有数据
        console.log('\n=== 检查现有数据 ===');
        
        // 检查shops数据
        const shops = await db.allAsync("SELECT id, name, domain FROM shops LIMIT 5");
        console.log('shops数据:', shops);
        
        // 检查conversations数据
        const conversations = await db.allAsync("SELECT * FROM conversations LIMIT 5");
        console.log('conversations数据:', conversations);
        
        // 检查messages数据
        const messages = await db.allAsync("SELECT * FROM messages LIMIT 5");
        console.log('messages数据:', messages);
        
        process.exit(0);
    } catch (error) {
        console.error('检查失败:', error);
        process.exit(1);
    }
}

checkDatabaseStructure();
