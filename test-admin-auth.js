// 测试管理员认证和API访问
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

async function testAdminAuth() {
    try {
        console.log('🧪 测试管理员认证流程...');

        // 1. 尝试登录获取会话ID
        console.log('\n1️⃣ 管理员登录...');
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'shop_owner',
                password: '123456'
            })
        });

        const loginResult = await loginResponse.json();
        console.log('登录响应:', loginResult);

        if (!loginResponse.ok || !loginResult.sessionId) {
            console.log('❌ 登录失败');
            return;
        }

        const sessionId = loginResult.sessionId;
        console.log('✅ 登录成功，会话ID:', sessionId.substring(0, 20) + '...');

        // 2. 测试访问对话消息API
        console.log('\n2️⃣ 测试访问对话消息...');
        const conversationId = 'shop_1757591780450_1_user_1757591780450_3';
        const messagesResponse = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
            headers: {
                'X-Session-Id': sessionId
            }
        });

        console.log('API响应状态:', messagesResponse.status, messagesResponse.statusText);

        if (messagesResponse.ok) {
            const messagesResult = await messagesResponse.json();
            console.log('✅ 消息获取成功:', messagesResult.length || 0, '条消息');
        } else {
            const errorResult = await messagesResponse.json().catch(() => ({ error: '无法解析错误信息' }));
            console.log('❌ 消息获取失败:', errorResult);
        }

        // 3. 测试其他需要认证的API
        console.log('\n3️⃣ 测试用户信息API...');
        const userResponse = await fetch(`${API_BASE}/auth/user`, {
            headers: {
                'X-Session-Id': sessionId
            }
        });

        if (userResponse.ok) {
            const userResult = await userResponse.json();
            console.log('✅ 用户信息获取成功:', userResult);
        } else {
            console.log('❌ 用户信息获取失败:', userResponse.status);
        }

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    }
}

// 等待一秒后开始测试，确保服务器启动完成
setTimeout(testAdminAuth, 1000);
