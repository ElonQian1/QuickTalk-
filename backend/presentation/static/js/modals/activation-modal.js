"use strict";

// 付费开通模态行为脚本（从 mobile-dashboard.html 抽离）
// 依赖：getAuthToken, showToast, loadShops, shopsData（仅激活入口使用）

// 显示付费开通支付模态框
function showActivationPaymentModal(order) {
    console.log('📦 显示付费开通模态框，订单数据:', order);

    if (!order) {
        console.error('❌ 订单数据为空');
        if (typeof showToast === 'function') showToast('订单数据异常，请重试', 'error');
        return;
    }

    const orderIdElement = document.getElementById('activationOrderId');
    const shopNameElement = document.getElementById('activationShopName');
    const expiryElement = document.getElementById('activationExpiry');

    if (orderIdElement) orderIdElement.textContent = order.orderId || order.order_id || '未知';
    if (shopNameElement) shopNameElement.textContent = order.shopName || order.shop_name || '未知店铺';
    if (expiryElement) {
        const expiryTime = order.expiresAt || order.expires_at;
        expiryElement.textContent = expiryTime ? new Date(expiryTime).toLocaleString() : '无';
    }

    const modal = document.getElementById('activationModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    } else {
        console.error('❌ 找不到activationModal元素');
        if (typeof showToast === 'function') showToast('界面错误，请刷新页面', 'error');
        return;
    }

    // 存储当前订单
    window.currentActivationOrder = order;
    console.log('✅ 付费开通模态框已显示');
}

// 选择付费开通支付方式并生成二维码
async function selectActivationPaymentMethod(method) {
    console.log('🎯 选择支付方式:', method);

    if (!window.currentActivationOrder) {
        console.error('❌ 当前订单信息为空');
        if (typeof showToast === 'function') showToast('订单信息异常，请重新发起付费开通', 'error');
        return;
    }

    try {
        const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
        const orderId = window.currentActivationOrder.orderId || window.currentActivationOrder.order_id;
        console.log('📡 发送二维码生成请求，订单ID:', orderId);

        const response = await fetch(`/api/activation-orders/${orderId}/qrcode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-Session-Id': authToken
            },
            body: JSON.stringify({ paymentMethod: method })
        });

        console.log('📡 二维码API响应状态:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 二维码生成成功:', data);
            showActivationQRCode(data.data || data, method);
        } else {
            let error = null; try { error = await response.json(); } catch(_) {}
            console.error('❌ 二维码生成失败:', error);
            if (typeof showToast === 'function') showToast('生成支付二维码失败: ' + ((error && (error.message || error.error)) || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('❌ 生成付费开通二维码网络错误:', error);
        if (typeof showToast === 'function') showToast('网络错误，请重试', 'error');
    }
}

// 显示付费开通支付二维码
function showActivationQRCode(qrData, method) {
    console.log('🖼️ 显示二维码，数据:', qrData, '支付方式:', method);

    if (!qrData) {
        console.error('❌ 二维码数据为空');
        if (typeof showToast === 'function') showToast('二维码数据异常', 'error');
        return;
    }

    const methodName = method === 'alipay' ? '支付宝' : '微信';
    const appName = method === 'alipay' ? '支付宝' : '微信';

    const qrCodeUrl = qrData.qrCodeUrl || qrData.qr_code_url || qrData.qrcode_url;
    const orderId = qrData.orderId || qrData.order_id;
    const amount = qrData.amount;

    if (!qrCodeUrl) {
        console.error('❌ 二维码URL为空:', qrData);
        if (typeof showToast === 'function') showToast('二维码生成失败，请重试', 'error');
        return;
    }

    const methodNameElement = document.getElementById('activationPaymentMethodName');
    const qrImgElement = document.getElementById('activationPaymentQRCode');
    const appNameElement = document.getElementById('activationPaymentAppName');

    if (methodNameElement) methodNameElement.textContent = methodName;
    if (qrImgElement) qrImgElement.src = qrCodeUrl;
    if (appNameElement) appNameElement.textContent = appName;

    const qrSection = document.getElementById('activationQrCodeSection');
    if (qrSection) {
        const qrContainer = qrSection.querySelector('.qr-code-container');
        if (qrContainer) {
            qrContainer.classList.remove('alipay-style', 'wechat-style');
            qrSection.removeAttribute('data-method');
            qrContainer.classList.add(method === 'alipay' ? 'alipay-style' : 'wechat-style');
            qrSection.setAttribute('data-method', method);
        }
    }

    window.currentActivationPaymentMethod = method;

    const qrImg = document.getElementById('activationPaymentQRCode');
    if (qrImg) {
        qrImg.onerror = function () {
            console.warn('💡 付费开通二维码加载失败，使用备用方案');
            this.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent('模拟' + methodName + '付费开通订单:' + orderId + ' 金额:¥' + amount)}`;
        };
    }

    const paymentMethods = document.getElementById('activationPaymentMethods');
    if (paymentMethods) paymentMethods.style.display = 'none';
    if (qrSection) qrSection.style.display = 'block';

    console.log(`✅ 显示${methodName}付费开通支付二维码:`, qrCodeUrl);

    if (orderId) {
        startActivationPaymentPolling(orderId);
    } else {
        console.warn('⚠️ 订单ID为空，无法启动轮询');
    }
}

