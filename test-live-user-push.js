/**
 * 测试向在线客户端用户推送消息
 * 目标用户: user_8yzycra22_1757966200722 (从日志中看到的在线用户)
 */

const https = require('https');
const http = require('http');

async function testLiveUserPush() {
    const baseURL = 'http://localhost:3030';
    
    // 更新信息：从最新日志和数据库中获取
    const sessionId = 'sess_1757962874895_dqoqcu6on'; // 管理员session
    const conversationId = 'shop_1757591780450_1_8yzycra22_1757966200722'; // 对话ID（不带user_前缀）
    const targetUserId = 'user_8yzycra22_1757966200722'; // 目标用户
    
    console.log('🧪 测试向在线客户端用户推送消息');
    console.log('📋 测试参数:');
    console.log(`   目标用户: ${targetUserId}`);
    console.log(`   对话ID: ${conversationId}`);
    console.log(`   管理员Session: ${sessionId}`);
    console.log('');
    
    try {
        // 发送消息给在线用户
        const testMessage = `管理员测试消息 - ${Date.now()}`;
        
        console.log('📤 发送管理员消息...');
        
        const postData = JSON.stringify({
            content: testMessage
        });
        
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: `/api/conversations/${conversationId}/messages`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-session-id': sessionId,  // 使用正确的header
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(data);
                        resolve({
                            status: res.statusCode,
                            data: parsedData
                        });
                    } catch (e) {
                        resolve({
                            status: res.statusCode,
                            data: data
                        });
                    }
                });
            });
            
            req.on('error', (e) => {
                reject(e);
            });
            
            req.write(postData);
            req.end();
        });
        
        console.log('✅ 管理员消息发送结果:');
        console.log(`   HTTP状态: ${response.status}`);
        console.log(`   响应数据:`, response.data);
        console.log(`   WebSocket推送状态: ${response.data.webSocketPushed ? '成功' : '失败'}`);
        
        if (response.data.webSocketPushed) {
            console.log('🎉 消息成功推送给在线客户端用户！');
        } else {
            console.log('⚠️ 消息推送失败，用户可能不在线');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 立即执行测试
testLiveUserPush();