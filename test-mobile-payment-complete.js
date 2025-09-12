const fetch = require('node-fetch');

const baseUrl = 'http://localhost:3030';

async function testCompleteMobilePaymentFlow() {
    console.log('🧪 开始测试移动端付费开通完整流程...\n');

    try {
        // 1. 登录测试
        console.log('1️⃣ 测试用户登录...');
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'shop_owner',
                password: '123456'
            })
        });

        if (!loginResponse.ok) {
            throw new Error('登录失败');
        }

        const loginData = await loginResponse.json();
        const sessionId = loginData.sessionId;
        console.log('✅ 登录成功，会话ID:', sessionId.substring(0, 20) + '...\n');

        // 2. 获取店铺数据
        console.log('2️⃣ 测试获取店铺数据...');
        const shopsResponse = await fetch(`${baseUrl}/api/shops`, {
            headers: { 'X-Session-Id': sessionId }
        });

        if (!shopsResponse.ok) {
            throw new Error('获取店铺数据失败');
        }

        const shopsData = await shopsResponse.json();
        console.log('✅ 店铺数据获取成功，店铺数量:', shopsData.shops?.length || 0);
        
        if (!shopsData.shops || shopsData.shops.length === 0) {
            console.log('❌ 没有找到店铺数据，无法进行付费开通测试');
            return;
        }

        const testShop = shopsData.shops[0];
        console.log('📋 测试店铺:', {
            id: testShop.id,
            name: testShop.name,
            status: testShop.status,
            approval_status: testShop.approval_status
        });
        console.log('');

        // 3. 创建付费开通订单
        console.log('3️⃣ 测试付费开通订单创建...');
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
            console.log('   这可能是正常的，如果店铺已经激活或不符合条件\n');
        } else {
            const activationData = await activationResponse.json();
            console.log('✅ 付费开通订单创建成功!');
            console.log('📋 订单信息:', {
                orderId: activationData.order.orderId,
                shopName: activationData.order.shopName,
                amount: activationData.order.amount,
                status: activationData.order.status
            });
            console.log('');

            // 4. 生成支付二维码
            console.log('4️⃣ 测试生成支付二维码...');
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

            if (qrcodeResponse.ok) {
                const qrcodeData = await qrcodeResponse.json();
                console.log('✅ 支付二维码生成成功!');
                console.log('📋 二维码信息:', {
                    orderId: qrcodeData.qrData.orderId,
                    amount: qrcodeData.qrData.amount,
                    paymentMethod: qrcodeData.qrData.paymentMethod,
                    qrCodeUrl: qrcodeData.qrData.qrCodeUrl
                });
                console.log('');

                // 5. 查询订单状态
                console.log('5️⃣ 测试查询订单状态...');
                const statusResponse = await fetch(`${baseUrl}/api/activation-orders/${activationData.order.orderId}/status`, {
                    headers: { 'X-Session-Id': sessionId }
                });

                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    console.log('✅ 订单状态查询成功!');
                    console.log('📋 订单状态:', statusData.order.status);
                    console.log('');

                    // 6. 模拟支付成功
                    console.log('6️⃣ 测试模拟支付成功...');
                    const mockSuccessResponse = await fetch(`${baseUrl}/api/activation-orders/${activationData.order.orderId}/mock-success`, {
                        method: 'POST',
                        headers: { 'X-Session-Id': sessionId }
                    });

                    if (mockSuccessResponse.ok) {
                        const mockSuccessData = await mockSuccessResponse.json();
                        console.log('✅ 模拟支付成功!');
                        console.log('🎉 付费开通流程完成!');
                        console.log('📋 最终结果:', mockSuccessData.message);
                    } else {
                        const error = await mockSuccessResponse.json();
                        console.log('❌ 模拟支付失败:', error.error);
                    }
                } else {
                    console.log('❌ 订单状态查询失败');
                }
            } else {
                console.log('❌ 支付二维码生成失败');
            }
        }

        console.log('\n🎉 移动端付费开通功能测试完成！');
        console.log('\n📱 现在可以访问移动端测试实际效果：');
        console.log('   访问: http://localhost:3030/mobile/admin');
        console.log(`   使用会话ID: ${sessionId}`);
        console.log('\n💎 测试流程：');
        console.log('   1. 登录移动端管理界面');
        console.log('   2. 找到店铺并点击"付费开通"按钮');
        console.log('   3. 确认订单信息');
        console.log('   4. 选择支付方式（支付宝/微信）');
        console.log('   5. 扫码支付或使用测试按钮');
        console.log('   6. 验证支付成功后的界面更新');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

// 运行测试
testCompleteMobilePaymentFlow();
