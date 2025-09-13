#!/usr/bin/env node

/**
 * 测试消息序列处理和lastId逻辑
 */

const fetch = require('node-fetch');

const config = {
    serverUrl: 'http://localhost:3030',
    shopKey: 'sk_ji85ucic9p00m12as1ygf34o8humuxfl',
    shopId: 'shop_1757591780450_1',
    domain: 'bbs16.929991.xyz'
};

async function testMessageSequence() {
    console.log('🧪 开始测试消息序列和lastId逻辑...');
    
    // 生成测试用户ID
    const testUserId = `user_seq_test_${Date.now()}`;
    console.log(`👤 测试用户ID: ${testUserId}`);
    
    try {
        // 1. 发送客户端消息
        console.log('\n📤 1. 发送客户端消息...');
        const sendRes1 = await fetch(`${config.serverUrl}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shop-Key': config.shopKey,
                'X-Shop-Id': config.shopId
            },
            body: JSON.stringify({
                userId: testUserId,
                message: '第一条消息：客户端',
                shopKey: config.shopKey,
                domain: config.domain,
                timestamp: Date.now()
            })
        });
        
        if (sendRes1.ok) {
            console.log('📤 第一条消息发送: 成功');
        } else {
            console.log('📤 第一条消息发送: 失败');
            return;
        }
        
        // 2. 获取消息（应该没有管理员消息）
        console.log('\n📥 2. 获取消息 (lastId=0)...');
        const getRes1 = await fetch(`${config.serverUrl}/api/client/messages?userId=${testUserId}&lastId=0&shopId=${config.shopId}`, {
            headers: {
                'X-Shop-Key': config.shopKey,
                'X-Shop-Id': config.shopId
            }
        });
        
        if (getRes1.ok) {
            const data1 = await getRes1.json();
            console.log('📥 获取结果1:', data1.data.messages.length, '条消息');
            console.log('📥 maxSequenceId:', data1.data.maxSequenceId);
            if (data1.data.messages.length > 0) {
                console.log('📥 消息内容:', data1.data.messages.map(m => `${m.type}: ${m.message}`));
            }
        }
        
        // 3. 模拟管理员回复
        console.log('\n💬 3. 模拟管理员回复...');
        
        // 先登录管理员
        const loginRes = await fetch(`${config.serverUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        if (!loginRes.ok) {
            console.log('💬 管理员登录: 失败');
            return;
        }
        
        const loginData = await loginRes.json();
        console.log('💬 管理员登录: 成功');
        
        // 发送管理员回复
        const replyRes = await fetch(`${config.serverUrl}/api/conversations/${config.shopId}_${testUserId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `sessionId=${loginData.sessionId}`
            },
            body: JSON.stringify({
                content: '第一条回复：管理员'  // 使用 content 而不是 message
            })
        });
        
        if (replyRes.ok) {
            console.log('💬 管理员回复1: 成功');
        } else {
            console.log('💬 管理员回复1: 失败');
        }
        
        // 4. 客户端获取消息（应该收到管理员回复）
        console.log('\n📥 4. 客户端获取消息 (lastId=0)...');
        const getRes2 = await fetch(`${config.serverUrl}/api/client/messages?userId=${testUserId}&lastId=0&shopId=${config.shopId}`, {
            headers: {
                'X-Shop-Key': config.shopKey,
                'X-Shop-Id': config.shopId
            }
        });
        
        if (getRes2.ok) {
            const data2 = await getRes2.json();
            console.log('📥 获取结果2:', data2.data.messages.length, '条消息');
            console.log('📥 maxSequenceId:', data2.data.maxSequenceId);
            if (data2.data.messages.length > 0) {
                console.log('📥 消息内容:', data2.data.messages.map(m => `${m.type} (seq:${m.sequenceId}): ${m.message}`));
            }
            
            // 5. 发送第二条管理员回复
            console.log('\n💬 5. 发送第二条管理员回复...');
            const replyRes2 = await fetch(`${config.serverUrl}/api/conversations/${config.shopId}_${testUserId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `sessionId=${loginData.sessionId}`
                },
                body: JSON.stringify({
                    content: '第二条回复：管理员'  // 使用 content 而不是 message
                })
            });
            
            if (replyRes2.ok) {
                console.log('💬 管理员回复2: 成功');
            }
            
            // 6. 使用上次的maxSequenceId获取新消息
            const lastSeqId = data2.data.maxSequenceId;
            console.log(`\n📥 6. 获取新消息 (lastId=${lastSeqId})...`);
            const getRes3 = await fetch(`${config.serverUrl}/api/client/messages?userId=${testUserId}&lastId=${lastSeqId}&shopId=${config.shopId}`, {
                headers: {
                    'X-Shop-Key': config.shopKey,
                    'X-Shop-Id': config.shopId
                }
            });
            
            if (getRes3.ok) {
                const data3 = await getRes3.json();
                console.log('📥 获取结果3:', data3.data.messages.length, '条新消息');
                console.log('📥 maxSequenceId:', data3.data.maxSequenceId);
                if (data3.data.messages.length > 0) {
                    console.log('📥 新消息内容:', data3.data.messages.map(m => `${m.type} (seq:${m.sequenceId}): ${m.message}`));
                }
                
                console.log('\n✅ 测试完成！');
                console.log('🔍 前端应该使用 maxSequenceId 作为下次请求的 lastId');
            }
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 运行测试
testMessageSequence();
