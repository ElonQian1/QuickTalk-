/**
 * 调试工具：显示当前WebSocket连接状态
 */

const http = require('http');

async function debugWebSocketConnections() {
    const baseURL = 'http://localhost:3030';
    
    console.log('🔍 调试当前WebSocket连接状态...');
    console.log('');
    
    try {
        const options = {
            hostname: 'localhost',
            port: 3030,
            path: '/api/websocket/users',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
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
            
            req.end();
        });
        
        console.log('📊 WebSocket连接状态:');
        console.log(`   HTTP状态: ${response.status}`);
        console.log(`   响应数据:`, JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.clients) {
            console.log('\n👥 当前在线用户:');
            for (const [userId, userInfo] of Object.entries(response.data.clients)) {
                console.log(`   用户ID: ${userId}`);
                console.log(`   店铺ID: ${userInfo.shopId || '未知'}`);
                console.log(`   连接时间: ${userInfo.connectedAt || '未知'}`);
                console.log(`   认证状态: ${userInfo.authenticated ? '已认证' : '未认证'}`);
                console.log('   ---');
            }
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
    }
}

// 立即执行调试
debugWebSocketConnections();