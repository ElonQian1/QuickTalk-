(function(){
  'use strict';
  if (window.MediaScrollIntegration) return;
  /**
   * MediaScrollIntegration
   * 负责初始化 MediaLoadScroller 并提供分页前后钩子，保持滚动稳定。
   * 仅做结构接线（不验证运行）。
   */
  const api = {
    ensureInit(){
      if (api._inited) return;
      if (!window.MediaLoadScroller || !window.ScrollCoordinator){ return; } // 依赖未就绪延迟
      try {
        window.MediaLoadScroller.init({
          getContainer: ()=> document.getElementById('chatMessages'),
          isStickyBottom: ()=> {
            if (window.ScrollCoordinator && typeof window.ScrollCoordinator.isStickMode==='function'){
              return window.ScrollCoordinator.isStickMode();
            }
            const c = document.getElementById('chatMessages');
            if (!c) return false;
            return (c.scrollHeight - c.scrollTop - c.clientHeight) < 4; // 简易近底判断
          },
          batchDelay: 60
        });
        api._inited = true;
        if (window.Logger) window.Logger.debug('media-scroll','MediaLoadScroller inited'); else console.log('[MediaScrollIntegration] inited');
      } catch(e){ console.warn('[MediaScrollIntegration] init error', e); }
    },
    beforePrepend(){
      if (window.MediaLoadScroller && window.MediaLoadScroller.registerAnchor){
        try { window.MediaLoadScroller.registerAnchor(); } catch(_){ }
      }
    },
    afterPrepend(){
      if (window.MediaLoadScroller && window.MediaLoadScroller.applyAfterPrepend){
        try { window.MediaLoadScroller.applyAfterPrepend(); } catch(_){ }
      }
    }
  };
  window.MediaScrollIntegration = api;
  // 延迟尝试初始化（多脚本加载顺序不确定）
  setTimeout(api.ensureInit, 300);
  console.log('✅ media-scroll-integration.js 加载 (结构接线)');
})();
