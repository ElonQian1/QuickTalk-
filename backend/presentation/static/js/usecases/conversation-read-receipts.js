/**
 * conversation-read-receipts.js
 * 骨架: 监听本地会话已读事件, 预留调用后端 read API 位点
 * 当前: 不发起网络, 仅发布一个本地 ack 事件, 供后续 UI / 状态联动
 */
(function(){
  'use strict';
  if (window.ConversationReadReceipts) return;

  class ConversationReadReceipts {
    constructor(opts){
      this.opts = { debug:false, ...opts };
      this._bind();
      if (this.opts.debug) console.log('[ConversationReadReceipts] init');
    }

    _bind(){
      const evtName = (window.Events && window.Events.Events.CONVERSATION.READ_LOCAL) || 'conversation.read.local';
      document.addEventListener(evtName, (e)=> this._onLocalRead(e.detail));
    }

    async _onLocalRead(detail){
      if (!detail || !detail.conversation_id) return;
      const convId = detail.conversation_id;
      if (this.opts.debug) console.log('[ConversationReadReceipts] local read', convId);
      // TODO: 未来实现: POST /api/conversations/:id/read
      // try { await fetch(`/api/conversations/${convId}/read`, { method:'POST' }); } catch(e){ console.warn('read api fail', e); }
      // 发布 ACK 事件
      try {
        if (window.Events) window.Events.emit(window.Events.Events.CONVERSATION.READ_SERVER_ACK, { conversation_id: convId, at: Date.now(), local: true });
        else document.dispatchEvent(new CustomEvent('conversation.read.server_ack',{ detail:{ conversation_id: convId, at: Date.now(), local:true }}));
      } catch(_){ }
    }
  }

  window.ConversationReadReceipts = ConversationReadReceipts;
  if (window.registerModule) window.registerModule('ConversationReadReceipts', ConversationReadReceipts);
  console.log('✅ conversation-read-receipts.js 已加载 (骨架)');
})();
