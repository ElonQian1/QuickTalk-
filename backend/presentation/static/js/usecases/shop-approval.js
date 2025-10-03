"use strict";

// shop-approval.js — 店铺审批相关 API 调用（从 mobile-dashboard.html 抽取）
// 提供：approveShop(shopId[, event]), rejectShop(shopId[, event])
// 依赖：getAuthToken, showLoading/hideLoading, showSuccess/showError, showToast, loadShops, fetchDashboardStats

(function(){
  // 简单审批（无确认/无理由）
  window.approveShop = async function approveShop(shopId, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (typeof confirm === 'function' && event) {
      if (!confirm('确认通过这个店铺的审核吗？')) return;
    }
    try {
      if (typeof showLoading === 'function') showLoading('正在审批店铺...');
      const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      const response = await fetch(`/api/shops/${shopId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Session-Id': authToken
        },
        body: JSON.stringify({ note: '审核通过，欢迎使用我们的客服系统！' })
      });
      const data = await response.json ? await response.json() : {};
      if (data.success || response.ok) {
        if (typeof showToast === 'function') showToast('✅ 店铺审核通过！', 'success');
        if (typeof showSuccess === 'function') showSuccess('店铺已批准');
        if (typeof loadShops === 'function') await loadShops();
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
      } else {
        if (typeof showToast === 'function') showToast(data.error || '审核失败，请重试', 'error');
        if (typeof showError === 'function') showError('批准失败');
      }
    } catch (error) {
      if (typeof showToast === 'function') showToast('网络错误，请稍后重试', 'error');
      if (typeof showError === 'function') showError('网络错误，请重试');
      if (typeof console !== 'undefined') console.error('审批店铺失败:', error);
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };

  window.rejectShop = async function rejectShop(shopId, event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    let reason = '';
    if (typeof prompt === 'function') reason = prompt('请输入拒绝原因：');
    if (reason === null || reason === undefined || reason === '') return;
    try {
      if (typeof showLoading === 'function') showLoading('正在拒绝店铺...');
      const authToken = (typeof getAuthToken === 'function') ? getAuthToken() : '';
      const response = await fetch(`/api/shops/${shopId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Session-Id': authToken
        },
        body: JSON.stringify({ note: reason })
      });
      const data = await response.json ? await response.json() : {};
      if (data.success || response.ok) {
        if (typeof showToast === 'function') showToast('❌ 店铺申请已拒绝', 'success');
        if (typeof showSuccess === 'function') showSuccess('店铺已拒绝');
        if (typeof loadShops === 'function') await loadShops();
        if (typeof fetchDashboardStats === 'function') fetchDashboardStats();
      } else {
        if (typeof showToast === 'function') showToast(data.error || '拒绝失败，请重试', 'error');
        if (typeof showError === 'function') showError('拒绝失败');
      }
    } catch (error) {
      if (typeof showToast === 'function') showToast('网络错误，请稍后重试', 'error');
      if (typeof showError === 'function') showError('网络错误，请重试');
      if (typeof console !== 'undefined') console.error('拒绝店铺失败:', error);
    } finally {
      if (typeof hideLoading === 'function') hideLoading();
    }
  };
})();