// 开始付费开通支付状态轮询
function startActivationPaymentPolling(orderId) {
    if (window.activationPaymentPolling) {
        clearInterval(window.activationPaymentPolling);
    }

    console.log('🔄 开始付费开通支付状态轮询...');

    window.activationPaymentPolling = setInterval(async () => {
        try {
            const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
            const response = await fetch(`/api/activation-orders/${orderId}/status`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                const order = data.order;

                if (order.status === 'paid') {
                    clearInterval(window.activationPaymentPolling);
                    window.activationPaymentPolling = null;
                    showActivationPaymentSuccess();
                } else if (order.status === 'expired') {
                    clearInterval(window.activationPaymentPolling);
                    window.activationPaymentPolling = null;
                    if (typeof showToast === 'function') showToast('支付超时，请重新发起付费开通', 'warning');
                    closeActivationModal();
                }
            }
        } catch (error) {
            console.error('付费开通轮询错误:', error);
        }
    }, 3000);

    // 30分钟后自动停止
    setTimeout(() => {
        if (window.activationPaymentPolling) {
            clearInterval(window.activationPaymentPolling);
            window.activationPaymentPolling = null;
        }
    }, 30 * 60 * 1000);
}

// 显示付费开通支付成功页面
function showActivationPaymentSuccess() {
    const qr = document.getElementById('activationQrCodeSection');
    const success = document.getElementById('activationPaymentSuccess');
    if (qr) qr.style.display = 'none';
    if (success) success.style.display = 'block';

    console.log('🎉 付费开通支付成功');

    setTimeout(() => {
        if (typeof showToast === 'function') {
            showToast('🎉 付费开通成功！店铺已自动审核通过并获得1年有效期！', 'success');
        }
        closeActivationModal();
        if (typeof loadShops === 'function') loadShops();
    }, 1000);
}

// 刷新付费开通二维码
function refreshActivationQRCode() {
    if (!window.currentActivationOrder || !window.currentActivationPaymentMethod) {
        if (typeof showToast === 'function') showToast('无法刷新二维码，请重新选择支付方式', 'warning');
        return;
    }

    const refreshBtn = document.querySelector('#activationQrCodeSection .refresh-btn');
    const originalText = refreshBtn ? refreshBtn.textContent : '';

    if (refreshBtn) {
        refreshBtn.textContent = '🔄 刷新中...';
        refreshBtn.disabled = true;
    }

    Promise.resolve(selectActivationPaymentMethod(window.currentActivationPaymentMethod))
        .finally(() => {
            setTimeout(() => {
                if (refreshBtn) {
                    refreshBtn.textContent = originalText || '🔄 刷新二维码';
                    refreshBtn.disabled = false;
                }
            }, 500);
        });
}

// 关闭付费开通模态框
function closeActivationModal() {
    const modal = document.getElementById('activationModal');
    if (modal) {
        modal.classList.remove('show');
    }
    document.body.style.overflow = '';

    const methods = document.getElementById('activationPaymentMethods');
    const qr = document.getElementById('activationQrCodeSection');
    const success = document.getElementById('activationPaymentSuccess');
    if (methods) methods.style.display = 'block';
    if (qr) qr.style.display = 'none';
    if (success) success.style.display = 'none';

    if (window.activationPaymentPolling) {
        clearInterval(window.activationPaymentPolling);
        window.activationPaymentPolling = null;
    }

    window.currentActivationOrder = null;
}

// 模拟付费开通支付成功（测试用）
async function mockActivationPaymentSuccess() {
    if (!window.currentActivationOrder) {
        if (typeof showToast === 'function') showToast('没有待支付的开通订单', 'warning');
        return;
    }

    try {
        const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
        const response = await fetch(`/api/activation-orders/${window.currentActivationOrder.orderId}/mock-success`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Session-Id': authToken
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('🧪 模拟付费开通支付成功:', data);
            showActivationPaymentSuccess();
        } else {
            let error = null; try { error = await response.json(); } catch(_) {}
            if (typeof showToast === 'function') showToast('模拟支付失败: ' + (error && (error.error || error.message) || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('模拟付费开通支付错误:', error);
        if (typeof showToast === 'function') showToast('网络错误，请重试', 'error');
    }
}
