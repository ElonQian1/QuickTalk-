// 移动端初始化：数据同步管理器、店铺卡片管理器、导航红点与未读更新逻辑
(function(){
  // 初始化数据同步管理器
  try {
    if (typeof DataSyncManager !== 'undefined') {
      window.mobileDataSyncManager = new DataSyncManager();
      window.mobileDataSyncManager.enableDebugMode(); // 开启调试模式
      console.log('✅ mobileDataSyncManager 初始化成功');
    } else {
      console.error('❌ DataSyncManager 类未找到，请检查 data-sync-manager.js 文件加载');
    }
  } catch (error) {
    console.error('❌ mobileDataSyncManager 初始化失败:', error);
  }

  // 初始化店铺卡片管理器（backend/presentation版本）
  ShopCardManager.quickInit({
    debug: true,
    selector: '.shop-card',
    delay: 4000,
    updateInterval: 30000
  }).then(manager => {
    window.shopCardManager = manager;
    console.log('💾 backend/presentation版店铺卡片管理器初始化完成');
  });

  // 初始化导航红点管理器
  const navBadgeManager = NavBadgeManager.quickInit({
    debug: true
  });
  window.navBadgeManager = navBadgeManager;
  console.log('🧭 backend/presentation版导航红点管理器初始化完成');

  // 更新店铺未读数量显示（简化版）
  function updateShopBadgeDisplay(shopCard, unreadCount) {
    const unreadSpan = shopCard.querySelector('.unread-count');
    if (unreadSpan) {
      unreadSpan.setAttribute('data-unread', unreadCount || 0);
      if (unreadCount > 0) {
        unreadSpan.style.display = 'inline';
        unreadSpan.textContent = `(${unreadCount})`;
      } else {
        unreadSpan.style.display = 'none';
        unreadSpan.textContent = '';
      }
      console.log(`� 更新店铺未读数: ${shopCard.getAttribute('data-shop-id')}, 未读数: ${unreadCount}`);
    }
  }

  // 移动端店铺未读消息更新函数
  async function updateMobileShopUnreadBadges() {
    console.log('🔄 移动端: 更新店铺未读消息红点...');
    const shopCards = document.querySelectorAll('.shop-card[data-shop-id]');
    for (const shopCard of shopCards) {
      const shopId = shopCard.getAttribute('data-shop-id');
      const isTempShop = (id) => typeof id === 'string' && id.startsWith('temp-shop-');
      if (shopId && !isTempShop(shopId)) {
        try {
          if (!window.mobileDataSyncManager) {
            console.warn('⚠️ mobileDataSyncManager 未初始化');
            continue;
          }
          const stats = await window.mobileDataSyncManager.forceRefreshShopStats(shopId);
          if (stats) {
            console.log(`✅ 移动端店铺 ${shopId} 未读消息已更新: ${stats.unread_count}`);
            updateShopBadgeDisplay(shopCard, stats.unread_count);
          }
        } catch (error) {
          console.warn(`⚠️ 移动端更新店铺 ${shopId} 未读消息失败:`, error);
        }
      }
    }
  }

  // 页面加载完成后立即更新一次
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
      console.log('🔄 移动端初始化店铺未读消息红点更新...');
      updateMobileShopUnreadBadges();
    }, 2000);
  });

  // 每30秒更新一次未读消息红点
  setInterval(() => { updateMobileShopUnreadBadges(); }, 30000);

  // 监听店铺数据刷新事件，当店铺列表更新时也更新红点
  const observer = new MutationObserver(function(mutations) {
    let shouldUpdate = false;
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1 && (node.classList.contains('shop-card') || node.querySelector?.('.shop-card'))) {
            shouldUpdate = true;
          }
        });
      }
    });
    if (shouldUpdate) {
      setTimeout(() => {
        console.log('🔄 移动端检测到店铺列表变化，更新未读消息红点...');
        updateMobileShopUnreadBadges();
      }, 1000);
    }
  });

  // 监听店铺容器的变化
  setTimeout(() => {
    const shopsContainer = document.getElementById('shopsListView') || document.querySelector('.shop-grid');
    if (shopsContainer) {
      observer.observe(shopsContainer, { childList: true, subtree: true });
      console.log('📱 移动端店铺容器监听器已启动');
    }
  }, 1000);

  // 测试未读数量显示功能
  setTimeout(() => {
    const firstShopCard = document.querySelector('.shop-card[data-shop-id]');
    if (firstShopCard) {
      console.log('🧪 测试：为第一个店铺添加未读数量显示 (5)');
      const unreadSpan = firstShopCard.querySelector('.unread-count');
      if (unreadSpan) {
        unreadSpan.style.display = 'inline';
        unreadSpan.textContent = '(5)';
        console.log('✅ 测试显示成功');
      } else {
        console.log('❌ 未找到 .unread-count 元素');
      }
    } else {
      console.log('❌ 未找到店铺卡片');
    }
  }, 3000);
})();
