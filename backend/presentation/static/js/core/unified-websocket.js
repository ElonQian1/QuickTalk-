(function(){
  'use strict';

  if (window.UnifiedWebSocket) {
    console.log('ℹ️ UnifiedWebSocket already loaded, skip');
    return;
  }

  var cfg = {
    url: null,
    maxRetries: 6,
    baseDelay: 1000,
    maxDelay: 30000,
    retryCount: 0,
    heartbeatInterval: 30000,
    heartbeatTimeout: 10000,
    enableHeartbeat: true
  };

  var state = {
    ws: null,
    timers: { reconnect: null, ping: null, pong: null },
    connected: false,
    manualClose: false,
    messageHandlers: []
  };

  function setIndicator(connected, text){
    try {
      if (window.updateConnectionStatus) window.updateConnectionStatus(connected);
      if (window.ConnectionIndicatorUI){
        if (connected && typeof window.ConnectionIndicatorUI.showConnected==='function') window.ConnectionIndicatorUI.showConnected(text||'连接成功');
        if (!connected && typeof window.ConnectionIndicatorUI.showDisconnected==='function') window.ConnectionIndicatorUI.showDisconnected(text||'已断开');
      }
    } catch(_){}
  }

  function clearTimer(name){ if (state.timers[name]) { clearTimeout(state.timers[name]); clearInterval(state.timers[name]); state.timers[name]=null; } }

  function backoffDelay(){ return Math.min(cfg.baseDelay * Math.pow(2, cfg.retryCount), cfg.maxDelay); }

  function startHeartbeat(){
    if (!cfg.enableHeartbeat) return;
    clearTimer('ping'); clearTimer('pong');
    state.timers.ping = setInterval(function(){
      try {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
        state.ws.send(JSON.stringify({ type: 'ping' }));
        clearTimer('pong');
        state.timers.pong = setTimeout(function(){
          console.warn('Heartbeat pong timeout, trigger reconnect');
          reconnect();
        }, cfg.heartbeatTimeout);
      } catch(e){ console.warn('ping send failed', e); }
    }, cfg.heartbeatInterval);
  }

  function stopHeartbeat(){ clearTimer('ping'); clearTimer('pong'); }

  function onOpen(){
    state.connected = true; cfg.retryCount = 0; setIndicator(true, '已连接'); stopHeartbeat(); startHeartbeat();
    if (window.WSReconnect && typeof window.WSReconnect.onConnected==='function') { try { window.WSReconnect.onConnected(); } catch(_){} }
  }

  function onClose(evt){
    state.connected = false; setIndicator(false, '已断开'); stopHeartbeat();
    if (window.WSHeartbeat && typeof window.WSHeartbeat.stop==='function'){ try { window.WSHeartbeat.stop(); } catch(_){} }
    if (window.WSReconnect && typeof window.WSReconnect.onDisconnected==='function') { try { window.WSReconnect.onDisconnected(); } catch(_){} }
    if (!state.manualClose) reconnect();
  }

  function onError(evt){
    console.error('WebSocket error', evt);
    setIndicator(false, '连接出错');
  }

  function dispatchMessage(raw){
    var data = raw;
    try { if (typeof raw === 'string') data = JSON.parse(raw); } catch(_){}
    // Heartbeat pong
    if (data && (data.type === 'pong' || data.type === 'Pong')) { clearTimer('pong'); return; }
    // 事件桥（旧/新）
    try { if (typeof window.handleWebSocketMessage === 'function') window.handleWebSocketMessage(data); } catch(e){ console.warn('handleWebSocketMessage failed', e); }
    // 广播给监听者
    try {
      state.messageHandlers.forEach(function(h){ try { h(data); } catch(_){} });
      // 兼容 RealtimeDataManager：派发自定义事件
      window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));
    } catch(_){}
  }

  function reconnect(){
    if (state.connected || state.manualClose) return; // 已连或手动关闭不重连
    if (cfg.retryCount >= cfg.maxRetries){ console.warn('达到最大重连次数，停止'); return; }
    var delay = backoffDelay(); cfg.retryCount++;
    clearTimer('reconnect');
    if (window.ConnectionIndicatorUI && typeof window.ConnectionIndicatorUI.showReconnecting==='function'){
      try { window.ConnectionIndicatorUI.showReconnecting('正在重连... ('+cfg.retryCount+'/'+cfg.maxRetries+')'); } catch(_){}
    }
    state.timers.reconnect = setTimeout(function(){ connect(); }, delay);
  }

  function connect(){
    try {
      var proto = (location.protocol === 'https:') ? 'wss:' : 'ws:';
      var url = cfg.url || (proto+'//'+location.host+'/ws');
      if (state.ws){ try { state.ws.onopen = state.ws.onclose = state.ws.onerror = state.ws.onmessage = null; state.ws.close(); } catch(_){} }
      state.manualClose = false;
      var ws = new WebSocket(url);
      state.ws = ws; window.ws = ws; // 兼容旧代码
      ws.onopen = onOpen;
      ws.onclose = onClose;
      ws.onerror = onError;
      ws.onmessage = function(evt){ dispatchMessage(evt && evt.data || evt); };
    } catch(e){ console.warn('connect failed', e); reconnect(); }
  }

  function disconnect(){ state.manualClose = true; stopHeartbeat(); clearTimer('reconnect'); if (state.ws){ try { state.ws.close(); } catch(_){} } }
  function isConnected(){ return !!(state.ws && state.ws.readyState === WebSocket.OPEN); }
  function send(payload){
    try {
      if (!isConnected()) return false;
      var s = (typeof payload === 'string') ? payload : JSON.stringify(payload);
      state.ws.send(s); return true;
    } catch(e){ console.warn('send failed', e); return false; }
  }
  function onMessage(handler){ if (typeof handler==='function') state.messageHandlers.push(handler); return function off(){ var i=state.messageHandlers.indexOf(handler); if (i>=0) state.messageHandlers.splice(i,1); } }

  function init(options){ options = options || {}; Object.assign(cfg, options||{}); return api; }

  var api = { init: init, connect: connect, disconnect: disconnect, send: send, isConnected: isConnected, onMessage: onMessage };
  window.UnifiedWebSocket = api;
  if (window.ModuleRegistry){ try { window.ModuleRegistry.register('UnifiedWebSocket', function(){ return api; }, []); } catch(_){} }
  if (window.ModuleLoader && window.ModuleLoader.defineClass){ try { window.ModuleLoader.defineClass('UnifiedWebSocket', function(){ return api; }); } catch(_){} }
  console.log('✅ 统一 WebSocket 模块已加载 (unified-websocket.js)');
})();
