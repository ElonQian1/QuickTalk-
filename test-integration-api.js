async function testIntegrationCodeAPI() {
    try {
        // 先登录
        console.log('📝 1. 登录测试用户...');
        const loginResponse = await fetch('http://localhost:3030/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'jkl',  // 使用实际存在的用户
                password: '123456'
            })
        });

        if (!loginResponse.ok) {
            throw new Error(`登录失败: ${loginResponse.status}`);
        }

        const loginData = await loginResponse.json();
        console.log('✅ 登录成功:', loginData.user.username);
        
        const sessionId = loginData.sessionId;

        // 获取店铺列表
        console.log('\n📝 2. 获取店铺列表...');
        const shopsResponse = await fetch('http://localhost:3030/api/shops', {
            headers: {
                'X-Session-Id': sessionId
            }
        });

        if (!shopsResponse.ok) {
            throw new Error(`获取店铺失败: ${shopsResponse.status}`);
        }

        const shopsData = await shopsResponse.json();
        console.log('✅ 获取到店铺:', shopsData.shops.map(s => ({ id: s.id, name: s.name })));

        if (shopsData.shops.length === 0) {
            console.log('❌ 没有店铺可测试');
            return;
        }

        const testShop = shopsData.shops[0];
        console.log('🏪 测试店铺:', testShop.name, testShop.id);

        // 测试集成代码生成API
        console.log('\n📝 3. 生成集成代码...');
        const integrationResponse = await fetch(`http://localhost:3030/api/shops/${testShop.id}/integration-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            },
            body: JSON.stringify({
                serverUrl: 'http://localhost:3030'
            })
        });

        console.log('📡 响应状态:', integrationResponse.status);

        if (integrationResponse.ok) {
            const integrationData = await integrationResponse.json();
            console.log('✅ 集成代码生成成功!');
            console.log('📋 返回数据:', {
                success: integrationData.success,
                shop: integrationData.shop,
                codeLength: integrationData.integrationCode ? integrationData.integrationCode.length : 0
            });
        } else {
            const errorText = await integrationResponse.text();
            console.log('❌ 集成代码生成失败:', errorText);
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

testIntegrationCodeAPI();
