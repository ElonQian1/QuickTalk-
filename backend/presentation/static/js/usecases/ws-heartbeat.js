/*
 * WebSocket 心跳保活用例 (ws-heartbeat.js)
 * - 定时发送 ping，超时检测，触发重连
 * - 提供 start/stop/ping 接口
 */
// 轻薄代理 → UnifiedWebSocket（保留旧全局名与方法签名）
(function(){
  'use strict';
  function call(name){ try { if (window.UnifiedWebSocket && typeof window.UnifiedWebSocket[name]==='function') return window.UnifiedWebSocket[name].apply(window.UnifiedWebSocket, Array.prototype.slice.call(arguments,1)); } catch(e){ console.warn('WSHeartbeat proxy error:', name, e);} }
  window.WSHeartbeat = {
    ping: function(){ return call('send', { type: 'ping' }); },
    onPong: function(){ /* no-op: UnifiedWebSocket 内部处理 */ },
    start: function(){ /* no-op: UnifiedWebSocket 默认开启内部心跳 */ },
    stop: function(){ /* no-op: 由 UnifiedWebSocket 内部 stopHeartbeat */ },
    enable: function(){ /* no-op */ },
    disable: function(){ /* no-op */ },
    setConfig: function(opts){ return call('init', { heartbeatInterval: opts && opts.interval, heartbeatTimeout: opts && opts.timeout }); }
  };
  console.log('✅ ws-heartbeat → 代理 UnifiedWebSocket');
})();
