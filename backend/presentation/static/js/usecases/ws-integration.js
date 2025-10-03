/*
 * WebSocket 增强集成桥接 (ws-integration.js)
 * - 集成连接状态 UI、自动重连、心跳保活
 * - 提供 enhanceWebSocket 接口，装饰原生 WebSocket 实例
 */
// 轻薄代理 → UnifiedWebSocket（保留旧全局名与行为）
(function(){
  'use strict';
  function ensure(){ try { if (window.UnifiedWebSocket && typeof window.UnifiedWebSocket.connect==='function') window.UnifiedWebSocket.connect(); } catch(_){} }
  function enhanceWebSocket(){ /* no-op：UnifiedWebSocket 内部已包装 on* 事件 */ }
  function autoEnhance(){ ensure(); }
  window.WSIntegration = { enhanceWebSocket: enhanceWebSocket, autoEnhance: autoEnhance };
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', autoEnhance); } else { autoEnhance(); }
  console.log('✅ ws-integration → 代理 UnifiedWebSocket');
})();
