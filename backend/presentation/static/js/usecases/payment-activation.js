/*
 * 付费开通模块 (payment-activation.js)
 * - 提供 payToActivate 入口，复用现有 activateShop(shopId)
 * - 保持与旧代码兼容：阻止默认事件、校验 shop 存在
 */
(function() {
  'use strict';

  function getShopById(shopId) {
    try {
      if (Array.isArray(window.shopsData)) {
        return window.shopsData.find(s => String(s.id) === String(shopId));
      }
    } catch (_) {}
    return null;
  }

  async function payToActivate(shopId, event) {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      console.log('🎯 付费开通按钮被点击:', shopId);

      const shop = getShopById(shopId);
      if (!shop) {
        if (typeof window.showToast === 'function') {
          window.showToast('店铺不存在或数据未加载，请刷新页面后重试', 'error');
        }
        console.error('❌ Shop not found:', shopId, 'Available shops:', window.shopsData);
        return;
      }

      console.log('✅ 店铺验证通过，开始付费开通流程');
      if (typeof window.activateShop === 'function') {
        await window.activateShop(shopId);
      } else {
        console.warn('⚠️ activateShop 未定义，无法打开支付流程');
      }
    } catch (e) {
      console.error('❌ payToActivate 失败:', e);
    }
  }

  window.payToActivate = payToActivate;
  console.log('✅ payment-activation.js 已加载');
})();
