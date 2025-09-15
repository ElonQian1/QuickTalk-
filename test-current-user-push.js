/**
 * 测试向当前在线的客户端用户推送消息
 * 目标用户: user_w81kc3j1v_1757966417735 (从日志中看到的在线用户)
 */

const http = require('http');

async function testCurrentUserPush() {
    const baseURL = 'http://localhost:3030';
    
    // 从最新日志中获取的信息
    const sessionId = 'sess_1757962874895_dqoqcu6on'; // 管理员session
    const conversationId = 'shop_1757591780450_1_w81kc3j1v_1757966417735'; // 对话ID
    const targetUserId = 'user_w81kc3j1v_1757966417735'; // 目标用户
    
    console.log('🧪 测试向当前在线的客户端用户推送消息');
    console.log('📋 测试参数:');
    console.log(`   目标用户: ${targetUserId}`);
    console.log(`   对话ID: ${conversationId}`);
    console.log(`   管理员Session: ${sessionId}`);
    console.log('');
    
    try {
        // 发送消息给在线用户
        const testMessage = `管理员修复测试消息 - ${Date.now()}`;
        
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
                'x-session-id': sessionId,
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
            console.log('🎉 消息成功推送给在线客户端用户！用户ID匹配问题已解决！');
        } else {
            console.log('⚠️ 消息推送失败，可能需要进一步调试');
        }
        
        // 显示测试提示
        console.log('\n📱 请在客户端界面检查是否收到消息:');
        console.log(`   消息内容: "${testMessage}"`);
        console.log(`   如果收到消息，说明修复成功！`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 立即执行测试
testCurrentUserPush();