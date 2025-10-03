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
      const nav = document.querySelector('.bottom-nav') || document.getElementById('bottomNav');
      if (!nav) return;

      nav.addEventListener('click', function(e){
        const btn = e.target.closest('[data-target]');
        if (!btn) return;
        const target = btn.getAttribute('data-target');
        if (typeof window.switchPage === 'function') {
          window.switchPage(target);
        }
      });
    } catch (e){ console.warn('bindNavButtons error:', e); }
  }

  function initNavBadges(){
    try {
      // 与 UI 层聚合器对接（若存在）
      if (window.NavUnreadAggregator && typeof window.NavUnreadAggregator.recalculate === 'function') {
        window.NavUnreadAggregator.recalculate();
      }
      // 初始时若有未读条数，确保展示
      const badge = document.getElementById('messagesBadge');
      if (badge) {
        const text = badge.textContent.trim();
        if (text && text !== '0') {
          badge.classList.remove('hidden');
          badge.style.display = 'block';
        }
      }
    } catch (e){ console.warn('initNavBadges error:', e); }
  }

  let __inited = false;
  function init(){
    if (__inited) return; // 幂等保护
    __inited = true;
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
