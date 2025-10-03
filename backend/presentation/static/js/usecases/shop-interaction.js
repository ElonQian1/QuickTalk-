"use strict";

// shop-interaction.js — 店铺交互处理（从 mobile-dashboard.html 抽取）
// 提供：handleShopClick, viewShop, editShop, resubmitShop, viewShopMessages, manageShopEmployees
// 依赖：shopsData, getEffectiveStatus, selectShop, viewShopDetails, showShopDetails, showToast

(function(){
  // 处理店铺卡片点击 - 区分卡片点击和按钮点击
  window.handleShopClick = function handleShopClick(shopId, event) {
    // 如果点击的是操作按钮，不执行卡片默认行为
    if (event.target.classList.contains('shop-action-btn')) {
      return;
    }
    
    // 默认行为：查看店铺详情或进入对话
    const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData))
      ? shopsData.find(s => s.id === shopId)
      : null;
    if (shop && typeof getEffectiveStatus === 'function') {
      const status = getEffectiveStatus(shop);
      if (status === 'approved' || status === 'active') {
        // 如果是已激活的店铺，进入对话列表
        if (typeof selectShop === 'function') selectShop(shopId);
      } else {
        // 其他状态显示店铺详情
        if (typeof viewShopDetails === 'function') viewShopDetails(shopId);
      }
    }
  };

  // 查看店铺详情
  window.viewShop = function viewShop(shopId, event) {
    if (event) event.stopPropagation();
    const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData))
      ? shopsData.find(s => s.id === shopId)
      : null;
    if (!shop) return;
    
    console.log('查看店铺详情:', shopId);
    if (typeof showShopDetails === 'function') showShopDetails(shop);
  };

  // 编辑店铺
  window.editShop = function editShop(shopId, event) {
    if (event) event.stopPropagation();
    console.log('编辑店铺:', shopId);
    if (typeof showToast === 'function') showToast('编辑店铺功能开发中...', 'info');
    // TODO: 实现编辑店铺功能
  };

  // 重新提交店铺申请
  window.resubmitShop = function resubmitShop(shopId, event) {
    if (event) event.stopPropagation();
    const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData))
      ? shopsData.find(s => s.id === shopId)
      : null;
    if (!shop) return;
    
    if (confirm(`确认要重新提交店铺"${shop.name}"的审核申请吗？`)) {
      console.log('重新提交店铺申请:', shopId);
      if (typeof showToast === 'function') showToast('重新提交功能开发中...', 'info');
      // TODO: 实现重新提交功能
    }
  };

  // 查看店铺消息
  window.viewShopMessages = function viewShopMessages(shopId, event) {
    if (event) event.stopPropagation();
    console.log('查看店铺消息:', shopId);
    // 直接跳转到对话列表
    if (typeof selectShop === 'function') selectShop(shopId);
  };

  // 员工管理
  window.manageShopEmployees = function manageShopEmployees() {
    if (typeof currentShopId === 'undefined' || !currentShopId) {
      if (typeof showToast === 'function') showToast('请先选择一个店铺', 'error');
      return;
    }
    
    if (typeof showToast === 'function') showToast('员工管理功能开发中...', 'info');
    // TODO: 实现员工管理功能
  };
})();
