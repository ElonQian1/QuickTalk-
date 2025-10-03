/*
 * messages-init.js — 消息页统一幂等初始化入口
 * - 统一初始化 messages-bootstrap / messages-views / messages-header 等胶水
 * - 确保在 PartialsLoader 完成后再执行
 */
(function(){
  'use strict';

  var booted = false;
  async function ensurePartials(){
    try {
      if (window.PartialsLoader && typeof window.PartialsLoader.loadPartials === 'function') {
        await window.PartialsLoader.loadPartials();
      }
    } catch(_) {}
  }

  async function initOnce(){
    if (booted) return; booted = true;
    await ensurePartials();

    try { window.MessagesBootstrap && typeof window.MessagesBootstrap.init==='function' && window.MessagesBootstrap.init(); } catch(_){}
    try { window.MessagesHeader && typeof window.MessagesHeader.init==='function' && window.MessagesHeader.init(); } catch(_){}
    // 在片段加载后再初始化 ChatComposer，确保能找到输入与按钮
    try { window.ChatComposer && typeof window.ChatComposer.init==='function' && window.ChatComposer.init(); } catch(_){}
    // 启用聊天滚动指示器（回到底部按钮）
    try { window.ChatScrollIndicator && typeof window.ChatScrollIndicator.init==='function' && window.ChatScrollIndicator.init(); } catch(_){}
    // messages-views 只需要导出 show，无需 init；此处只是保证已加载
    if (!window.MessagesViews) {
      console.warn('messages-views.js 尚未加载，视图切换使用兜底显示');
    }
    console.log('✅ messages-init.js 初始化完成');
  }

  function init(){ setTimeout(initOnce, 50); }

  window.MessagesInit = { init };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
