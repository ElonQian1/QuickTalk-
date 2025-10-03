"use strict";

// shop-activation.js — 店铺激活 API（从 mobile-dashboard.html 抽取）
// 提供：activateShop(shopId, event)
// 依赖：getAuthToken, showToast, loadShops, fetchDashboardStats

(function(){
  window.activateShop = async function activateShop(shopId, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof confirm === 'function') {
      if (!confirm('确认激活这个店铺吗？')) return;
    }
    try {
      const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      const response = await fetch(`/api/shops/${shopId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Session-Id': authToken
        }
      });
      const data = await response.json ? await response.json() : {};
      if (data.success) {
        if (typeof showToast === 'function') showToast('🚀 店铺已激活！', 'success');
        if (typeof loadShops === 'function') await loadShops();
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
      } else {
        if (typeof showToast === 'function') showToast(data.error || '激活失败，请重试', 'error');
      }
    } catch (error) {
      if (typeof showToast === 'function') showToast('网络错误，请稍后重试', 'error');
      if (typeof console !== 'undefined') console.error('激活店铺错误:', error);
    }
  };

  window.deactivateShop = async function deactivateShop(shopId, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof confirm === 'function') {
      if (!confirm('确认停用这个店铺吗？')) return;
    }
    try {
      const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      const response = await fetch(`/api/shops/${shopId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Session-Id': authToken
        }
      });
      const data = await response.json ? await response.json() : {};
      if (data.success) {
        if (typeof showToast === 'function') showToast('💤 店铺已停用', 'success');
        if (typeof loadShops === 'function') await loadShops();
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
      } else {
        if (typeof showToast === 'function') showToast(data.error || '停用失败，请重试', 'error');
      }
    } catch (error) {
      if (typeof showToast === 'function') showToast('网络错误，请稍后重试', 'error');
      if (typeof console !== 'undefined') console.error('停用店铺错误:', error);
    }
  };
})();
