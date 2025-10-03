/*
 * WebSocket 自动重连用例 (ws-reconnect.js)
 * - 断线自动重连机制（指数退避、最大重试次数）
 * - 提供 enable/disable/reconnect 接口
 */
// 轻薄代理 → UnifiedWebSocket（保留旧全局名与方法签名）
(function(){
  'use strict';
  function call(name){ try { if (window.UnifiedWebSocket && typeof window.UnifiedWebSocket[name]==='function') return window.UnifiedWebSocket[name].apply(window.UnifiedWebSocket, Array.prototype.slice.call(arguments,1)); } catch(e){ console.warn('WSReconnect proxy error:', name, e);} }
  window.WSReconnect = {
    reconnect: function(){ return call('connect'); },
    reset: function(){ /* no-op: 由 UnifiedWebSocket 内部管理 */ },
    onConnected: function(){ /* no-op */ },
    onDisconnected: function(){ return call('connect'); },
    enable: function(){ /* no-op: 由 UnifiedWebSocket 内部管理 */ },
    disable: function(){ /* no-op */ },
    setConfig: function(opts){ return call('init', opts); }
  };
  console.log('✅ ws-reconnect → 代理 UnifiedWebSocket');
})();
