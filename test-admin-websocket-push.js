/**
 * 管理后台WebSocket推送功能测试
 * 测试场景：客户端连接后，管理后台通过API发送消息，客户端应能收到WebSocket推送
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const CONFIG = {
    wsUrl: 'ws://localhost:3030/ws',
    apiUrl: 'http://localhost:3030',
    shopKey: 'shop_1757591780450_1',
    testUserId: 'user_test_admin_push_' + Date.now(),
    adminUsername: 'admin',
    adminPassword: 'admin123'
};

class AdminWebSocketTest {
    constructor() {
        this.ws = null;
        this.adminSession = null;
        this.messagesReceived = [];
        this.testResults = {
            websocketConnection: false,
            userAuth: false,
            adminLogin: false,
            messageReceived: false
        };
    }

    // 创建WebSocket连接并认证
    async connectAndAuth() {
        console.log('🔌 连接WebSocket服务器...');
        
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(CONFIG.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接成功');
                this.testResults.websocketConnection = true;
                
                // 发送用户认证
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    userId: CONFIG.testUserId,
                    shopKey: CONFIG.shopKey,
                    shopId: CONFIG.shopKey
                }));
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('📨 收到WebSocket消息:', data.type, data.message ? `"${data.message}"` : '');
                
                this.messagesReceived.push(data);
                
                if (data.type === 'auth_success') {
                    console.log('✅ 用户认证成功');
                    this.testResults.userAuth = true;
                    resolve();
                } else if (data.type === 'staff_message') {
                    console.log('✅ 收到客服消息:', data.message);
                    this.testResults.messageReceived = true;
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket错误:', error);
                reject(error);
            };
            
            setTimeout(() => reject(new Error('连接超时')), 5000);
        });
    }

    // 管理员登录获取session
    async adminLogin() {
        console.log('🔐 管理员登录...');
        
        const response = await fetch(`${CONFIG.apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: CONFIG.adminUsername,
                password: CONFIG.adminPassword
            })
        });
        
        if (!response.ok) {
            throw new Error('管理员登录失败');
        }
        
        const loginData = await response.json();
        console.log('📊 登录响应:', JSON.stringify(loginData, null, 2));
        
        // 获取session cookie或使用sessionId
        const cookies = response.headers.get('set-cookie');
        if (cookies) {
            this.adminSession = cookies.split(';')[0];
            console.log('✅ 管理员登录成功 (cookie)');
            this.testResults.adminLogin = true;
        } else if (loginData.sessionId) {
            this.adminSession = `sessionId=${loginData.sessionId}`;
            console.log('✅ 管理员登录成功 (sessionId)');
            this.testResults.adminLogin = true;
        } else {
            throw new Error('未获取到session或sessionId');
        }
    }

    // 通过管理后台API发送消息
    async sendAdminMessage() {
        console.log('📤 管理后台发送消息...');
        
        const conversationId = `${CONFIG.shopKey}_${CONFIG.testUserId}`;
        
        const response = await fetch(`${CONFIG.apiUrl}/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Cookie': this.adminSession
            },
            body: JSON.stringify({
                content: '这是来自管理后台的WebSocket推送测试消息！',
                senderId: 'admin_test'
            })
        });
        
        const result = await response.json();
        console.log('📊 API响应:', result);
        
        if (result.success) {
            console.log('✅ 管理后台API调用成功');
        } else {
            console.log('❌ 管理后台API调用失败:', result.error);
        }
        
        return result;
    }

    // 等待WebSocket消息
    async waitForWebSocketMessage(timeoutSeconds = 10) {
        console.log(`⏰ 等待WebSocket消息 (${timeoutSeconds}秒)...`);
        
        const initialCount = this.messagesReceived.length;
        let elapsed = 0;
        
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                elapsed += 0.5;
                
                // 检查是否收到新的staff_message
                const staffMessages = this.messagesReceived.filter(msg => msg.type === 'staff_message');
                if (staffMessages.length > 0) {
                    console.log('✅ 收到客服WebSocket消息:', staffMessages[staffMessages.length - 1].message);
                    clearInterval(checkInterval);
                    resolve(true);
                    return;
                }
                
                if (elapsed >= timeoutSeconds) {
                    console.log('⏰ 等待超时，未收到WebSocket消息');
                    clearInterval(checkInterval);
                    resolve(false);
                }
            }, 500);
        });
    }

    // 运行完整测试
    async runTest() {
        console.log('🚀 开始管理后台WebSocket推送测试...\n');
        
        try {
            // 1. 连接WebSocket并认证
            await this.connectAndAuth();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 2. 管理员登录
            await this.adminLogin();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 3. 发送管理后台消息
            const apiResult = await this.sendAdminMessage();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 4. 等待WebSocket消息
            const receivedMessage = await this.waitForWebSocketMessage(8);
            
            // 5. 生成测试报告
            this.generateReport(apiResult, receivedMessage);
            
        } catch (error) {
            console.error('❌ 测试过程中出现错误:', error.message);
        } finally {
            if (this.ws) {
                this.ws.close();
                console.log('🔌 WebSocket连接已关闭');
            }
        }
    }

    // 生成测试报告
    generateReport(apiResult, receivedMessage) {
        console.log('\n📊 测试报告:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log('✅ WebSocket连接:', this.testResults.websocketConnection ? '成功' : '失败');
        console.log('✅ 用户认证:', this.testResults.userAuth ? '成功' : '失败');
        console.log('✅ 管理员登录:', this.testResults.adminLogin ? '成功' : '失败');
        console.log('✅ API调用:', apiResult?.success ? '成功' : '失败');
        console.log('✅ WebSocket消息接收:', receivedMessage ? '成功' : '失败');
        
        console.log('\n📨 收到的消息数量:', this.messagesReceived.length);
        console.log('📋 消息类型统计:');
        
        const messageTypes = {};
        this.messagesReceived.forEach(msg => {
            messageTypes[msg.type] = (messageTypes[msg.type] || 0) + 1;
        });
        
        Object.entries(messageTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}`);
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 测试结论
        if (apiResult?.success && receivedMessage) {
            console.log('🎉 测试成功: 管理后台WebSocket推送功能正常工作！');
        } else if (apiResult?.success && !receivedMessage) {
            console.log('⚠️ 测试部分成功: API调用成功但WebSocket消息未送达');
            console.log('💡 可能原因: WebSocket推送逻辑、用户ID匹配或连接状态问题');
        } else {
            console.log('❌ 测试失败: 管理后台API调用失败');
        }
    }
}

// 运行测试
async function main() {
    const test = new AdminWebSocketTest();
    await test.runTest();
}

main().catch(console.error);
