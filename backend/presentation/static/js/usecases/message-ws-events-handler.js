(function(){
  'use strict';
  if (window.MessageWSEventsHandler) return;
  /**
   * MessageWSEventsHandler - 仅负责解析并分发 WebSocket 收到的消息
   * 目标: 精简 Orchestrator (message-module.js) 逻辑，使其只做依赖协调
   * Orchestrator 需要注入: { onDomainAppend, onDomainUpdate, onDomainDelete, onLegacyMessage, refreshConversations }
   */
  class MessageWSEventsHandler {
    constructor(opts){
      this._o = Object.assign({ debug:false }, opts||{});
    }
    route(raw){
      if (!raw || !raw.type){ return; }
      const t = raw.type;
      // 领域事件
      if (t.startsWith('domain.event.')){
        if (t.endsWith('message_appended')){
            this._o.onDomainAppend && this._o.onDomainAppend(this._unwrap(raw));
            return;
        }
        if (t.endsWith('message_updated')){
            this._o.onDomainUpdate && this._o.onDomainUpdate(this._unwrap(raw));
            return;
        }
        if (t.endsWith('message_deleted')){
            this._o.onDomainDelete && this._o.onDomainDelete(this._unwrap(raw));
            return;
        }
      }
      // 传统消息事件
      if (t === 'message' || raw.msg_type === 'message'){
        this._o.onLegacyMessage && this._o.onLegacyMessage(raw);
        return;
      }
      if (t === 'typing'){
        this._o.onTyping && this._o.onTyping(raw);
        return;
      }
      if (t === 'conversation_update'){
        this._o.refreshConversations && this._o.refreshConversations();
        return;
      }
    }
    _unwrap(evt){
      if (!evt) return null;
      if (evt.data && evt.data.message) return evt.data.message;
      if (evt.data) return evt.data;
      return evt;
    }
  }
  window.MessageWSEventsHandler = { create: (o)=> new MessageWSEventsHandler(o) };
  console.log('✅ message-ws-events-handler.js 已加载');
})();
