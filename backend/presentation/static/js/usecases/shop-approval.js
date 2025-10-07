"use strict";

// shop-approval.js — 店铺审批操作（从 mobile-dashboard.html 抽取）
// 提供：approveShop(shopId), rejectShop(shopId), activateShop(shopId), deactivateShop(shopId)
// 依赖：showLoading, hideLoading, showSuccess, showError, getAuthToken, loadShops

(function(){
  
  /**
   * 统一的店铺操作方法 - 消除重复的fetch、loading、错误处理代码
   */
  async function performShopAction(shopId, action, loadingText, successText, errorText) {
    try {
      if (typeof showLoading === 'function') showLoading(loadingText);
      
      const response = await window.unifiedFetch.post(`/api/shops/${shopId}/${action}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
        }
      });
      
      if (response.ok) {
        if (typeof showSuccess === 'function') showSuccess(successText);
        if (typeof loadShops === 'function') await loadShops();
      } else {
        if (typeof showError === 'function') showError(errorText);
      }
    } catch (error) {
      console.error(`${action}店铺失败:`, error);
      if (typeof showError === 'function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  }
  // 批准店铺
  window.approveShop = async function approveShop(shopId) {
    return performShopAction(shopId, 'approve', '正在审批店铺...', '店铺已批准', '批准失败');
  };

  // 拒绝店铺
  window.rejectShop = async function rejectShop(shopId) {
    return performShopAction(shopId, 'reject', '正在拒绝店铺...', '店铺已拒绝', '拒绝失败');
  };

  // 激活店铺
  window.activateShop = async function activateShop(shopId) {
    return performShopAction(shopId, 'activate', '正在激活店铺...', '店铺已激活', '激活失败');
  };

  // 停用店铺
  window.deactivateShop = async function deactivateShop(shopId) {
    return performShopAction(shopId, 'deactivate', '正在停用店铺...', '店铺已停用', '停用失败');
  };
})();
