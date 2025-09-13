// 测试客户端API的脚本
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

// 测试数据
const testData = {
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    userId: 'test_user_' + Date.now(),
    domain: 'bbs16.929991.xyz'
};

console.log('🧪 开始测试客户端API...');
console.log('测试数据:', testData);

async function testAPI() {
    try {
        // 1. 测试安全连接API
        console.log('\n1️⃣ 测试安全连接API...');
        const connectResponse = await fetch(`${API_BASE}/secure-connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': testData.shopKey,
                'X-Shop-Id': testData.shopId
            },
            body: JSON.stringify({
                userId: testData.userId,
                timestamp: Date.now(),
                shopKey: testData.shopKey,
                shopId: testData.shopId,
                domain: testData.domain,
                version: '1.0.2'
            })
        });

        const connectResult = await connectResponse.json();
        console.log('连接响应:', connectResult);

        if (connectResponse.ok) {
            console.log('✅ 安全连接成功');
        } else {
            console.log('❌ 安全连接失败');
            // 尝试基础连接
            console.log('\n🔄 尝试基础连接API...');
            const basicConnectResponse = await fetch(`${API_BASE}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: testData.userId,
                    timestamp: Date.now()
                })
            });
            
            const basicConnectResult = await basicConnectResponse.json();
            console.log('基础连接响应:', basicConnectResult);
        }

        // 2. 测试发送消息API
        console.log('\n2️⃣ 测试发送消息API...');
        const sendResponse = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': testData.shopKey,
                'X-Shop-Id': testData.shopId
            },
            body: JSON.stringify({
                userId: testData.userId,
                message: '测试消息：客服系统集成是否正常？',
                shopKey: testData.shopKey,
                timestamp: Date.now()
            })
        });

        const sendResult = await sendResponse.json();
        console.log('发送响应:', sendResult);

        if (sendResponse.ok) {
            console.log('✅ 消息发送成功');
        } else {
            console.log('❌ 消息发送失败');
        }

        // 3. 测试获取消息API
        console.log('\n3️⃣ 测试获取消息API...');
        const messagesResponse = await fetch(`${API_BASE}/client/messages?userId=${testData.userId}&lastId=0`, {
            headers: {
                'X-Shop-Key': testData.shopKey,
                'X-Shop-Id': testData.shopId
            }
        });

        const messagesResult = await messagesResponse.json();
        console.log('消息获取响应:', messagesResult);

        if (messagesResponse.ok) {
            console.log('✅ 消息获取成功');
        } else {
            console.log('❌ 消息获取失败');
        }

        // 4. 测试健康检查API
        console.log('\n4️⃣ 测试健康检查API...');
        const healthResponse = await fetch(`${API_BASE}/health`);
        const healthResult = await healthResponse.json();
        console.log('健康检查响应:', healthResult);

        if (healthResponse.ok) {
            console.log('✅ 健康检查成功');
        } else {
            console.log('❌ 健康检查失败');
        }

        console.log('\n🎉 API测试完成！');

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    }
}

// 等待一秒后开始测试，确保服务器启动完成
setTimeout(testAPI, 1000);
