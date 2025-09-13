// 测试客户端API的消息收发功能
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';
const SHOP_KEY = 'sk_ji85ucic9p00m12as1ygf34o8humuxfl';
const SHOP_ID = 'shop_1757591780450_1';
const USER_ID = 'user_test_message_fix_' + Date.now();

async function testClientMessages() {
    console.log('🧪 开始测试客户端消息收发...');
    console.log(`👤 测试用户ID: ${USER_ID}`);
    
    try {
        // 1. 发送客户端消息
        console.log('\n📤 1. 发送客户端消息...');
        const sendResponse = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': SHOP_KEY,
                'X-Shop-Id': SHOP_ID
            },
            body: JSON.stringify({
                userId: USER_ID,
                message: '测试消息：客户端发送',
                shopKey: SHOP_KEY,
                timestamp: Date.now()
            })
        });
        
        const sendResult = await sendResponse.json();
        console.log('📤 发送结果:', sendResult.success ? '成功' : '失败');
        
        if (!sendResult.success) {
            console.error('❌ 发送失败:', sendResult.error);
            return;
        }
        
        // 2. 等待一下，然后模拟管理员回复
        console.log('\n💬 2. 模拟管理员回复...');
        
        // 这里我们需要通过管理后台API发送回复
        const adminLoginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        const loginResult = await adminLoginResponse.json();
        console.log('🔐 管理员登录:', loginResult.success ? '成功' : '失败');
        
        if (loginResult.success) {
            const sessionId = loginResult.sessionId;
            
            // 发送管理员回复
            const conversationId = `${SHOP_ID}_${USER_ID}`;
            const replyResponse = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `sessionId=${sessionId}`
                },
                body: JSON.stringify({
                    content: '测试回复：管理员回复客户'
                })
            });
            
            const replyResult = await replyResponse.json();
            console.log('💬 管理员回复:', replyResult.success ? '成功' : '失败');
        }
        
        // 3. 客户端获取消息
        console.log('\n📥 3. 客户端获取消息...');
        const getResponse = await fetch(`${API_BASE}/client/messages?userId=${USER_ID}&lastId=0`, {
            headers: {
                'X-Shop-Key': SHOP_KEY,
                'X-Shop-Id': SHOP_ID
            }
        });
        
        const getResult = await getResponse.json();
        console.log('📥 获取结果:', getResult.success ? '成功' : '失败');
        
        if (getResult.success) {
            console.log('📨 客户端应该收到的消息:');
            getResult.data.messages.forEach(msg => {
                console.log(`  - ${msg.type}: ${msg.message}`);
            });
            
            if (getResult.data.messages.length === 0) {
                console.log('⚠️ 客户端没有收到任何消息，问题可能仍然存在');
            }
        } else {
            console.error('❌ 获取消息失败:', getResult.error);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testClientMessages();
