(function(){
  'use strict';

  var BTN_ID = 'scrollToBottomBtn';
  var STYLE_ID = 'qt-scroll-bottom-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#'+BTN_ID+'{position:fixed;right:16px;bottom:104px;z-index:120;background:#667eea;color:#fff;border:none;border-radius:20px;padding:8px 12px;box-shadow:0 4px 12px rgba(0,0,0,.15);cursor:pointer;font-size:12px;display:none;}',
      '#'+BTN_ID+':hover{background:#5a6fd8}',
      '@media (max-width:480px){#'+BTN_ID+'{bottom:96px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensure(){
    injectStyle();
    var btn = document.getElementById(BTN_ID);
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '↓ 回到底部';
    btn.addEventListener('click', function(){
      var list = document.getElementById('chatMessages');
      if (!list) return;
      list.scrollTop = list.scrollHeight;
      hide();
    });
    document.body.appendChild(btn);
    return btn;
  }

  function show(){ var b = ensure(); b.style.display = 'block'; }
  function hide(){ var b = document.getElementById(BTN_ID); if (b) b.style.display = 'none'; }

  window.ScrollToBottomUI = { ensure: ensure, show: show, hide: hide };
  console.log('✅ scroll-to-bottom UI 已加载');
})();
