/**
 * 数据库测试脚本 - 调试messages表问题
 */

const Database = require('./database-sqlite');

async function testDatabaseSchema() {
    console.log('🔍 开始数据库模式测试...');
    
    const database = new Database();
    await database.init();
    
    try {
        // 1. 检查messages表的结构
        console.log('\n📋 检查messages表结构:');
        const tableInfo = await database.allAsync("PRAGMA table_info(messages)");
        console.table(tableInfo);
        
        // 2. 测试简单插入
        console.log('\n🧪 测试简单插入:');
        const testMessageId = `test_${Date.now()}`;
        
        await database.runAsync(`
            INSERT INTO messages (id, shop_id, user_id, admin_id, message, sender, created_at)
            VALUES (?, ?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP)
        `, [testMessageId, 'test_shop', 'test_user', 'test_admin', 'test message']);
        
        console.log('✅ 简单插入成功');
        
        // 3. 测试带新字段的插入
        console.log('\n🧪 测试带新字段的插入:');
        const testMessageId2 = `test_${Date.now()}_2`;
        
        await database.runAsync(`
            INSERT INTO messages (id, shop_id, user_id, admin_id, message, message_type, file_id, sender, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', CURRENT_TIMESTAMP)
        `, [testMessageId2, 'test_shop', 'test_user', 'test_admin', 'test message with media', 'image', 'test_file_id']);
        
        console.log('✅ 带新字段插入成功');
        
        // 4. 查询测试数据
        console.log('\n📄 查询插入的测试数据:');
        const testMessages = await database.allAsync(
            "SELECT * FROM messages WHERE id LIKE 'test_%' ORDER BY created_at DESC LIMIT 5"
        );
        console.table(testMessages);
        
        // 5. 清理测试数据
        console.log('\n🧹 清理测试数据:');
        await database.runAsync("DELETE FROM messages WHERE id LIKE 'test_%'");
        console.log('✅ 测试数据已清理');
        
    } catch (error) {
        console.error('❌ 数据库测试失败:', error);
        console.error('错误详情:', error.message);
        console.error('SQL状态:', error.code);
    } finally {
        await database.close();
        console.log('\n✅ 数据库测试完成');
    }
}

// 运行测试
testDatabaseSchema().catch(console.error);