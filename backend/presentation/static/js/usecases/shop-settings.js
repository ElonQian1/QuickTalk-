// shop-settings.js — 店铺设置用例（从 mobile-dashboard.html 抽取）
// 提供全局：loadShopSettings, updateShopSettings
// 依赖：currentShopId, showToast, loadShops

(function () {
  'use strict';

  window.loadShopSettings = function loadShopSettings() {
    try {
      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) return;

      const nameField = document.getElementById('editShopName');
      const domainField = document.getElementById('editShopDomain');
      const descField = document.getElementById('editShopDescription');

      // 这里应该从店铺数据中加载，暂时使用空值（保持原逻辑）
      if (nameField) nameField.value = '';
      if (domainField) domainField.value = '';
      if (descField) descField.value = '';
    } catch (e) {
      console.error('loadShopSettings error:', e);
    }
  };

  window.updateShopSettings = async function updateShopSettings(event) {
    try {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();

      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) { if (typeof window.showToast === 'function') window.showToast('请先选择一个店铺', 'error'); return; }

      const name = (document.getElementById('editShopName')?.value || '').trim();
      const domain = (document.getElementById('editShopDomain')?.value || '').trim();
      const description = (document.getElementById('editShopDescription')?.value || '').trim();

      if (!name || !domain) { if (typeof window.showToast === 'function') window.showToast('请填写店铺名称和域名', 'error'); return; }

      if (typeof window.showToast === 'function') window.showToast('正在保存设置...', 'info');

      // 保持原先的占位行为：模拟保存
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (typeof window.showToast === 'function') window.showToast('店铺设置已保存', 'success');
      if (typeof window.loadShops === 'function') window.loadShops();
    } catch (error) {
      console.error('保存店铺设置失败:', error);
      if (typeof window.showToast === 'function') window.showToast('保存设置失败，请重试', 'error');
    }
  };
})();
