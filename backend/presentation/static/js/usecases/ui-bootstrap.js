/**
 * UI 启动模块 (ui-bootstrap.js)
 * - 初始化数据同步管理器与店铺卡片管理器
 * - 保持与原有日志与顺序一致
 */
(function(){
  'use strict';

  if (window.__UIBootstrapBooted) {
    console.log('ℹ️ ui-bootstrap 已执行过，跳过重复执行');
    return;
  }

  function initDataSync() {
    try {
      if (window.unifiedDataSyncManager) {
        window.mobileDataSyncManager = window.unifiedDataSyncManager;
        console.log('✅ 复用 unifiedDataSyncManager 作为 mobileDataSyncManager');
      } else if (typeof window.DataSyncManager !== 'undefined') {
        try {
          window.mobileDataSyncManager = new window.DataSyncManager();
        } catch(_) {
          // 兼容薄代理返回实例
          window.mobileDataSyncManager = window.DataSyncManager;
        }
        if (typeof window.mobileDataSyncManager.enableDebugMode === 'function') {
          window.mobileDataSyncManager.enableDebugMode();
        }
        console.log('✅ mobileDataSyncManager 初始化成功');
      } else {
        console.error('❌ DataSyncManager 类未找到，请检查 data-sync-manager.js 文件加载');
      }
    } catch (error) {
      console.error('❌ mobileDataSyncManager 初始化失败:', error);
    }
  }

  function initShopCardManager() {
    if (typeof window.ShopCardManager === 'undefined' || typeof window.ShopCardManager.quickInit !== 'function') {
      console.warn('ShopCardManager.quickInit 不可用，跳过初始化');
      return;
    }
    window.ShopCardManager.quickInit({
      debug: true,
      selector: '.shop-card',
      delay: 4000,
      updateInterval: 30000
    }).then(function(manager){
      window.shopCardManager = manager;
      console.log('💾 backend/presentation版店铺卡片管理器初始化完成');
    }).catch(function(err){
      console.warn('ShopCardManager 初始化失败:', err);
    });
  }

  // 对外暴露一个启动函数，供需要时调用；也可在 DOMContentLoaded 后自动执行
  function bootstrapUI(){
    initDataSync();
    initShopCardManager();
  }

  window.UIBootstrap = {
    bootstrap: bootstrapUI,
    initDataSync: initDataSync,
    initShopCardManager: initShopCardManager
  };

  // 若页面已就绪则自动启动（与原内联脚本保持体验一致）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      if (window.__UIBootstrapBooted) return;
      window.__UIBootstrapBooted = true;
      bootstrapUI();
    });
  } else {
    if (!window.__UIBootstrapBooted) {
      window.__UIBootstrapBooted = true;
      bootstrapUI();
    }
  }

  console.log('✅ ui-bootstrap.js 加载完成');
})();
