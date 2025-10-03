/*
 * UI: WebSocket 连接状态指示器 (connection-indicator.js)
 * - 顶部状态条，显示连接状态（连接中/已连接/断开/重连中）
 * - 提供 show/hide/update 接口
 */
(function(){
  'use strict';

  var STYLE_ID = 'qt-connection-indicator-style';
  var ID = 'qt-connection-indicator';

  var STATES = {
    connecting: { text: '正在连接...', color: '#ffa502', icon: '🔄' },
    connected: { text: '已连接', color: '#26de81', icon: '✓' },
    disconnected: { text: '连接已断开', color: '#ff4757', icon: '✗' },
    reconnecting: { text: '正在重连...', color: '#ff6348', icon: '🔄' }
  };

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#'+ID+'{position:fixed;top:0;left:0;right:0;z-index:9999;padding:8px 16px;text-align:center;font-size:13px;color:#fff;display:none;transition:transform .3s ease,opacity .3s ease;}',
      '#'+ID+'.show{display:block;transform:translateY(0);opacity:1;}',
      '#'+ID+'.hide{transform:translateY(-100%);opacity:0;}',
      '#'+ID+' .icon{margin-right:6px;display:inline-block;animation:qt-spin 1s linear infinite;}',
      '@keyframes qt-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensure(){
    injectStyle();
    var el = document.getElementById(ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = ID;
    document.body.appendChild(el);
    return el;
  }

  function update(state, customText){
    var el = ensure();
    var info = STATES[state] || STATES.connecting;
    el.style.backgroundColor = info.color;
    el.innerHTML = '<span class="icon">' + info.icon + '</span>' + (customText || info.text);
  }

  function show(state, customText){
    update(state, customText);
    var el = document.getElementById(ID);
    if (el) {
      el.classList.add('show');
      el.classList.remove('hide');
    }
  }

  function hide(){
    var el = document.getElementById(ID);
    if (el) {
      el.classList.add('hide');
      el.classList.remove('show');
      setTimeout(function(){ el.style.display = 'none'; }, 300);
    }
  }

  function showConnecting(text){
    show('connecting', text);
  }

  function showConnected(text){
    show('connected', text);
    // 1.5秒后自动隐藏
    setTimeout(hide, 1500);
  }

  function showDisconnected(text){
    show('disconnected', text);
  }

  function showReconnecting(text){
    show('reconnecting', text);
  }

  window.ConnectionIndicatorUI = {
    ensure: ensure,
    update: update,
    show: show,
    hide: hide,
    showConnecting: showConnecting,
    showConnected: showConnected,
    showDisconnected: showDisconnected,
    showReconnecting: showReconnecting
  };
  console.log('✅ connection-indicator UI 已加载');
})();
