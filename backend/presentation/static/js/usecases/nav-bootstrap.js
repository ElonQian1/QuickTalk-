/*
 * 导航与徽章初始化 (nav-bootstrap.js)
 * - 负责绑定底部导航按钮事件
 * - 初始化与维护导航层级的未读徽章显示策略
 * - 通过 window.NavBootstrap 暴露 init()
 */
(function(){
  'use strict';

  function safe(fn){ try { return typeof fn === 'function' ? fn : function(){}; } catch(_) { return function(){}; } }

  function bindNavButtons(){
    try {
      // 统一绑定 .nav-item[data-page]（与 bottom-nav.html 一致）
      const items = document.querySelectorAll('.bottom-nav .nav-item[data-page]');
      if (!items || items.length === 0) return;
      items.forEach(function(item){
        item.addEventListener('click', function(){
          const page = this.getAttribute('data-page');
          if (typeof window.switchPage === 'function') {
            window.switchPage(page);
          }
        });
      });
    } catch (e){ console.warn('bindNavButtons error:', e); }
  }

  function initNavBadges(){
    try {
      // 与 UI 层聚合器对接（若存在）。注意：nav-unread-aggregator 暴露为 refresh()
      if (window.NavUnreadAggregator && typeof window.NavUnreadAggregator.refresh === 'function') {
        window.NavUnreadAggregator.refresh();
      }
      // 初始时若有未读条数，确保展示
      const badge = document.getElementById('messagesBadge');
      if (badge) {
        const text = badge.textContent.trim();
        if (text && text !== '0') {
          badge.classList.remove('hidden');
          badge.style.display = 'inline-flex';
        }
      }
    } catch (e){ console.warn('initNavBadges error:', e); }
  }

  function ensureNavBadgeManager(){
    try {
      if (!window.navBadgeManager && window.NavBadgeManager) {
        // 幂等创建；若后续 app-bootstrap 也会创建，将优先复用全局实例
        window.navBadgeManager = new window.NavBadgeManager();
      }
    } catch (e){ console.warn('ensureNavBadgeManager error:', e); }
  }

  let __inited = false;
  function init(){
    if (__inited) return; // 幂等保护
    __inited = true;
    ensureNavBadgeManager();
    bindNavButtons();
    initNavBadges();
    console.log('✅ 导航与徽章初始化完成 (nav-bootstrap.js)');
  }

  window.NavBootstrap = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
