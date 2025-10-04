/**
 * 全局事件常量与发布辅助
 * 分层: core
 * 目的: 去除魔法字符串, 提升可维护性
 * 使用方式:
 *   Events.emit(Events.MESSAGE.SENT, { ... })
 *   document.addEventListener(Events.DOM.UNREAD_UPDATE, handler)
 */
(function(){
  'use strict';

  const BUS_NS = '[Events]';

  const Events = {
    MESSAGE: {
      APPENDED: 'message.appended',          // 新消息加入(本地或服务器回流统一)
      UPDATED: 'message.updated',            // 消息局部属性更新(状态/重试等)
      DELETED: 'message.deleted',
      STATE_CHANGED: 'message.state.changed' // 发送状态阶段迁移
    },
    SEND: {
      QUEUED: 'send.queued',                // 进入发送通道队列
      DISPATCH: 'send.dispatch',            // 真实发出
      ACK_TIMEOUT: 'send.ack.timeout',
      FINALIZED: 'send.finalized',
      FAILED: 'send.failed'
    },
    CONVERSATION: {
      READ_LOCAL: 'conversation.read.local', // 前端判定已读(活动会话+可见)
      READ_SERVER_ACK: 'conversation.read.server_ack'
    },
    UNREAD: {
      UPDATE: 'unread:update',              // 聚合后的总未读 (维持兼容)
      HIGHWATER: 'unread:highwater'
    },
    DOM: {
      WS_MESSAGE_APPENDED: 'ws:domain.event.message_appended'
    }
  };

  // 统一 emit: 尝试优先使用 window.eventBus / MessageEventBus => fallback DOM 自定义事件
  function emit(evt, detail){
    try {
      if (window.eventBus && typeof window.eventBus.emit === 'function') {
        window.eventBus.emit(evt, detail);
      }
    } catch(_){ }
    try {
      document.dispatchEvent(new CustomEvent(evt, { detail }));
    } catch(_){ }
    if (window.QT_LOG && window.QT_LOG.debug) {
      window.QT_LOG.debug(BUS_NS, 'emit', evt, detail);
    }
  }

  // 语义化阶段发布辅助 (供发送通道调用)
  const MessageStates = Object.freeze({
    PENDING: 'pending',
    SENDING: 'sending',
    SENT: 'sent',          // 已收到服务端回流匹配
    FAILED: 'failed',
    CANCELED: 'canceled'
  });

  const EventsAPI = { Events, emit, MessageStates };
  window.Events = EventsAPI;
  if (window.registerModule) window.registerModule('Events', EventsAPI);
  console.log('✅ events.js 已加载 (全局事件常量)');
})();
