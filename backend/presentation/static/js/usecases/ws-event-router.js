/* ws-event-router.js
 * 目的：集中管理 WebSocket 事件 -> 处理函数映射，避免在 message-module.js 内部出现长 if 链
 * 设计原则：
 *  - 最小侵入：不改变现有处理函数签名
 *  - 幂等 & 安全：未知事件忽略，兼容旧版与新版领域事件
 *  - 可扩展：新增事件只需在 EVENT_MAP / DOMAIN_EVENT_MAP 中登记
 */
(function(){
  'use strict';

  if (window.WsEventRouter) return; // 幂等

  const NOOP = function(){};
  // 简单去重缓存：记录最近处理的消息 (id or hash)
  const recentMessages = [];
  const RECENT_LIMIT = 50;
  function pushRecent(key){
    recentMessages.push(key);
    if (recentMessages.length > RECENT_LIMIT) recentMessages.shift();
  }
  function seen(key){ return recentMessages.includes(key); }

  // 旧版事件与通用事件（平铺）
  const EVENT_MAP = {
    'message': (ctx, data) => ctx.handleNewMessage && ctx.handleNewMessage(data),
    'typing': (ctx, data) => ctx.handleTypingIndicator && ctx.handleTypingIndicator(data),
    'conversation_update': (ctx) => {
      if (ctx.currentShopId && ctx.loadConversationsForShop) ctx.loadConversationsForShop(ctx.currentShopId);
    },
    'system.welcome': NOOP,
    'Pong': NOOP,
  };

  // 领域事件映射 (domain.event.*)
  const DOMAIN_EVENT_MAP = {
    'message_appended': (ctx, payload) => {
      // 先交给通道做回流覆盖（若存在）
      try {
        if (window.MessageSendChannelInstance && typeof window.MessageSendChannelInstance.markServerMessage === 'function') {
          window.MessageSendChannelInstance.markServerMessage(payload);
        }
      } catch(e){ console.warn('[WsEventRouter] sendChannel 回流覆盖失败', e); }
      // 再委托到上下文管理器
      ctx.handleDomainMessageAppended && ctx.handleDomainMessageAppended(payload);
      // 广播一个可订阅的 DOM 事件 (供 unread-badge-aggregator / 其他模块使用) —— 若 aggregator 已监听同名事件将增量自增
      try {
        if (window.__QT_DEBUG_WS || (window.QT_CONFIG && window.QT_CONFIG.debug && window.QT_CONFIG.debug.wsEvents)) {
          console.log('[WsEventRouter] 🔔 dispatch ws:domain.event.message_appended', payload);
        }
        document.dispatchEvent(new CustomEvent('ws:domain.event.message_appended', { detail: { message: (payload && (payload.message||payload)) } }));
      } catch(evtErr){ console.warn('[WsEventRouter] 分发 DOM 事件失败', evtErr); }
    },
    'message_updated' : (ctx, payload) => ctx.handleDomainMessageUpdated && ctx.handleDomainMessageUpdated(payload),
    'message_deleted' : (ctx, payload) => ctx.handleDomainMessageDeleted && ctx.handleDomainMessageDeleted(payload),
  };

  function unwrap(evt){
    if (!evt) return null;
    if (evt.data){
      if (evt.data.message) return evt.data.message; // { data: { message: {...} } }
      return evt.data; // { data: {...} }
    }
    return evt; // 直接是 payload
  }

  function isDomainEvent(type){
    return type.startsWith('domain.event.');
  }

  function route(ctx, raw){
    if (!raw || typeof raw !== 'object') return;
    const type = raw.type;
    if (!type) return;

    // 领域事件
    if (isDomainEvent(type)) {
      const key = type.replace('domain.event.', '');
      const handler = DOMAIN_EVENT_MAP[key];
      if (handler) {
        try {
          const unwrapped = unwrap(raw);
          if (window.MessageNormalizer && window.MessageNormalizer.normalizeIncoming) {
            window.MessageNormalizer.normalizeIncoming(unwrapped);
          }
          handler(ctx, unwrapped);
        } catch(e){ console.error('[WsEventRouter] 领域事件处理失败', type, e); }
      } else {
        // 未登记的领域事件，静默忽略
      }
      return;
    }

    // 常规事件
    const handler = EVENT_MAP[type] || (raw.msg_type ? EVENT_MAP[raw.msg_type] : null);
    if (handler) {
      // 对 message / domain message_appended 做重复判定
      if (type === 'message' || raw.msg_type === 'message') {
        const mid = raw.id || (raw.data && raw.data.id) || (raw.data && raw.data.message && raw.data.message.id) || null;
        const hash = mid || (raw.conversation_id + '|' + (raw.content||'').slice(0,50) + '|' + (raw.timestamp||raw.sent_at||raw.created_at||''));
        if (hash && seen(hash)) return; // 忽略重复
        pushRecent(hash);
        // 普通 message 事件（非领域包装）也尝试回流覆盖
        try {
          if (window.MessageSendChannelInstance && typeof window.MessageSendChannelInstance.markServerMessage === 'function') {
            window.MessageSendChannelInstance.markServerMessage(raw);
          }
        } catch(e){ console.warn('[WsEventRouter] sendChannel 普通消息回流覆盖失败', e); }
      }
      try {
        if (window.MessageNormalizer && window.MessageNormalizer.normalizeIncoming) {
          window.MessageNormalizer.normalizeIncoming(raw);
        }
        handler(ctx, raw);
      } catch(e){ console.error('[WsEventRouter] 事件处理失败', type, e); }
    }
  }

  window.WsEventRouter = { route, EVENT_MAP, DOMAIN_EVENT_MAP };
  console.log('✅ ws-event-router.js 已加载');
})();
