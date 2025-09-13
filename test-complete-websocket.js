#!/usr/bin/env node

/**
 * WebSocket客服系统完整功能测试
 * 测试客户端-服务器双向通信
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const CONFIG = {
    wsUrl: 'ws://localhost:3030/ws',
    apiUrl: 'http://localhost:3030/api',
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    userId: 'user_test_complete_' + Date.now()
};

console.log('🧪 开始WebSocket客服系统完整功能测试...');
console.log('配置信息:', CONFIG);

class WebSocketTester {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.authenticated = false;
        this.messagesReceived = [];
    }

    async runCompleteTest() {
        try {
            console.log('\n=== 第1步: 建立WebSocket连接 ===');
            await this.connectWebSocket();
            
            console.log('\n=== 第2步: 发送用户消息 ===');
            await this.sendUserMessage('这是一条完整测试消息！');
            
            console.log('\n=== 第3步: 等待接收服务器确认 ===');
            await this.sleep(1000);
            
            console.log('\n=== 第4步: 模拟管理员回复 ===');
            await this.sendAdminReply('您好！这是来自客服的WebSocket实时回复！');
            
            console.log('\n=== 第5步: 检查消息接收 ===');
            await this.sleep(1000);
            
            console.log('\n=== 第6步: 测试结果总结 ===');
            this.summarizeResults();
            
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
            console.log('🔗 连接WebSocket服务器...');
            this.ws = new WebSocket(CONFIG.wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket连接成功');
                this.connected = true;
                
                // 发送认证信息
                const authMessage = {
                    type: 'auth',
                    userId: CONFIG.userId,
                    shopKey: CONFIG.shopKey,
                    shopId: CONFIG.shopId
                };
                
                console.log('📤 发送认证消息:', authMessage);
                this.ws.send(JSON.stringify(authMessage));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📨 收到消息:', data);
                    
                    this.messagesReceived.push(data);
                    
                    if (data.type === 'auth_success') {
                        console.log('✅ 认证成功');
                        this.authenticated = true;
                        resolve();
                    } else if (data.type === 'staff_message') {
                        console.log('🎉 收到客服回复:', data.message);
                    }
                    
                } catch (e) {
                    console.error('❌ 消息解析失败:', e);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 连接关闭:', event.code);
                this.connected = false;
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket错误:', error);
                reject(error);
            };
            
            // 设置超时
            setTimeout(() => {
                if (!this.authenticated) {
                    reject(new Error('认证超时'));
                }
            }, 5000);
        });
    }

    async sendUserMessage(message) {
        if (!this.connected || !this.authenticated) {
            throw new Error('未连接或未认证');
        }
        
        const messageData = {
            type: 'send_message',
            userId: CONFIG.userId,
            message: message,
            shopKey: CONFIG.shopKey,
            shopId: CONFIG.shopId,
            timestamp: Date.now()
        };
        
        console.log('📤 发送用户消息:', message);
        this.ws.send(JSON.stringify(messageData));
        console.log('✅ 消息发送完成');
    }

    async sendAdminReply(replyMessage) {
        const conversationId = `${CONFIG.shopId}_${CONFIG.userId}`;
        
        console.log('📤 发送管理员回复 API 请求...');
        
        const response = await fetch(`${CONFIG.apiUrl}/admin/send-reply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversationId: conversationId,
                content: replyMessage,
                senderId: 'admin_test_complete'
            })
        });
        
        const result = await response.json();
        console.log('📨 管理员回复API响应:', result);
        
        if (result.success && result.data.pushed) {
            console.log('✅ 消息已通过WebSocket推送');
        } else {
            console.log('⚠️ 消息推送状态:', result.data.method);
        }
    }

    summarizeResults() {
        console.log('\n🎯 测试结果总结:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        console.log(`📊 连接状态: ${this.connected ? '✅ 已连接' : '❌ 断开'}`);
        console.log(`🔐 认证状态: ${this.authenticated ? '✅ 已认证' : '❌ 未认证'}`);
        console.log(`📨 收到消息数量: ${this.messagesReceived.length}`);
        
        console.log('\n📋 消息列表:');
        this.messagesReceived.forEach((msg, index) => {
            console.log(`  ${index + 1}. [${msg.type}] ${msg.message || '认证响应'}`);
        });
        
        const hasStaffMessage = this.messagesReceived.some(msg => msg.type === 'staff_message');
        console.log(`\n🎯 客服消息接收: ${hasStaffMessage ? '✅ 成功' : '❌ 失败'}`);
        
        if (hasStaffMessage) {
            console.log('\n🎉 WebSocket客服系统测试完全成功！');
            console.log('✅ 双向通信正常工作');
            console.log('✅ 实时消息推送正常');
            console.log('✅ 客户端能正确接收客服回复');
        } else {
            console.log('\n⚠️ 测试结果: 部分功能正常，但客服消息推送可能有问题');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 运行测试
const tester = new WebSocketTester();
tester.runCompleteTest().then(() => {
    console.log('\n✅ 测试完成！');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
});
