#!/usr/bin/env node

/**
 * 诊断前端lastSequenceId更新问题
 */

const fetch = require('node-fetch');

const config = {
    serverUrl: 'http://localhost:3030',
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    userId: 'user_jrcwus3wm_1757685782096' // 使用日志中的用户ID
};

async function diagnoseSequenceId() {
    console.log('🔍 诊断前端lastSequenceId更新问题...');
    console.log(`👤 目标用户: ${config.userId}`);
    
    try {
        // 1. 检查当前消息状态
        console.log('\n📊 1. 检查当前消息状态...');
        const res1 = await fetch(`${config.serverUrl}/api/client/messages?userId=${config.userId}&lastId=0&shopId=${config.shopId}`, {
            headers: {
                'X-Shop-Key': config.shopKey,
                'X-Shop-Id': config.shopId
            }
        });
        
        if (res1.ok) {
            const data1 = await res1.json();
            console.log(`📥 lastId=0时: ${data1.data.messages.length} 条消息`);
            console.log(`📈 maxSequenceId: ${data1.data.maxSequenceId}`);
            
            if (data1.data.messages.length > 0) {
                console.log('📨 管理员消息:');
                data1.data.messages.forEach(msg => {
                    console.log(`   - seq:${msg.sequenceId} - ${msg.message}`);
                });
                
                // 2. 测试不同的lastId值
                const maxSeq = data1.data.maxSequenceId;
                
                console.log(`\n🧪 2. 测试lastId=${maxSeq}时的响应...`);
                const res2 = await fetch(`${config.serverUrl}/api/client/messages?userId=${config.userId}&lastId=${maxSeq}&shopId=${config.shopId}`, {
                    headers: {
                        'X-Shop-Key': config.shopKey,
                        'X-Shop-Id': config.shopId
                    }
                });
                
                if (res2.ok) {
                    const data2 = await res2.json();
                    console.log(`📥 lastId=${maxSeq}时: ${data2.data.messages.length} 条消息`);
                    
                    if (data2.data.messages.length === 0) {
                        console.log('✅ 正确：使用maxSequenceId作为lastId时没有重复消息');
                    } else {
                        console.log('❌ 错误：仍然返回了消息，说明lastId逻辑有问题');
                    }
                }
                
                // 3. 模拟前端的错误行为
                console.log(`\n🐛 3. 模拟前端一直使用lastId=0的问题...`);
                console.log('这解释了为什么前端收不到新消息：');
                console.log('- 前端发送请求：lastId=0');
                console.log('- 服务器返回：已有的管理员消息 + maxSequenceId=2');
                console.log('- 前端应该更新：lastSequenceId = 2');
                console.log('- 下次请求应该：lastId=2');
                console.log('- 但如果前端代码没有更新，仍然使用lastId=0');
                console.log('- 结果：前端一直收到相同的消息，新消息无法区分');
                
            } else {
                console.log('📭 没有管理员消息');
            }
        }
        
        // 4. 给出解决方案
        console.log(`\n💡 4. 解决方案：`);
        console.log('前端代码需要确保：');
        console.log('1. 正确接收API返回的 data.data.maxSequenceId');
        console.log('2. 将 maxSequenceId 保存到 lastSequenceId 变量');
        console.log('3. 下次请求时使用更新后的 lastSequenceId');
        
        console.log(`\n🔧 5. 前端代码示例：`);
        console.log(`
async function checkMessages() {
    const res = await fetch('/api/client/messages?userId=' + userId + '&lastId=' + this.lastSequenceId);
    const data = await res.json();
    
    if (data.data.messages.length > 0) {
        data.data.messages.forEach(msg => {
            this.handleMsg(msg); // 处理新消息
        });
        
        // ✅ 关键：更新lastSequenceId
        if (data.data.maxSequenceId) {
            this.lastSequenceId = data.data.maxSequenceId;
            console.log('🔄 更新lastSequenceId:', this.lastSequenceId);
        }
    }
}
        `);
        
    } catch (error) {
        console.error('❌ 诊断失败:', error);
    }
}

// 运行诊断
diagnoseSequenceId();
