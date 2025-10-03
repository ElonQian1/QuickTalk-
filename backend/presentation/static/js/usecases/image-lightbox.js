(function(){
  'use strict';
  var inited = false;

  function onClick(e){
    var t = e.target;
    if (!(t && t.tagName === 'IMG')) return;
    // 仅处理消息中的图片
    var bubble = t.closest('.message-bubble, .message-media');
    if (!bubble) return;
    if (window.LightboxUI && typeof window.LightboxUI.open==='function'){
      window.LightboxUI.open(t.src);
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function bind(){
    var list = document.getElementById('chatMessages');
    if (!list) { setTimeout(bind, 200); return; }
    if (inited) return; inited = true;
    if (window.LightboxUI && typeof window.LightboxUI.ensure==='function') window.LightboxUI.ensure();
    list.addEventListener('click', onClick);
    console.log('✅ image-lightbox 用例已初始化');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else { bind(); }
})();
