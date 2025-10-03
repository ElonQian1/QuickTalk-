/*
 * 页面边界与滚动防抖模块 (page-guard.js)
 * - 控制触摸/滚轮边界，避免过度滚动引起的穿透与回弹
 * - 处理模态遮罩点击关闭与 ESC 键关闭
 * - 幂等初始化：可重复调用不会重复绑定
 */
(function() {
  'use strict';

  const STATE = {
    inited: false,
  };

  function isHomeActive() {
    try {
      const homePage = document.getElementById('homePage');
      return !!(homePage && homePage.classList.contains('active'));
    } catch { return false; }
  }

  function getScrollable(el) {
    return el && el.closest && el.closest('.scrollable-content, .page');
  }

  function onTouchMove(e) {
    try {
      const pageElement = e.target.closest && e.target.closest('.page');
      if (pageElement) {
        if (pageElement.id === 'homePage') {
          e.preventDefault();
          return;
        }
        const scrollable = getScrollable(e.target);
        if (scrollable) {
          const { scrollTop, scrollHeight, clientHeight } = scrollable;
          if (scrollHeight <= clientHeight) {
            e.preventDefault();
            return;
          }
          const up = e.touches && e.changedTouches && (e.touches[0]?.clientY > e.changedTouches[0]?.clientY);
          const down = e.touches && e.changedTouches && (e.touches[0]?.clientY < e.changedTouches[0]?.clientY);
          if (scrollTop <= 0 && up) {
            e.preventDefault();
          } else if (scrollTop >= scrollHeight - clientHeight && down) {
            e.preventDefault();
          }
        }
        return;
      }
      e.preventDefault();
    } catch (_) {
      // 兜底：不阻塞默认行为
    }
  }

  function onWheel(e) {
    try {
      if (isHomeActive()) {
        e.preventDefault();
        return;
      }
      const pageElement = e.target.closest && e.target.closest('.page.active');
      if (pageElement) {
        const scrollable = getScrollable(e.target);
        if (scrollable) {
          const { scrollTop, scrollHeight, clientHeight } = scrollable;
          if (scrollHeight <= clientHeight) {
            e.preventDefault();
            return;
          }
          if ((scrollTop <= 0 && e.deltaY < 0) || (scrollTop >= scrollHeight - clientHeight && e.deltaY > 0)) {
            e.preventDefault();
          }
        }
      }
    } catch (_) {}
  }

  function onOverlayClick(e) {
    try {
      if (e.target && e.target.id === 'modal-overlay') {
        if (typeof window.closeAllModals === 'function') {
          window.closeAllModals();
        }
      }
    } catch (_) {}
  }

  function onKeydown(e) {
    try {
      if (e.key === 'Escape' && typeof window.closeAllModals === 'function') {
        window.closeAllModals();
      }
    } catch (_) {}
  }

  function onWindowClick(event) {
    try {
      const createModal = document.getElementById('createShopModal');
      if (createModal && event.target === createModal) {
        if (typeof window.hideCreateShopModal === 'function') {
          window.hideCreateShopModal();
        } else if (typeof window.closeAllModals === 'function') {
          window.closeAllModals();
        }
      }
    } catch (_) {}
  }

  function initPageGuards() {
    if (STATE.inited) return;
    STATE.inited = true;
    document.body.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('click', onOverlayClick, false);
    document.addEventListener('keydown', onKeydown, false);
    window.addEventListener('click', onWindowClick, false);
    console.log('✅ page-guard.js 已初始化');
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPageGuards, { once: true });
    } else {
      initPageGuards();
    }
  }

  window.initPageGuards = initPageGuards;
  boot();
})();
