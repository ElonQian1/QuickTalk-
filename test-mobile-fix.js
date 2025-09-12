/**
 * 测试移动端店铺管理模块修复
 */
const fetch = require('node-fetch');

async function testMobileFix() {
    const baseUrl = 'http://localhost:3030';
    
    console.log('🧪 开始测试移动端店铺管理模块修复...\n');
    
    try {
        // 1. 测试登录获取会话
        console.log('1️⃣ 测试用户登录...');
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'jkl',
                password: '123456'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`登录失败: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const sessionId = loginData.sessionId;
        console.log('✅ 登录成功，会话ID:', sessionId.substring(0, 20) + '...');
        
        // 2. 测试获取用户信息
        console.log('\n2️⃣ 测试获取用户信息...');
        const userResponse = await fetch(`${baseUrl}/api/auth/me`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        if (!userResponse.ok) {
            throw new Error(`获取用户信息失败: ${userResponse.status}`);
        }
        
        const userData = await userResponse.json();
        console.log('✅ 用户信息获取成功:', {
            id: userData.id,
            username: userData.username,
            role: userData.role
        });
        
        // 3. 测试新增的统计接口
        console.log('\n3️⃣ 测试统计接口...');
        const statsResponse = await fetch(`${baseUrl}/api/admin/stats`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        if (!statsResponse.ok) {
            throw new Error(`获取统计信息失败: ${statsResponse.status}`);
        }
        
        const statsData = await statsResponse.json();
        console.log('✅ 统计信息获取成功:', {
            totalShops: statsData.totalShops,
            unreadMessages: statsData.unreadMessages,
            userRole: statsData.userRole
        });
        
        // 4. 测试店铺数据获取
        console.log('\n4️⃣ 测试店铺数据获取...');
        const shopsResponse = await fetch(`${baseUrl}/api/shops`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        if (!shopsResponse.ok) {
            throw new Error(`获取店铺数据失败: ${shopsResponse.status}`);
        }
        
        const shopsData = await shopsResponse.json();
        console.log('✅ 店铺数据获取成功，店铺数量:', shopsData.shops?.length || 0);
        
        if (shopsData.shops && shopsData.shops.length > 0) {
            console.log('📋 店铺详情:');
            shopsData.shops.forEach((shop, index) => {
                console.log(`   ${index + 1}. ${shop.name} (${shop.id})`);
                console.log(`      状态: ${shop.status || 'N/A'}`);
                console.log(`      审核状态: ${shop.approval_status || shop.approvalStatus || 'N/A'}`);
                console.log(`      服务状态: ${shop.service_status || 'N/A'}`);
            });
        }
        
        console.log('\n🎉 所有测试通过！移动端店铺管理模块修复成功！');
        console.log('\n📱 现在可以刷新移动端页面测试实际效果：');
        console.log(`   访问: ${baseUrl}/static/admin-mobile.html`);
        console.log(`   使用会话ID: ${sessionId}`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

testMobileFix();
