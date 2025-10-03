/**
 * 超级管理员功能模块（薄代理 → UnifiedUsecases）
 */
(function(){
  'use strict';
  function callU(name, args){
    try {
      if (window.UnifiedUsecases && typeof window.UnifiedUsecases[name] === 'function') {
        return window.UnifiedUsecases[name].apply(null, args||[]);
      }
    } catch(e){ console.warn('super-admin proxy error:', name, e); }
  }

  // 薄代理：全部委托到 UnifiedUsecases，保持全局 API 名称不变
  window.showAdminPanel = function(){ return callU('showAdminPanel'); };
  window.loadSystemStats = function(){ return callU('loadSystemStats'); };
  window.loadShopOwnersStats = function(keyword){ return callU('loadShopOwnersStats', [keyword]); };
  window.renderOwnersList = function(owners){ return callU('renderOwnersList', [owners]); };
  window.searchShopOwners = function(){ return callU('searchShopOwners'); };
  window.viewOwnerDetails = function(ownerId){ return callU('viewOwnerDetails', [ownerId]); };
  window.showOwnerDetailsModal = function(data){ return callU('showOwnerDetailsModal', [data]); };
  window.toggleOwnerStatus = function(ownerId, newStatus){ return callU('toggleOwnerStatus', [ownerId, newStatus]); };
  window.loadAllShopsMonitor = function(){ return callU('loadAllShopsMonitor'); };
  window.renderShopsMonitor = function(shops){ return callU('renderShopsMonitor', [shops]); };
  window.loadPendingShops = function(){ return callU('loadPendingShops'); };
  window.renderPendingShops = function(shops){ return callU('renderPendingShops', [shops]); };
  window.reviewApprove = function(shopId){ return callU('reviewApprove', [shopId]); };
  window.reviewReject = function(shopId){ return callU('reviewReject', [shopId]); };
  window.refreshPendingShops = function(){ return callU('refreshPendingShops'); };

  console.log('✅ 超级管理员模块已加载 (super-admin.js → 代理 UnifiedUsecases)');
})();
