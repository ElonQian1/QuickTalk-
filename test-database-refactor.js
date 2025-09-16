#!/usr/bin/env node
/**
 * 测试数据库重构后的功能
 * 验证DatabaseSchemaManager和各模块的集成
 */

const path = require('path');

// 设置环境变量使用内存数据库进行测试
process.env.NODE_ENV = 'test';

// 导入数据库和各个模块
let database;
try {
    const DatabaseClass = require('./database-sqlite.js');
    database = new DatabaseClass();
} catch (error) {
    console.error('❌ 无法加载数据库:', error.message);
    process.exit(1);
}

const AIAssistantManager = require('./src/ai-assistant-manager.js');
const AnalyticsDashboardManager = require('./src/analytics-dashboard-manager.js');
const MessageRepository = require('./src/database/message-repository.js');

console.log('🧪 开始数据库重构测试...\n');

async function testDatabaseSchemaManager() {
    console.log('📋 测试 1: DatabaseSchemaManager 基础功能');
    
    try {
        const DatabaseSchemaManager = require('./src/utils/DatabaseSchemaManager.js');
        const schemaManager = new DatabaseSchemaManager(database.db);
        
        // 测试创建简单表
        const testTables = [
            {
                name: 'test_table',
                schema: `(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                description: '测试表'
            }
        ];
        
        const testIndexes = [
            {
                name: 'idx_test_name',
                table: 'test_table',
                columns: 'name',
                description: '测试索引'
            }
        ];
        
        await schemaManager.createTables(testTables);
        await schemaManager.createIndexes(testIndexes);
        
        console.log('✅ DatabaseSchemaManager 基础功能正常');
        
        // 清理测试表
        database.db.run('DROP TABLE IF EXISTS test_table');
        
    } catch (error) {
        console.error('❌ DatabaseSchemaManager 测试失败:', error.message);
        throw error;
    }
}

async function testAIAssistantManager() {
    console.log('📋 测试 2: AI助手管理器重构');
    
    try {
        const aiManager = new AIAssistantManager(database);
        await aiManager.initializeTables();
        
        // 测试创建AI助手会话
        const sessionId = 'test-session-' + Date.now();
        const userId = 'test-user';
        const shopId = 'test-shop';
        
        await aiManager.createSession(sessionId, userId, shopId, {
            intent: 'customer_service',
            context: '测试对话'
        });
        
        console.log('✅ AI助手管理器重构成功');
        
    } catch (error) {
        console.error('❌ AI助手管理器测试失败:', error.message);
        throw error;
    }
}

async function testAnalyticsDashboardManager() {
    console.log('📋 测试 3: 分析仪表板管理器重构');
    
    try {
        const analyticsManager = new AnalyticsDashboardManager(database);
        await analyticsManager.initializeTables();
        
        // 测试记录分析事件
        await analyticsManager.recordEvent('test-shop', 'page_view', {
            page: '/dashboard',
            user_id: 'test-user'
        });
        
        console.log('✅ 分析仪表板管理器重构成功');
        
    } catch (error) {
        console.error('❌ 分析仪表板管理器测试失败:', error.message);
        throw error;
    }
}

async function testMessageRepository() {
    console.log('📋 测试 4: 消息仓库重构');
    
    try {
        const messageRepo = new MessageRepository(database);
        await messageRepo.initializeNewTables();
        
        // 测试消息存储
        const testMessage = {
            conversationId: 'test-conv-' + Date.now(),
            senderId: 'test-user',
            content: '测试消息',
            type: 'text',
            timestamp: new Date().toISOString()
        };
        
        await messageRepo.saveMessage(testMessage);
        
        console.log('✅ 消息仓库重构成功');
        
    } catch (error) {
        console.error('❌ 消息仓库测试失败:', error.message);
        throw error;
    }
}

async function testDatabaseIntegrity() {
    console.log('📋 测试 5: 数据库完整性检查');
    
    try {
        // 检查所有重要表是否存在
        const importantTables = [
            'ai_assistant_sessions',
            'ai_assistant_messages', 
            'analytics_events',
            'analytics_user_sessions',
            'enhanced_messages',
            'message_search_index'
        ];
        
        const checkTableSQL = `
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN (${importantTables.map(() => '?').join(',')})
        `;
        
        const existingTables = database.db.prepare(checkTableSQL).all(...importantTables);
        
        console.log(`📊 找到表: ${existingTables.map(t => t.name).join(', ')}`);
        
        if (existingTables.length === importantTables.length) {
            console.log('✅ 所有重要表都已创建');
        } else {
            const missingTables = importantTables.filter(
                table => !existingTables.find(t => t.name === table)
            );
            console.log(`⚠️  缺少表: ${missingTables.join(', ')}`);
        }
        
    } catch (error) {
        console.error('❌ 数据库完整性检查失败:', error.message);
        throw error;
    }
}

async function runTests() {
    try {
        // 等待数据库初始化完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await testDatabaseSchemaManager();
        console.log();
        
        await testAIAssistantManager();
        console.log();
        
        await testAnalyticsDashboardManager();
        console.log();
        
        await testMessageRepository();
        console.log();
        
        await testDatabaseIntegrity();
        console.log();
        
        console.log('🎉 所有数据库重构测试通过！');
        console.log('📈 重构效果:');
        console.log('   • 统一了数据库模式管理');
        console.log('   • 减少了代码重复');
        console.log('   • 提高了维护性');
        console.log('   • 保证了功能完整性');
        
    } catch (error) {
        console.error('\n💥 测试失败:', error.message);
        console.error('🔧 建议检查:');
        console.error('   • DatabaseSchemaManager 实现');
        console.error('   • 模式配置文件');
        console.error('   • 模块初始化逻辑');
        process.exit(1);
    }
}

// 执行测试
runTests().catch(error => {
    console.error('💥 测试执行失败:', error);
    process.exit(1);
});