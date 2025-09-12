// 直接测试移动端的API调用
async function testShopsAPI() {
    console.log('🧪 测试移动端店铺API调用');
    
    // 模拟登录获取session
    try {
        const loginResponse = await fetch('http://localhost:3030/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'jkl',
                password: '123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error('登录失败');
        }
        
        const loginData = await loginResponse.json();
        console.log('✅ 登录成功:', loginData);
        
        const sessionId = loginData.sessionId;
        
        // 测试 /api/auth/me
        console.log('\n🔍 测试 /api/auth/me');
        const meResponse = await fetch('http://localhost:3030/api/auth/me', {
            headers: {
                'X-Session-Id': sessionId
            }
        });
        
        if (meResponse.ok) {
            const meData = await meResponse.json();
            console.log('✅ /api/auth/me 响应:', JSON.stringify(meData, null, 2));
        } else {
            console.log('❌ /api/auth/me 失败:', meResponse.status);
        }
        
        // 测试 /api/shops
        console.log('\n🔍 测试 /api/shops');
        const shopsResponse = await fetch('http://localhost:3030/api/shops', {
            headers: {
                'X-Session-Id': sessionId
            }
        });
        
        if (shopsResponse.ok) {
            const shopsData = await shopsResponse.json();
            console.log('✅ /api/shops 响应:', JSON.stringify(shopsData, null, 2));
        } else {
            console.log('❌ /api/shops 失败:', shopsResponse.status);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testShopsAPI();
