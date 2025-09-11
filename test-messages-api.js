const fetch = require('node-fetch');

async function testMessagesAPI() {
    try {
        console.log('=== 测试消息获取API ===');
        
        const testUserId = 'user_u8csia3ug_1757595262148'; // 使用实际的用户ID
        const url = `http://localhost:3030/api/messages?userId=${testUserId}&lastId=0`;
        
        console.log('请求URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
                'X-Shop-Id': 'shop_1757591780450_1',
                'Origin': 'http://bbs16.929991.xyz',
                'Referer': 'http://bbs16.929991.xyz/',
                'User-Agent': 'Mozilla/5.0 (test client)'
            }
        });
        
        console.log('响应状态:', response.status);
        console.log('响应状态文本:', response.statusText);
        console.log('响应头:', Object.fromEntries(response.headers.entries()));
        
        const result = await response.text(); // 先获取文本，避免JSON解析错误
        console.log('响应内容:', result);
        
        if (response.ok) {
            console.log('✅ 消息获取成功');
            try {
                const jsonResult = JSON.parse(result);
                console.log('解析后的JSON:', jsonResult);
            } catch (e) {
                console.log('JSON解析失败:', e.message);
            }
        } else {
            console.log('❌ 消息获取失败');
        }
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

testMessagesAPI();
