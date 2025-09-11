const fetch = require('node-fetch');

async function testSendMessage() {
    try {
        console.log('=== 测试消息发送API ===');
        
        const testMessage = {
            userId: 'test_user_' + Date.now(),
            message: '测试消息API',
            shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
            timestamp: Date.now()
        };
        
        console.log('发送测试消息:', testMessage);
        
        const response = await fetch('http://localhost:3030/api/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
                'X-Shop-Id': 'shop_1757591780450_1',
                'Origin': 'http://bbs16.929991.xyz',
                'Referer': 'http://bbs16.929991.xyz/'
            },
            body: JSON.stringify(testMessage)
        });
        
        console.log('响应状态:', response.status);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.json();
        console.log('响应结果:', result);
        
        if (response.ok) {
            console.log('✅ 消息发送成功');
        } else {
            console.log('❌ 消息发送失败');
        }
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testSendMessage();
