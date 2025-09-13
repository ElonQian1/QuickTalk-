#!/usr/bin/env node

/**
 * 管理后台WebSocket推送修复验证测试
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const CONFIG = {
    wsUrl: 'ws://localhost:3030/ws',
    apiUrl: 'http://localhost:3030/api',
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    userId: 'user_admin_backend_test_' + Date.now()
};

console.log('🧪 管理后台WebSocket推送修复验证测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

class BackendTestRunner {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.messagesReceived = [];
    }

    async runTest() {
        try {
            console.log('\n📝 第1步: 建立WebSocket连接');
            await this.connectWebSocket();
            
            console.log('\n🔐 第2步: 获取管理员session');
            await this.getAdminSession();
            
            console.log('\n📤 第3步: 通过管理后台API发送消息');
            await this.sendMessageViaBackend();
            
            console.log('\n⏳ 第4步: 等待接收WebSocket推送');
            await this.waitForMessage();
            
            console.log('\n🎯 第5步: 验证结果');
            this.validateResults();
            
        } catch (error) {
            console.error('❌ 测试失败:', error);
        } finally {
            if (this.ws) {
                this.ws.close();
            }
        }
    }

    connectWebSocket() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(CONFIG.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接成功');
                
                // 发送认证
                this.ws.send(JSON.stringify({
                    type: 'auth',
                    userId: CONFIG.userId,
                    shopKey: CONFIG.shopKey,
                    shopId: CONFIG.shopId
                }));
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('📨 收到消息:', data.type, data.message ? `"${data.message}"` : '');
                
                this.messagesReceived.push(data);
                
                if (data.type === 'auth_success') {
                    resolve();
                }
            };
            
            this.ws.onerror = reject;
            
            setTimeout(() => reject(new Error('连接超时')), 5000);
        });
    }

    async getAdminSession() {
        const response = await fetch(`${CONFIG.apiUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        const result = await response.json();
        if (!result.success) {
            throw new Error('管理员登录失败');
        }
        
        this.sessionId = result.sessionId;
        console.log('✅ 获取到session:', this.sessionId);
    }

    async sendMessageViaBackend() {
        const conversationId = `${CONFIG.shopId}_${CONFIG.userId}`;
        const testMessage = '【后台API测试】这是通过管理后台API发送的WebSocket推送测试消息！';
        
        console.log('📤 发送消息到API:', conversationId);
        
        const response = await fetch(`${CONFIG.apiUrl}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': this.sessionId
            },
            body: JSON.stringify({
                content: testMessage
            })
        });
        
        const result = await response.json();
        console.log('📨 API响应:', result.success ? '成功' : '失败');
        
        if (result.webSocketPushed !== undefined) {
            console.log('🔌 WebSocket推送状态:', result.webSocketPushed ? '✅ 成功' : '❌ 失败');
        }
    }

    async waitForMessage() {
        return new Promise((resolve) => {
            const initialCount = this.messagesReceived.length;
            let checkCount = 0;
            
            const checkInterval = setInterval(() => {
                checkCount++;
                
                if (this.messagesReceived.length > initialCount) {
                    console.log('✅ 接收到新消息');
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                if (checkCount >= 10) { // 等待5秒
                    console.log('⏰ 等待超时');
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 500);
        });
    }

    validateResults() {
        console.log('\n🎯 测试结果验证:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const staffMessages = this.messagesReceived.filter(msg => msg.type === 'staff_message');
        
        console.log(`📨 总消息数量: ${this.messagesReceived.length}`);
        console.log(`👨‍💼 客服消息数量: ${staffMessages.length}`);
        
        if (staffMessages.length > 0) {
            console.log('🎉 ✅ 管理后台WebSocket推送修复成功！');
            console.log('📋 客服消息内容:');
            staffMessages.forEach((msg, index) => {
                console.log(`   ${index + 1}. "${msg.message}"`);
            });
        } else {
            console.log('❌ 未收到客服消息，修复可能未生效');
        }
        
        console.log('\n📊 所有消息记录:');
        this.messagesReceived.forEach((msg, index) => {
            console.log(`   ${index + 1}. [${msg.type}] ${msg.message || '系统消息'}`);
        });
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}

// 运行测试
const tester = new BackendTestRunner();
tester.runTest().then(() => {
    console.log('\n✅ 测试完成！');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
});
