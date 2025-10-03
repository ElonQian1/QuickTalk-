"use strict";

// shop-approval.js — 店铺审批操作（从 mobile-dashboard.html 抽取）
// 提供：approveShop(shopId), rejectShop(shopId), activateShop(shopId), deactivateShop(shopId)
// 依赖：showLoading, hideLoading, showSuccess, showError, getAuthToken, loadShops

(function(){
  // 批准店铺
  window.approveShop = async function approveShop(shopId) {
    try {
      if (typeof showLoading === 'function') showLoading('正在审批店铺...');
      const response = await fetch(`/api/shops/${shopId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
        }
      });
      
      if (response.ok) {
        if (typeof showSuccess === 'function') showSuccess('店铺已批准');
        if (typeof loadShops === 'function') await loadShops();
      } else {
        if (typeof showError === 'function') showError('批准失败');
      }
    } catch (error) {
      console.error('审批店铺失败:', error);
      if (typeof showError === 'function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };

  // 拒绝店铺
  window.rejectShop = async function rejectShop(shopId) {
    try {
      if (typeof showLoading === 'function') showLoading('正在拒绝店铺...');
      const response = await fetch(`/api/shops/${shopId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
        }
      });
      
      if (response.ok) {
        if (typeof showSuccess === 'function') showSuccess('店铺已拒绝');
        if (typeof loadShops === 'function') await loadShops();
      } else {
        if (typeof showError === 'function') showError('拒绝失败');
      }
    } catch (error) {
      console.error('拒绝店铺失败:', error);
      if (typeof showError === 'function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };

  // 激活店铺
  window.activateShop = async function activateShop(shopId) {
    try {
      if (typeof showLoading === 'function') showLoading('正在激活店铺...');
      const response = await fetch(`/api/shops/${shopId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
        }
      });
      
      if (response.ok) {
        if (typeof showSuccess === 'function') showSuccess('店铺已激活');
        if (typeof loadShops === 'function') await loadShops();
      } else {
        if (typeof showError === 'function') showError('激活失败');
      }
    } catch (error) {
      console.error('激活店铺失败:', error);
      if (typeof showError === 'function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };

  // 停用店铺
  window.deactivateShop = async function deactivateShop(shopId) {
    try {
      if (typeof showLoading === 'function') showLoading('正在停用店铺...');
      const response = await fetch(`/api/shops/${shopId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : ''}`
        }
      });
      
      if (response.ok) {
        if (typeof showSuccess === 'function') showSuccess('店铺已停用');
        if (typeof loadShops === 'function') await loadShops();
      } else {
        if (typeof showError === 'function') showError('停用失败');
      }
    } catch (error) {
      console.error('停用店铺失败:', error);
      if (typeof showError === 'function') showError('网络错误，请重试');
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };
})();
