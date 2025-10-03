/**
 * WebSocket 事件桥 (ws-event-bridge.js)
 * - 集中处理来自 WebSocket 的事件分发，兼容旧版与领域事件
 * - 与 messageModule、未读徽章和页面数据加载协作
 * - 提供全局函数：handleWebSocketMessage, extractMessageFromEnvelope, handleNewMessage, handleShopUpdate
 */
(function(){
  'use strict';

  // 安全调用工具
  function callIf(fn, ...args){
    try { return typeof fn === 'function' ? fn(...args) : undefined; } catch(e){ console.warn('callIf error:', e); }
  }

  // 提取领域事件中的 message/payload
  function extractMessageFromEnvelope(evt){
    if (!evt) return null;
    try {
      const data = evt.data !== undefined ? evt.data : evt; // 兼容 {data:{...}} 与 直接对象
      if (data && typeof data === 'object') {
        if (data.message) return data.message; // 优先 message
        return data; // 否则整个 data
      }
      return evt;
    } catch(e){
      console.warn('extractMessageFromEnvelope 解析失败:', e);
      return evt;
    }
  }

  // 新消息到达的 UI 更新（全局兜底）
  function handleNewMessage(data){
    try {
      const badge = document.getElementById('messagesBadge');
      if (badge) {
        const cur = parseInt(badge.textContent) || 0;
        const next = cur + 1;
        badge.textContent = next > 99 ? '99+' : String(next);
        badge.classList.remove('hidden');
        badge.style.display = 'block';
      }

      if (window.currentPage === 'messages' && typeof window.loadConversations === 'function') {
        window.loadConversations();
      }

      if (typeof window.showToast === 'function') {
        const userName = (data && data.userName) || '客户';
        window.showToast(`收到新消息来自 ${userName}`, 'info');
      }
    } catch(e){ console.warn('handleNewMessage 出错:', e); }
  }

  // 店铺更新（全局兜底）
  function handleShopUpdate(data){
    try {
      if (window.currentPage === 'shops' && typeof window.loadShops === 'function') {
        window.loadShops();
      }
    } catch(e){ console.warn('handleShopUpdate 出错:', e); }
  }

  // 全局事件分发入口（供 app-init 的 ws.onmessage 调用）
  function handleWebSocketMessage(data){
    try {
      const t = data && data.type;
      if (!t) return;

      // 心跳/欢迎
      if (t === 'system.welcome' || t === 'Pong') return;

      // 旧版事件
      if (t === 'new_message' || t === 'message' || data.msg_type === 'message') {
        handleNewMessage(data);
        return;
      }
      if (t === 'shop_update') {
        handleShopUpdate(data);
        return;
      }

      // 新版领域事件
      if (typeof t === 'string' && t.startsWith('domain.event.')) {
        const unwrap = extractMessageFromEnvelope;
        const mm = window.messageModule; // 可能尚未初始化
        if (t === 'domain.event.message_appended') {
          const message = unwrap(data);
          // 先做全局最小 UI 更新
          if (message) {
            // 将 sender 映射为展示名（尽量友好）
            const displayName = message.sender_type === 'agent' ? '管理员' : (message.customer_name || '客户');
            handleNewMessage({ userName: displayName, message });
          }
          // 若 messageModule 已初始化，则委托更细粒度渲染
          if (mm && typeof mm.handleDomainMessageAppended === 'function') {
            mm.handleDomainMessageAppended(message);
          }
          return;
        }
        if (t === 'domain.event.message_updated') {
          const message = unwrap(data);
          if (mm && typeof mm.handleDomainMessageUpdated === 'function') {
            mm.handleDomainMessageUpdated(message);
          }
          return;
        }
        if (t === 'domain.event.message_deleted') {
          const payload = unwrap(data);
          if (mm && typeof mm.handleDomainMessageDeleted === 'function') {
            mm.handleDomainMessageDeleted(payload);
          }
          return;
        }
        // 未覆盖的领域事件，暂忽略
        return;
      }

      // 未知类型，忽略
      // console.debug('未知的 WebSocket 消息类型:', t, data);
    } catch(e){
      console.error('handleWebSocketMessage 处理异常:', e);
    }
  }

  // 暴露到全局
  window.extractMessageFromEnvelope = extractMessageFromEnvelope;
  window.handleNewMessage = handleNewMessage;
  window.handleShopUpdate = handleShopUpdate;
  window.handleWebSocketMessage = handleWebSocketMessage;

  console.log('✅ WebSocket 事件桥已加载 (ws-event-bridge.js)');
})();
