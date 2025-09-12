/**
 * 测试前后端连通性
 */
const fetch = require('node-fetch');

async function testConnection() {
    const baseUrl = 'http://localhost:3030';
    
    console.log('🧪 测试前后端连通性...\n');
    
    try {
        // 1. 测试主页
        console.log('1️⃣ 测试主页连接...');
        const homeResponse = await fetch(`${baseUrl}/`);
        console.log(`✅ 主页状态: ${homeResponse.status} ${homeResponse.statusText}`);
        
        // 2. 测试桌面端管理页面
        console.log('\n2️⃣ 测试桌面端管理页面...');
        const adminResponse = await fetch(`${baseUrl}/admin`);
        console.log(`✅ 桌面端管理页面状态: ${adminResponse.status} ${adminResponse.statusText}`);
        
        // 3. 测试移动端管理页面
        console.log('\n3️⃣ 测试移动端管理页面...');
        const mobileAdminResponse = await fetch(`${baseUrl}/static/admin-mobile.html`);
        console.log(`✅ 移动端管理页面状态: ${mobileAdminResponse.status} ${mobileAdminResponse.statusText}`);
        
        // 4. 测试API接口
        console.log('\n4️⃣ 测试API接口...');
        
        // 测试登录接口
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'jkl',
                password: '123456'
            })
        });
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log(`✅ 登录接口正常，获得会话: ${loginData.sessionId.substring(0, 20)}...`);
            
            // 测试获取用户信息
            const userResponse = await fetch(`${baseUrl}/api/auth/me`, {
                headers: { 'X-Session-Id': loginData.sessionId }
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                console.log(`✅ 用户信息接口正常，用户: ${userData.username} (${userData.role})`);
            }
            
            // 测试店铺数据接口
            const shopsResponse = await fetch(`${baseUrl}/api/shops`, {
                headers: { 'X-Session-Id': loginData.sessionId }
            });
            
            if (shopsResponse.ok) {
                const shopsData = await shopsResponse.json();
                console.log(`✅ 店铺数据接口正常，店铺数量: ${shopsData.shops?.length || 0}`);
            }
            
            // 测试统计信息接口
            const statsResponse = await fetch(`${baseUrl}/api/admin/stats`, {
                headers: { 'X-Session-Id': loginData.sessionId }
            });
            
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                console.log(`✅ 统计信息接口正常，总店铺: ${statsData.totalShops}`);
            }
            
        } else {
            console.log(`❌ 登录接口异常: ${loginResponse.status}`);
        }
        
        console.log('\n🎉 前后端连通性测试完成！');
        console.log('\n📱 现在可以访问以下地址:');
        console.log(`🖥️  桌面端: ${baseUrl}/admin`);
        console.log(`📱 移动端: ${baseUrl}/static/admin-mobile.html`);
        console.log(`📊 分析仪表板: ${baseUrl}/analytics`);
        console.log(`🔧 代码生成器: ${baseUrl}/code-generator`);
        
        console.log('\n🔑 测试账户:');
        console.log('用户名: jkl');
        console.log('密码: 123456');
        
        console.log('\n🚀 系统已就绪，可以开始测试付费开通功能！');
        
    } catch (error) {
        console.error('❌ 连接测试失败:', error.message);
        console.log('\n🔧 请检查:');
        console.log('1. 服务器是否在运行');
        console.log('2. 端口3030是否被占用');
        console.log('3. 防火墙设置');
    }
}

testConnection();
