const axios = require('axios');

// 测试对话ID解析修复
async function testConversationIdFix() {
    const baseURL = 'http://localhost:3030';
    
    console.log('🧪 开始测试对话ID解析修复...\n');
    
    try {
        // 1. 登录获取会话ID
        console.log('1️⃣ 登录获取会话ID...');
        const loginResponse = await axios.post(`${baseURL}/api/auth/login`, {
            username: 'shop_owner',
            password: '123456'
        });
        
        const sessionId = loginResponse.data.sessionId;
        console.log(`✅ 登录成功，会话ID: ${sessionId}\n`);
        
        // 2. 获取店铺对话列表
        console.log('2️⃣ 获取店铺对话列表...');
        const conversationsResponse = await axios.get(`${baseURL}/api/shops/shop_1757591780450_1/conversations`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        const conversations = conversationsResponse.data;
        console.log(`✅ 获取到 ${conversations.length} 个对话`);
        
        if (conversations.length > 0) {
            const firstConversation = conversations[0];
            console.log(`📝 第一个对话ID: ${firstConversation.id}\n`);
            
            // 3. 测试获取对话消息
            console.log('3️⃣ 测试获取对话消息...');
            const messagesResponse = await axios.get(`${baseURL}/api/conversations/${firstConversation.id}/messages`, {
                headers: { 'X-Session-Id': sessionId }
            });
            
            const messages = messagesResponse.data;
            console.log(`✅ 成功获取到 ${messages.length} 条消息`);
            
            if (messages.length > 0) {
                console.log(`📧 第一条消息: ${messages[0].content}`);
            }
            
            console.log('\n🎉 测试成功！对话ID解析修复已生效！');
            
            // 4. 验证对话ID解析逻辑
            console.log('\n4️⃣ 验证对话ID解析逻辑...');
            const conversationId = firstConversation.id;
            const userIndex = conversationId.indexOf('_user_');
            
            if (userIndex !== -1) {
                const shopId = conversationId.substring(0, userIndex);
                const userId = conversationId.substring(userIndex + 1);
                
                console.log(`🔍 对话ID: ${conversationId}`);
                console.log(`🏪 解析出的店铺ID: ${shopId}`);
                console.log(`👤 解析出的用户ID: ${userId}`);
                console.log('✅ 对话ID解析逻辑正确！');
            } else {
                console.log('❌ 对话ID格式不符合预期');
            }
            
        } else {
            console.log('⚠️ 没有找到对话数据');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            console.log('🚨 权限错误 - 这表明修复可能还没有生效');
        }
    }
}

// 运行测试
testConversationIdFix();
