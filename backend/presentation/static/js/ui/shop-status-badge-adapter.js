/**
 * ShopStatusBadgeAdapter
 * 作用：在每个 .shop-card 的 .shop-status 内挂载未读红点组件（UnreadBadgeComponent），
 * 不破坏原有 DOM 结构，便于与现有脚本协同（DataSyncManager/ShopCardManager）。
 */
(function () {
  const STATE = {
    map: new Map(), // shopId -> UnreadBadgeComponent 实例
    ready: false,
  };

  function log(...args) {
    if (window.__SHOP_STATUS_BADGE_DEBUG__) {
      console.log('🧩 ShopStatusBadgeAdapter:', ...args);
    }
  }

  function ensureBadgeForStatusEl(statusEl, shopId) {
    if (!statusEl || !shopId) return null;

    // 已存在组件实例则直接返回
    if (STATE.map.has(shopId)) {
      return STATE.map.get(shopId);
    }

    // 优先复用已存在的占位（.unread-badge 或 .unread-badge-component）
    const existingComponentEl = statusEl.querySelector('.unread-badge-component');
    if (existingComponentEl) {
      // 构造一个轻量“代理”对象以复用 updateCount 逻辑
      const proxy = {
        element: existingComponentEl,
        count: parseInt(existingComponentEl.getAttribute('data-count')) || 0,
        updateCount(n) {
          const v = Math.max(0, parseInt(n) || 0);
          this.count = v;
          this.element.setAttribute('data-count', String(v));
          this.element.textContent = v > 0 ? (v > 99 ? '99+' : String(v)) : '';
          this.element.style.display = v > 0 ? 'flex' : (this.element.textContent ? 'flex' : 'none');
          return this;
        },
      };
      STATE.map.set(shopId, proxy);
      return proxy;
    }

    // 创建新的组件
    try {
      if (typeof window.UnreadBadgeComponent !== 'function') {
        log('UnreadBadgeComponent 不可用，延后再试');
        return null;
      }

      const badge = new window.UnreadBadgeComponent({
        size: 'medium',
        position: 'inline',
        animation: true,
        autoHide: false, // 允许未读=0时显示一个小圆点（有会话时）
        showZero: false,
        clickable: true,
      });
      badge.create(statusEl);
      STATE.map.set(shopId, badge);
      return badge;
    } catch (e) {
      console.warn('创建未读红点失败:', e);
      return null;
    }
  }

  function attachAll() {
    const cards = document.querySelectorAll('.shop-card[data-shop-id]');
    let attached = 0;
    cards.forEach((card) => {
      const shopId = card.getAttribute('data-shop-id');
      let targetEl = card.querySelector('.shop-status');
      // 兼容 ShopCardManager 将 .shop-status 替换为 .shop-badge-container 的情况
      if (!targetEl) {
        targetEl = card.querySelector('.shop-badge-container');
      }
      if (!shopId || !targetEl) return;
      const comp = ensureBadgeForStatusEl(targetEl, shopId);
      if (comp) attached += 1;
    });
    if (attached > 0) log(`挂载红点组件 ${attached} 个`);
  }

  function update(shopId, payload) {
    const scopes = document.querySelectorAll(`.shop-card[data-shop-id=\"${shopId}\"] .shop-status, .shop-card[data-shop-id=\"${shopId}\"] .shop-badge-container`);
    const unread = typeof payload === 'object' ? (parseInt(payload.unread) || 0) : (parseInt(payload) || 0);
    const hasConversations = typeof payload === 'object'
      ? (payload.hasConversations === true || payload.conversationCount > 0)
      : null;
    scopes.forEach((targetEl) => {
      const comp = ensureBadgeForStatusEl(targetEl, shopId);
      if (comp && typeof comp.updateCount === 'function') {
        comp.updateCount(unread);
        if (unread <= 0 && hasConversations) {
          // 显示空心小红点（利用 :empty 样式实现小点）
          try { comp.element && (comp.element.style.display = 'flex'); } catch (_) {}
        }
      }
      // 同时兼容老的占位 .unread-badge / .shop-unread-badge
      const domBadges = targetEl.querySelectorAll('.unread-badge, .shop-unread-badge');
      domBadges.forEach((b) => {
        const v = Math.max(0, unread || 0);
        if (v > 0) {
          b.textContent = v > 99 ? '99+' : String(v);
          b.style.display = 'inline-flex';
        } else if (hasConversations) {
          // 有会话但未读=0，显示一个小点（无文字）
          b.textContent = '';
          b.style.display = 'inline-flex';
        } else {
          b.textContent = '';
          b.style.display = 'none';
        }
      });
    });
  }

  function init() {
    if (STATE.ready) return;
    STATE.ready = true;
    attachAll();

    // 监听 DOM 变化，自动为新卡片挂载
    const observer = new MutationObserver((mutations) => {
      let needAttach = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          needAttach = true; break;
        }
      }
      if (needAttach) {
        // 小延迟确保节点完全插入
        setTimeout(attachAll, 50);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 首屏渲染后尝试刷新一次未读
    setTimeout(() => {
      try {
        const dsm = window.mobileDataSyncManager || window.DataSyncManager;
        if (dsm && typeof dsm.refreshAllVisibleShops === 'function') {
          dsm.refreshAllVisibleShops();
        }
      } catch (_) {}
    }, 500);

    log('初始化完成');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露全局 API
  window.ShopStatusBadgeAdapter = {
    init,
    update,
  };
})();
