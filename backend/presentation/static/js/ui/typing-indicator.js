(function(){
  'use strict';
  var ID = 'typingIndicator';
  var STYLE_ID = 'qt-typing-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#'+ID+'{position:absolute;left:20px;bottom:-18px;font-size:12px;color:#999;transition:opacity .2s;}',
      '.chat-header{position:relative;}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensure(){
    injectStyle();
    var el = document.getElementById(ID);
    if (el) return el;
    var header = document.querySelector('.chat-header');
    if (!header) return null;
    el = document.createElement('div');
    el.id = ID; el.textContent='';
    header.appendChild(el);
    return el;
  }

  function show(text){
    var el = ensure();
    if (!el) return;
    el.textContent = text || '对方正在输入...';
    clearTimeout(el.__hideTimer);
    el.style.opacity = '1';
    el.__hideTimer = setTimeout(function(){ hide(); }, 3000);
  }

  function hide(){
    var el = document.getElementById(ID);
    if (!el) return;
    el.style.opacity = '0';
    el.textContent = '';
  }

  window.TypingIndicatorUI = { ensure: ensure, show: show, hide: hide };
  console.log('✅ typing-indicator UI 已加载');
})();
