// WebSocket连接测试脚本
// 测试模块化WebSocket系统

const WebSocket = require('ws');

const config = {
    wsUrl: 'ws://localhost:3030/ws',
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    userId: 'user_test_websocket_' + Date.now()
};

console.log('🚀 开始测试WebSocket模块化系统...');
console.log('配置信息:', config);

async function testWebSocket() {
    return new Promise((resolve, reject) => {
        console.log('🔗 连接WebSocket服务器...');
        const ws = new WebSocket(config.wsUrl);
        
        let authenticated = false;
        let messageReceived = false;
        
        ws.on('open', () => {
            console.log('✅ WebSocket连接成功');
            
            // 发送认证消息
            const authMessage = {
                type: 'auth',
                userId: config.userId,
                shopKey: config.shopKey,
                shopId: config.shopId
            };
            
            console.log('📤 发送认证消息:', authMessage);
            ws.send(JSON.stringify(authMessage));
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                console.log('📨 收到消息:', message);
                
                if (message.type === 'connection_established') {
                    console.log('🔗 连接已建立');
                }
                
                if (message.type === 'auth_success') {
                    console.log('✅ 认证成功');
                    authenticated = true;
                    
                    // 发送测试消息
                    const testMessage = {
                        type: 'send_message',
                        userId: config.userId,
                        shopId: config.shopId,
                        shopKey: config.shopKey,
                        message: '这是一条WebSocket测试消息！',
                        timestamp: Date.now()
                    };
                    
                    console.log('📤 发送测试消息:', testMessage.message);
                    ws.send(JSON.stringify(testMessage));
                }
                
                if (message.type === 'message_sent') {
                    console.log('✅ 消息发送确认');
                    messageReceived = true;
                }
                
                if (message.type === 'staff_message') {
                    console.log('📨 收到客服回复:', message.message);
                }
                
            } catch (e) {
                console.error('❌ 消息解析失败:', e);
            }
        });
        
        ws.on('close', (code, reason) => {
            console.log(`🔌 连接关闭: ${code} - ${reason}`);
            
            if (authenticated && messageReceived) {
                console.log('✅ 测试成功完成！');
                resolve(true);
            } else {
                console.log('❌ 测试未完全成功');
                resolve(false);
            }
        });
        
        ws.on('error', (error) => {
            console.error('❌ WebSocket错误:', error);
            reject(error);
        });
        
        // 10秒后自动关闭测试
        setTimeout(() => {
            console.log('⏰ 测试时间结束，关闭连接');
            ws.close();
        }, 10000);
    });
}

// 测试客服回复API
async function testStaffReply() {
    console.log('🧪 测试客服回复API...');
    
    try {
        const response = await fetch('http://localhost:3030/api/admin/send-reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversationId: `${config.shopId}_${config.userId}`,
                content: '您好！这是来自客服的WebSocket推送回复！',
                senderId: 'admin_test',
                messageType: 'staff'
            })
        });
        
        const result = await response.json();
        console.log('📤 客服回复API响应:', result);
        
        if (result.success) {
            console.log(`✅ 客服回复发送成功，WebSocket推送: ${result.data.pushed}`);
        } else {
            console.log('❌ 客服回复发送失败:', result.error);
        }
        
    } catch (e) {
        console.error('❌ 客服回复测试失败:', e);
    }
}

// 主测试流程
async function runTest() {
    try {
        // 1. 测试WebSocket连接和消息发送
        console.log('\n=== 第1步: 测试WebSocket连接 ===');
        const wsTestResult = await testWebSocket();
        
        // 2. 等待2秒
        console.log('\n⏳ 等待2秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. 测试客服回复API
        console.log('\n=== 第2步: 测试客服回复API ===');
        await testStaffReply();
        
        // 4. 检查服务器状态
        console.log('\n=== 第3步: 检查服务器状态 ===');
        const statusResponse = await fetch('http://localhost:3030/api/websocket/status');
        const status = await statusResponse.json();
        console.log('📊 WebSocket服务器状态:', status.data);
        
        console.log('\n🎉 测试完成！');
        
    } catch (e) {
        console.error('❌ 测试失败:', e);
    }
}

// 启动测试
runTest();
