/*
 * 消息头部胶水 (messages-header.js)
 * - 绑定 #messagesBackBtn 的点击行为，委托给 messageModule.goBack()
 * - 幂等绑定，页面片段重载后可重复调用 init()
 */
(function(){
  'use strict';

  var wired = false;

  function bind(){
    var backBtn = document.getElementById('messagesBackBtn');
    if (!backBtn) return;
    if (backBtn.__msgHeaderWired) return;
    backBtn.addEventListener('click', function(){
      if (window.messageModule && typeof window.messageModule.goBack === 'function') {
        window.messageModule.goBack();
      } else {
        // 兜底：简单切回店铺入口
        if (typeof window.loadConversations === 'function') window.loadConversations();
      }
    });
    backBtn.__msgHeaderWired = true;
  }

  function init(){ setTimeout(bind, 150); }

  window.MessagesHeader = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
