// shop-management-modal.js — 店铺管理模态与逻辑模块
// 依赖：showToast, getAuthToken, currentShopId, shopsData
// 保留全局函数名，确保与主页面兼容

// 显示店铺管理模态框
window.showShopManagementModal = function showShopManagementModal(shop) {
    console.log('显示店铺管理模态框:', shop.name);
    showToast(`管理店铺"${shop.name}"功能开发中...`, 'info');
    // TODO: 实现店铺管理模态框
};


// 编辑店铺
window.editShop = function editShop(shopId, event) {
    if (event) event.stopPropagation();
    console.log('编辑店铺:', shopId);
    if (typeof window.openEditShop === 'function') {
        window.openEditShop(shopId);
    } else {
        showToast('编辑店铺功能开发中...', 'info');
    }
};

// 查看店铺
window.viewShop = function viewShop(shopId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const shop = typeof window.shopsData !== 'undefined' ? window.shopsData.find(s => s.id === shopId) : null;
    if (!shop) { showToast('店铺信息未找到', 'error'); return; }
    if (typeof window.showShopDetails === 'function') {
        window.showShopDetails(shop);
    } else {
        showToast('店铺详情功能开发中...', 'info');
    }
};

// 查看店铺消息
window.viewShopMessages = function viewShopMessages(shopId, event) {
    if (event) event.stopPropagation();
    console.log('查看店铺消息:', shopId);
    if (typeof window.selectShop === 'function') {
        window.selectShop(shopId);
    } else {
        showToast('查看店铺消息功能开发中...', 'info');
    }
};

// 重新提交店铺申请
window.resubmitShop = function resubmitShop(shopId, event) {
    if (event) event.stopPropagation();
    const shop = typeof window.shopsData !== 'undefined' ? window.shopsData.find(s => s.id === shopId) : null;
    if (!shop) return;
    if (confirm(`确认要重新提交店铺"${shop.name}"的审核申请吗？`)) {
        console.log('重新提交店铺申请:', shopId);
        showToast('重新提交功能开发中...', 'info');
        // TODO: 实现重新提交功能
    }
};
