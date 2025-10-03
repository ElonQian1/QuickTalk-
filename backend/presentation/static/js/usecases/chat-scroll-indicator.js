(function(){
  'use strict';

  var THRESHOLD = 80; // px
  var inited = false;

  function nearBottom(el){
    try { return el.scrollHeight - el.scrollTop - el.clientHeight <= THRESHOLD; } catch(_e){ return true; }
  }

  function bind(){
    var list = document.getElementById('chatMessages');
    if (!list) { setTimeout(bind, 200); return; }
    if (inited) return; inited = true;

    function update(){
      if (!list) return;
      if (nearBottom(list)) {
        if (window.ScrollToBottomUI) window.ScrollToBottomUI.hide();
      } else {
        if (window.ScrollToBottomUI) window.ScrollToBottomUI.show();
      }
    }

    list.addEventListener('scroll', update);
    // 当渲染新消息时，如果不在底部，则显示按钮提示用户回到底部
    list.addEventListener('message:rendered', function(){
      update();
    });

    // 初始计算
    setTimeout(update, 100);
  }

  function init(){
    if (window.ScrollToBottomUI && typeof window.ScrollToBottomUI.ensure==='function'){
      window.ScrollToBottomUI.ensure();
    }
    bind();
    console.log('✅ chat-scroll-indicator 用例已初始化');
  }

  window.ChatScrollIndicator = { init: init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
