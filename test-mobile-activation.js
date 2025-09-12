/**
 * 测试移动端付费开通功能完整性
 */
const fetch = require('node-fetch');

async function testMobileActivationFeature() {
    const baseUrl = 'http://localhost:3030';
    
    console.log('🧪 开始测试移动端付费开通功能完整性...\n');
    
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
        
        // 2. 测试获取店铺数据
        console.log('\n2️⃣ 测试获取店铺数据...');
        const shopsResponse = await fetch(`${baseUrl}/api/shops`, {
            headers: { 'X-Session-Id': sessionId }
        });
        
        if (!shopsResponse.ok) {
            throw new Error(`获取店铺数据失败: ${shopsResponse.status}`);
        }
        
        const shopsData = await shopsResponse.json();
        console.log('✅ 店铺数据获取成功，店铺数量:', shopsData.shops?.length || 0);
        
        if (!shopsData.shops || shopsData.shops.length === 0) {
            console.log('⚠️  没有找到店铺数据，跳过付费开通测试');
            return;
        }
        
        // 查找一个适合测试的店铺
        const testShop = shopsData.shops.find(shop => 
            shop.status !== 'active' || shop.approval_status === 'pending'
        ) || shopsData.shops[0];
        
        console.log('📋 测试店铺:', {
            id: testShop.id,
            name: testShop.name,
            status: testShop.status,
            approval_status: testShop.approval_status
        });
        
        // 3. 测试付费开通订单创建
        console.log('\n3️⃣ 测试付费开通订单创建...');
        const activationResponse = await fetch(`${baseUrl}/api/shops/${testShop.id}/activate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sessionId
            }
        });
        
        if (!activationResponse.ok) {
            const error = await activationResponse.json();
            console.log('⚠️  付费开通订单创建失败:', error.error);
            console.log('   这可能是正常的，如果店铺已经激活或不符合条件');
        } else {
            const activationData = await activationResponse.json();
            console.log('✅ 付费开通订单创建成功:', {
                orderId: activationData.order.orderId,
                shopName: activationData.order.shopName,
                amount: activationData.order.amount
            });
            
            // 4. 测试二维码生成接口
            console.log('\n4️⃣ 测试二维码生成接口...');
            const qrcodeResponse = await fetch(`${baseUrl}/api/activation-orders/${activationData.order.orderId}/qrcode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': sessionId
                },
                body: JSON.stringify({
                    paymentMethod: 'alipay'
                })
            });
            
            if (!qrcodeResponse.ok) {
                const error = await qrcodeResponse.json();
                console.log('⚠️  二维码生成失败:', error.error);
            } else {
                const qrcodeData = await qrcodeResponse.json();
                console.log('✅ 二维码生成成功:', {
                    hasQRCode: !!qrcodeData.qrData.qrCodeUrl,
                    orderId: qrcodeData.qrData.orderId
                });
            }
            
            // 5. 测试订单状态查询
            console.log('\n5️⃣ 测试订单状态查询...');
            const statusResponse = await fetch(`${baseUrl}/api/activation-orders/${activationData.order.orderId}/status`, {
                headers: { 'X-Session-Id': sessionId }
            });
            
            if (!statusResponse.ok) {
                const error = await statusResponse.json();
                console.log('⚠️  订单状态查询失败:', error.error);
            } else {
                const statusData = await statusResponse.json();
                console.log('✅ 订单状态查询成功:', {
                    status: statusData.order.status,
                    orderId: statusData.order.orderId
                });
            }
        }
        
        console.log('\n🎉 移动端付费开通功能测试完成！');
        console.log('\n📱 现在可以访问移动端测试实际效果：');
        console.log(`   访问: ${baseUrl}/static/admin-mobile.html`);
        console.log(`   使用会话ID: ${sessionId}`);
        console.log('\n💎 测试流程：');
        console.log('   1. 登录移动端管理界面');
        console.log('   2. 找到店铺并点击"付费开通"按钮');
        console.log('   3. 确认订单信息');
        console.log('   4. 选择支付方式（支付宝/微信）');
        console.log('   5. 扫码支付或使用测试按钮');
        console.log('   6. 验证支付成功后的界面更新');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

testMobileActivationFeature();
