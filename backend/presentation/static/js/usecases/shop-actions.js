"use strict";

// 店铺动作入口（从 mobile-dashboard.html 抽离）
// 保持原函数名：openShop, manageShop, viewShopDetails
// 依赖：shopsData, selectShop, getEffectiveStatus, getShopStatusText, showToast, openShopManagement, showShopDetails

function viewShopDetails(shopId) {
  const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData)) ? shopsData.find(s => s.id === shopId) : null;
  if (!shop) return;
  console.log('查看店铺详情:', shop);
  if (typeof showToast === 'function') {
    showToast(`店铺: ${shop.name} - ${getShopStatusText(getEffectiveStatus(shop))}`, 'info');
  }
}

function manageShop(shopId, event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  const shop = (typeof shopsData !== 'undefined' && Array.isArray(shopsData)) ? shopsData.find(s => s.id === shopId) : null;
  if (!shop) return;
  console.log('管理店铺:', shopId);
  if (typeof openShopManagement === 'function') openShopManagement(shopId);
}

function openShop(shopId) {
  console.log('打开店铺:', shopId);
  if (typeof showToast === 'function') showToast('店铺详情功能开发中...', 'info');
}
