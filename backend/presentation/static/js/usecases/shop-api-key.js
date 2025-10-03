// shop-api-key.js — 刷新 API 密钥用例（从 mobile-dashboard.html 抽取）
// 提供全局：refreshApiKey
// 依赖：currentShopId, showToast

(function () {
  'use strict';

  window.refreshApiKey = async function refreshApiKey() {
    try {
      const shopId = typeof window !== 'undefined' ? window.currentShopId : null;
      if (!shopId) {
        if (typeof window.showToast === 'function') window.showToast('请先选择一个店铺', 'error');
        return;
      }

      if (!confirm('确定要重新生成API密钥吗？旧密钥将失效。')) {
        return;
      }

      if (typeof window.showToast === 'function') window.showToast('正在生成新密钥...', 'info');

      // 保持原来的占位行为：模拟生成
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newApiKey = 'qk_' + Math.random().toString(36).substring(2, 15);

      const apiKeyElement = document.getElementById('detail-shop-api-key');
      if (apiKeyElement) {
        apiKeyElement.textContent = newApiKey;
      }

      if (typeof window.showToast === 'function') window.showToast('API密钥已更新', 'success');
    } catch (error) {
      console.error('重新生成API密钥失败:', error);
      if (typeof window.showToast === 'function') window.showToast('生成密钥失败，请重试', 'error');
    }
  };
})();
