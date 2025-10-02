"use strict";

// 用例：创建付费开通订单并展示支付模态
// 依赖：getAuthToken, showToast, showActivationPaymentModal, shopsData

async function activateShop(shopId) {
  console.log('🎯 开始付费开通流程:', shopId);

  // 校验并在本地缓存中查找店铺
  let shop = null;
  try {
    if (typeof shopsData !== 'undefined' && Array.isArray(shopsData) && shopsData.length > 0) {
      shop = shopsData.find(s => s.id === shopId);
      console.log('🔍 找到的店铺:', shop);
    } else {
      console.error('❌ shopsData为空或未定义:', typeof shopsData);
    }
  } catch (e) {
    console.warn('⚠️ 读取 shopsData 时出错:', e);
  }

  if (!shop) {
    if (typeof showToast === 'function') showToast('店铺不存在或数据未加载，请刷新页面后重试', 'error');
    console.error('❌ Shop not found:', shopId, 'Available shops:', typeof shopsData !== 'undefined' ? shopsData : null);
    return;
  }

  console.log('✅ 店铺验证通过，显示付费开通模态框');
  try {
    const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
    const response = await fetch(`/api/shops/${shopId}/activation-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'X-Session-Id': authToken
      }
    });

    console.log('📡 API响应状态:', response.status);
    let data = null;
    try { data = await response.json(); } catch (_) { data = null; }

    if (response.ok && data && (data.success || data.order || data.data)) {
      // 兼容不同返回格式：优先取 data.data
      const payload = (data && data.data) ? data.data : data.order || data;
      if (typeof showActivationPaymentModal === 'function') {
        showActivationPaymentModal(payload);
      } else {
        console.error('❌ showActivationPaymentModal 未定义');
      }
    } else {
      const msg = (data && (data.message || data.error)) || `创建激活订单失败 (${response.status})`;
      console.error('❌ API错误:', data);
      if (typeof showToast === 'function') showToast(msg, 'error');
    }
  } catch (error) {
    console.error('❌ 网络错误:', error);
    if (typeof showToast === 'function') showToast('网络错误，请重试', 'error');
  }
}
