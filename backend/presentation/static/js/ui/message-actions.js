(function(){
  'use strict';
  var STYLE_ID = 'qt-message-actions-style';
  var ID = 'qt-message-actions';
  var inited = false;

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#'+ID+'{position:fixed;left:0;top:0;width:100vw;height:100vh;display:none;z-index:9998}',
      '#'+ID+' .mask{position:absolute;inset:0;background:rgba(0,0,0,.2)}',
      '#'+ID+' .panel{position:absolute;min-width:160px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:8px;}',
      '#'+ID+' .item{padding:10px 12px;border-radius:8px;cursor:pointer;font-size:14px;color:#334155}',
      '#'+ID+' .item:hover{background:#f1f5f9}',
      '@media (max-width:480px){#'+ID+' .panel{min-width:140px}}'
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
      var mask = document.createElement('div'); mask.className = 'mask';
      var panel = document.createElement('div'); panel.className = 'panel';
      wrap.appendChild(mask); wrap.appendChild(panel);
      mask.addEventListener('click', hide);
      document.body.appendChild(wrap);
    }
    inited = true;
    return wrap;
  }

  function show(x, y, options){
    var wrap = ensure();
    var panel = wrap.querySelector('.panel');
    panel.innerHTML = '';
    (options && options.items || [
      { key: 'copy', label: '复制文本' },
      { key: 'delete', label: '删除(占位)' },
      { key: 'forward', label: '转发(占位)' }
    ]).forEach(function(it){
      var div = document.createElement('div');
      div.className = 'item'; div.textContent = it.label;
      div.addEventListener('click', function(){ hide(); if (options && typeof options.onSelect==='function') options.onSelect(it.key); });
      panel.appendChild(div);
    });
    // 定位
    panel.style.left = Math.max(8, Math.min(x, window.innerWidth - panel.offsetWidth - 8)) + 'px';
    panel.style.top  = Math.max(8, Math.min(y, window.innerHeight - panel.offsetHeight - 8)) + 'px';
    wrap.style.display = 'block';
  }

  function hide(){
    var wrap = document.getElementById(ID);
    if (wrap) wrap.style.display = 'none';
  }

  window.MessageActionsUI = { ensure: ensure, show: show, hide: hide };
  console.log('✅ message-actions UI 已加载');
})();
