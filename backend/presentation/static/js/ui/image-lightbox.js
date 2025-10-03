(function(){
  'use strict';

  var STYLE_ID = 'qt-lightbox-style';
  var ID = 'qt-image-lightbox';
  var inited = false;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#'+ID+'{position:fixed;inset:0;background:rgba(0,0,0,.9);display:none;align-items:center;justify-content:center;z-index:9999;}',
      '#'+ID+' img{max-width:92vw;max-height:88vh;object-fit:contain;box-shadow:0 8px 24px rgba(0,0,0,.5);}',
      '#'+ID+' .close{position:absolute;top:14px;right:14px;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:8px 12px;font-size:14px;cursor:pointer;}',
      '@media (max-width:480px){#'+ID+' .close{padding:8px 10px;font-size:13px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensure(){
    if (inited) return document.getElementById(ID);
    injectStyle();
    var wrap = document.getElementById(ID);
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = ID;
      var img = document.createElement('img');
      var close = document.createElement('button');
      close.className = 'close';
      close.textContent = '关闭';
      close.addEventListener('click', hide);
      wrap.appendChild(img); wrap.appendChild(close);
      wrap.addEventListener('click', function(e){ if (e.target === wrap) hide(); });
      document.body.appendChild(wrap);
    }
    inited = true;
    return wrap;
  }

  function open(src){
    var wrap = ensure();
    var img = wrap.querySelector('img');
    if (img){ img.src = src; }
    wrap.style.display = 'flex';
  }

  function hide(){
    var wrap = document.getElementById(ID);
    if (wrap) wrap.style.display = 'none';
  }

  window.LightboxUI = { ensure: ensure, open: open, hide: hide };
  console.log('✅ image-lightbox UI 已加载');
})();
