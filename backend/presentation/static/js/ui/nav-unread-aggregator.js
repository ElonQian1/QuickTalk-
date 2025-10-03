/**
 * NavUnreadAggregator
 * 负责聚合所有店铺的未读总数，并刷新导航栏 #messagesBadge
 */
(function () {
  const SEL = '#messagesBadge';

  function computeTotalFromDom() {
    // 优先读取适配器组件
    const comps = document.querySelectorAll('.shop-card [data-shop-id] .unread-badge-component, .shop-card[data-shop-id] .unread-badge-component');
    let total = 0;
    comps.forEach((el) => {
      const v = parseInt(el.getAttribute('data-count')) || 0;
      total += v;
    });
    // 兜底：读取 .unread-badge / .shop-unread-badge
    if (total === 0) {
      const domBadges = document.querySelectorAll('.shop-card .unread-badge, .shop-card .shop-unread-badge');
      domBadges.forEach((el) => {
        const v = parseInt(el.textContent) || parseInt(el.getAttribute('data-unread-count')) || 0;
        total += v;
      });
    }
    return total;
  }

  function updateNav(total) {
    const v = Math.max(0, parseInt(total) || 0);
    // 优先委托 NavBadgeManager，保持统一的红点更新路径
    if (window.navBadgeManager && typeof window.navBadgeManager.updateNavBadge === 'function') {
      try { window.navBadgeManager.updateNavBadge('messages', v); return; } catch(_){}
    }
    // 兜底：直接更新 DOM（旧路径兼容）
    const el = document.querySelector(SEL);
    if (!el) return;
    if (v > 0) {
      el.textContent = v > 99 ? '99+' : String(v);
      el.style.display = 'inline-flex';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  function refresh() {
    updateNav(computeTotalFromDom());
  }

  // 供外部调用
  window.NavUnreadAggregator = { refresh };

  // DOM 变化时自动刷新（节流）
  let t;
  const observer = new MutationObserver(() => {
    clearTimeout(t);
    t = setTimeout(refresh, 120);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  // 首屏延迟刷新
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(refresh, 600));
  } else {
    setTimeout(refresh, 600);
  }
})();
