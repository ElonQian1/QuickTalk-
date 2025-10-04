/**
 * message-sender.js
 * 职责：抽象发送流程 (排队 -> 本地暂存 -> REST/WS 发送 -> ACK/失败)
 * 仅关心消息发送，不直接操作 DOM；状态变化通过 MessageStateStore + MessageEventBus 广播。
 * 
 * 事件 (publish):
 *  - send.enqueued { tempMessage }
 *  - send.dispatched { tempMessage }
 *  - send.ack { serverMessage, temp_id }
 *  - send.failed { tempMessage, error, attempt }
 * 
 * 依赖：
 *  - window.MessageEventBus
 *  - window.MessageStateStore
 *  - window.QT_LOG 可选
 *  - window.AuthFetch (REST 发送)
 *  - 可选 wsSend(payload:Object) -> boolean 由初始化参数提供
 */
(function(){
  if (window.MessageSender) return; // 幂等
  const NS = 'messageSend';
  const log = (lvl,...a)=> { if (window.QT_LOG) (QT_LOG[lvl]||QT_LOG.debug)(NS, ...a); };

  const DEFAULT_OPTS = {
    useWebSocketFirst: false,
    maxRetries: 2,
    retryDelayBase: 800, // 退避基础 (ms)
    wsSend: null,        // 函数 (payload)->bool
    conversationResolver: ()=> window.MessageStateStore && window.MessageStateStore.currentConversationId,
  };

  function genTempId(){ return 'tmp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7); }

  class MessageSender {
    constructor(options){
      this.opts = Object.assign({}, DEFAULT_OPTS, options||{});
      this.queue = []; // {temp_id, content, type, attempt, status}
      this.sending = false;
      this._bus = window.MessageEventBus;
      this._store = window.MessageStateStore;
    }

    enqueueText(content){
      return this.enqueue(content, { type:'text' });
    }

    enqueue(content, opts){
      const conversationId = this.opts.conversationResolver();
      if (!conversationId){ log('warn','enqueue: no active conversation'); return null; }
      const type = (opts && opts.type) || 'text';
      const extra = (opts && opts.extra) || {};
      const tempMsg = Object.assign({
        id: null,
        temp_id: genTempId(),
        conversation_id: conversationId,
        content: content,
        sender_type: 'agent',
        status: 'pending',
        created_at: new Date().toISOString(),
        attempt: 0,
        message_type: type
      }, extra);
      this.queue.push(tempMsg);
      if (this._store) this._store.appendMessage(conversationId, tempMsg);
      this._bus.publish('send.enqueued', { tempMessage: tempMsg });
      log('debug','enqueued', type, tempMsg.temp_id, (content||'').slice(0,50));
      this._drain();
      return tempMsg;
    }

    async _drain(){
      if (this.sending) return;
      this.sending = true;
      try {
        while(this.queue.length){
          const item = this.queue[0];
            await this._dispatch(item);
            this.queue.shift();
        }
      } finally { this.sending = false; }
    }

    async _dispatch(item){
      item.attempt++;
      this._bus.publish('send.dispatched', { tempMessage: item });
      let success = false; let serverMsg = null; let lastErr = null;
      try {
        if (this.opts.useWebSocketFirst && typeof this.opts.wsSend === 'function'){
          success = this._sendViaWS(item);
        }
        if (!success){
          serverMsg = await this._sendViaREST(item);
          success = true;
        }
      } catch(e){ lastErr = e; }

      if (success && serverMsg){
        this._acknowledge(item, serverMsg);
        return;
      }
      if (!success){
        const shouldRetry = item.attempt <= this.opts.maxRetries;
        this._bus.publish('send.failed', { tempMessage: item, error: lastErr, attempt: item.attempt, willRetry: shouldRetry });
        log('warn','dispatch failed', item.temp_id, lastErr);
        if (shouldRetry){
          await this._sleep(this.opts.retryDelayBase * item.attempt);
          this.queue.push(item); // requeue tail
        } else {
          // 标记失败
          if (this._store) this._store.updateMessage(item.conversation_id, { temp_id: item.temp_id, status: 'failed', error: (lastErr && lastErr.message)||'发送失败' });
        }
      }
    }

    _sendViaWS(item){
      try {
        if (!this.opts.wsSend) return false;
        const payload = { action: 'send_message', conversation_id: item.conversation_id, content: item.content, temp_id: item.temp_id };
        const ok = this.opts.wsSend(payload);
        return !!ok;
      } catch(e){ log('warn','ws send error', e); return false; }
    }

    async _sendViaREST(item){
      if (!window.AuthFetch) throw new Error('AuthFetch 未加载');
      const body = { conversation_id: item.conversation_id, content: item.content, temp_id: item.temp_id };
      const resp = await window.AuthFetch.safeJsonFetch('/api/messages', { method: 'POST', body: JSON.stringify(body) });
      if (!resp.ok){ throw new Error('HTTP '+resp.status); }
      const data = resp.data || resp.message || resp;
      // 期望 data 为服务端消息结构
      return data;
    }

    _acknowledge(tempItem, serverMsg){
      if (this._store){
        if (!this._store.replaceTemp(tempItem.temp_id, Object.assign({ status: 'sent' }, serverMsg))) {
          // 若无法替换，则直接 append (防重判断可后续增强)
          this._store.appendMessage(tempItem.conversation_id, Object.assign({ status: 'sent' }, serverMsg));
        }
      }
      this._bus.publish('send.ack', { serverMessage: serverMsg, temp_id: tempItem.temp_id });
      log('debug','ack', tempItem.temp_id, serverMsg.id);
    }

    handleServerMessage(serverMsg){
      // 当 WS 推来最终 serverMsg 且有 temp_id，可触发替换
      if (!serverMsg) return;
      if (serverMsg.temp_id){
        if (this._store && this._store.replaceTemp(serverMsg.temp_id, Object.assign({ status: 'sent' }, serverMsg))) {
          this._bus.publish('send.ack', { serverMessage: serverMsg, temp_id: serverMsg.temp_id });
          return true;
        }
      }
      return false;
    }

    _sleep(ms){ return new Promise(r=> setTimeout(r, ms)); }

    // 重试指定失败消息 (通过 temp_id)
    resendFailed(tempId){
      if (!tempId || !this._store) return false;
      const convId = this._store.currentConversationId; // 简化: 仅当前对话
      const list = this._store.getMessages(convId);
      const msg = list.find(m => m.temp_id === tempId && m.status === 'failed');
      if (!msg) return false;
      // 重置状态并重新入队
      msg.status = 'pending';
      msg.error = undefined;
      msg.attempt = 0;
      this.queue.push(msg);
      this._bus.publish('send.requeue', { tempMessage: msg });
      this._drain();
      return true;
    }

    resendAllFailed(){
      if (!this._store) return 0;
      const convId = this._store.currentConversationId;
      const list = this._store.getMessages(convId);
      let count = 0;
      list.filter(m=> m.status === 'failed').forEach(m=>{ this.resendFailed(m.temp_id); count++; });
      return count;
    }
  }

  window.MessageSender = {
    create(opts){ return new MessageSender(opts); }
  };
  log('info','MessageSender 初始化就绪');
})();
