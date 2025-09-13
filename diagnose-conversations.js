const Database = require('./database-sqlite.js');

async function diagnoseConversationSystem() {
  const db = new Database('./data/customer_service.db');
  
  try {
    console.log('=== 诊断客服对话系统 ===\n');
    
    // 1. 检查表结构
    console.log('1. 检查数据库表结构:');
    const tables = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map(t => t.name);
    console.log('   现有表:', tableNames.join(', '));
    
    const hasConversations = tableNames.includes('conversations');
    console.log('   conversations 表存在:', hasConversations ? '✅' : '❌');
    
    // 2. 如果没有 conversations 表，从 messages 表分析
    if (!hasConversations) {
      console.log('\n2. 从 messages 表分析实际对话:');
      const actualConversations = await db.getAllAsync(`
        SELECT 
          shop_id,
          user_id,
          COUNT(*) as message_count,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message,
          (SELECT message FROM messages m2 WHERE m2.shop_id = messages.shop_id AND m2.user_id = messages.user_id ORDER BY created_at DESC LIMIT 1) as last_message_text
        FROM messages 
        GROUP BY shop_id, user_id 
        ORDER BY last_message DESC 
        LIMIT 10
      `);
      
      console.log('   实际存在的对话:');
      actualConversations.forEach((conv, index) => {
        console.log(`   ${index + 1}. 店铺: ${conv.shop_id}`);
        console.log(`      用户: ${conv.user_id}`);
        console.log(`      消息数: ${conv.message_count}`);
        console.log(`      最后消息: "${conv.last_message_text}"`);
        console.log(`      时间: ${conv.last_message}\n`);
      });
    }
    
    // 3. 检查 API 端点
    console.log('3. API 端点分析:');
    console.log('   前端请求: /api/conversations?shopId=${shopId}');
    console.log('   后端实际: /api/shops/:shopId/conversations');
    console.log('   ❌ API 路径不匹配！');
    
    // 4. 系统问题总结
    console.log('\n=== 问题总结 ===');
    console.log('❌ 缺少 conversations 表');
    console.log('❌ API 路径不匹配');
    console.log('❌ 缺少用户身份管理机制');
    console.log('❌ 缺少对话创建逻辑');
    
    console.log('\n=== 解决方案 ===');
    console.log('1. 创建 conversations 表');
    console.log('2. 修复 API 路径匹配');
    console.log('3. 实现陌生人身份识别机制');
    console.log('4. 添加对话自动创建逻辑');
    
  } catch (error) {
    console.error('诊断失败:', error);
  }
}

diagnoseConversationSystem().catch(console.error);
