/**
 * WebSocket 事件桥 (ws-event-bridge.js)
 * - 集中处理来自 WebSocket 的事件分发，兼容旧版与领域事件
 * - 与 messageModule、未读徽章和页面数据加载协作
 * - 提供全局函数：handleWebSocketMessage, extractMessageFromEnvelope, handleNewMessage, handleShopUpdate
 */
(function(){
  'use strict';

  // 兜底 toast 实现：若全局没有 showToast 则动态注入一个极简版本
  (function ensureFallbackToast(){
    if (typeof window.showToast === 'function') return; // 已存在
    const containerId = '__qt_fallback_toast_container__';
    function createContainer(){
      let c = document.getElementById(containerId);
      if (!c){
        c = document.createElement('div');
        c.id = containerId;
        c.style.cssText = 'position:fixed;left:50%;top:12px;z-index:9999;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;';
        document.body.appendChild(c);
      }
      return c;
    }
    window.showToast = function(msg,type='info',timeout=2800){
      try {
        const c = createContainer();
        const item = document.createElement('div');
        item.textContent = msg;
        const color = type==='error'?'#fff':'#fff';
        const bg = type==='error'?'#e74c3c': type==='success'? '#2ecc71': '#3498db';
        item.style.cssText = 'font:14px/1.4 system-ui,Arial;opacity:0;transition:opacity .25s,transform .25s;padding:10px 14px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.15);background:'+bg+';color:'+color+';transform:translateY(-6px);max-width:240px;word-break:break-all;';
        c.appendChild(item);
        requestAnimationFrame(()=>{ item.style.opacity='1'; item.style.transform='translateY(0)'; });
        setTimeout(()=>{ item.style.opacity='0'; item.style.transform='translateY(-4px)'; setTimeout(()=> item.remove(), 260); }, timeout);
      } catch(e){ console.warn('[fallback-toast] 显示失败', e); }
    };
    console.log('ℹ️ 已注入 fallback showToast (ws-event-bridge)');
  })();

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
      // 统一标准化
      if (window.MessageNormalizer && window.MessageNormalizer.normalizeIncoming) {
        window.MessageNormalizer.normalizeIncoming(data);
      }
      window.__QT_CHAT_DEBUG = window.__QT_CHAT_DEBUG || { messages: [], push(m){ this.messages.push(m); if(this.messages.length>50) this.messages.shift(); } };
      try { window.__QT_CHAT_DEBUG.push({ dir:'in', at:Date.now(), msg: (data && (data.message||data)) }); } catch(_){}
      // 优先委托 NavBadgeManager，避免直接 DOM 改写
      let updated = false;
      const nbm = window.navBadgeManager;
      if (nbm && typeof nbm.getBadgeCount === 'function' && typeof nbm.updateNavBadge === 'function') {
        const cur = nbm.getBadgeCount('messages') || 0;
        nbm.updateNavBadge('messages', cur + 1);
        updated = true;
      }
      // 兜底：直接更新 DOM（保持兼容旧路径）
      if (!updated) {
        const badge = document.getElementById('messagesBadge');
        if (badge) {
          const cur = parseInt(badge.textContent) || 0;
          const next = cur + 1;
          badge.textContent = next > 99 ? '99+' : String(next);
          badge.classList.remove('hidden');
          badge.style.display = 'block';
        }
      }

      // === 新增：店铺未读红点实时更新逻辑 (仅客户消息) ===
      try {
        const msg = data && (data.message || data);
        const senderType = msg && (msg.sender_type || msg.senderType || msg.sender);
        if (window.MessageNormalizer && window.MessageNormalizer.normalizeSenderType) {
          const norm = window.MessageNormalizer.normalizeSenderType(senderType);
          if (norm) msg.sender_type = norm; // 覆盖为标准化
        }
        const shopId = msg && (msg.shop_id || msg.shopId);
        const conversationId = msg && (msg.conversation_id || msg.conversationId);
        const isCustomerMsg = (msg && msg.sender_type === 'customer');
        // 当前打开的会话（可能由其它模块维护）
        const activeConv = window.currentConversationId || (window.ActiveConversation && window.ActiveConversation.id);
        const inActiveConversation = activeConv && conversationId && String(activeConv) === String(conversationId);
        if (isCustomerMsg && shopId && !inActiveConversation) {
          // 1. 优先通过 shopCardManager 累加
            let applied = false;
            const scm = window.shopCardManager;
            if (scm && typeof scm.incrementUnread === 'function') {
              try { scm.incrementUnread(shopId, 1); applied = true; } catch(e){ console.warn('[ws-event-bridge] incrementUnread 调用失败', e); }
            }
            // 2. 如果没有专用方法，尝试直接查找 DOM 并更新
            if (!applied) {
              const card = document.querySelector(`.shop-card[data-shop-id="${shopId}"]`);
              if (card) {
                const span = card.querySelector('.unread-count');
                if (span) {
                  const cur = parseInt(span.getAttribute('data-unread')) || 0;
                  const next = cur + 1;
                  span.setAttribute('data-unread', next);
                  span.textContent = `(${next})`;
                  span.style.display = 'inline';
                  applied = true;
                }
              }
            }
            // 3. 若存在 updateShopBadgeDisplay 辅助函数（保持一致性）
            if (!applied && typeof window.updateShopBadgeDisplay === 'function') {
              try {
                const card = document.querySelector(`.shop-card[data-shop-id="${shopId}"]`);
                if (card) window.updateShopBadgeDisplay(card, (card.querySelector('.unread-count')?.getAttribute('data-unread')||1));
              } catch(e){ console.warn('[ws-event-bridge] updateShopBadgeDisplay 调用失败', e); }
            }
            // 4. 触发聚合事件（供 nav-unread-aggregator/nav-badge-manager 汇总）
            try {
              const totalUnread = (function(){
                // 汇总所有 .shop-card 上的 data-unread
                let sum = 0; document.querySelectorAll('.shop-card .unread-count[data-unread]').forEach(el=>{ const v = parseInt(el.getAttribute('data-unread'))||0; sum += v; });
                return sum;
              })();
              document.dispatchEvent(new CustomEvent('unread:update', { detail:{ total: totalUnread, reason:'incoming-message', shopId, conversationId }}));
            } catch(e){ console.warn('[ws-event-bridge] 触发 unread:update 事件失败', e); }
        }
      } catch(e){ console.warn('[ws-event-bridge] 店铺未读实时更新逻辑异常', e); }
      // === 结束新增逻辑 ===

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
      // 优先把原始消息给统一数据同步管理器处理（集中刷新/队列）
      try {
        if (window.unifiedDataSyncManager && typeof window.unifiedDataSyncManager.handleWsMessage === 'function') {
          window.unifiedDataSyncManager.handleWsMessage(data);
        }
      } catch(_) {}

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

  // 与 UnifiedWebSocket 集成：注册消息监听（不影响原有全局入口）
  try {
    if (window.UnifiedWebSocket && typeof window.UnifiedWebSocket.onMessage === 'function') {
      window.UnifiedWebSocket.onMessage(handleWebSocketMessage);
    }
  } catch(_){}

  console.log('✅ WebSocket 事件桥已加载 (ws-event-bridge.js)');
})();
