/**
 * MessageSendChannel - 统一消息发送通道 (小步3 初始骨架)
 * 目的：统一文本/文件/语音发送路径，提供队列、重试、回流覆盖能力。
 * 当前阶段：
 *  - 提供基础状态机 (pending -> sending -> sent/failed)
 *  - 支持 sendText / sendFile / sendVoice 接口（文件/语音内部上传留空钩子）
 *  - 提供 retry / cancel / markServerMessage / getQueueSnapshot
 *  - 不强制替换现有 MessagesManager 逻辑，只供其优先调用
 *  - 允许后端忽略 temp_id；若忽略则使用指纹匹配
 *
 * 后续扩展：
 *  - ack 超时自动失败
 *  - 优先级/并发调度
 *  - 发送前过滤/富文本/模板消息
 */
(function(){
  'use strict';

  const DEFAULTS = {
    maxRetries: 3,
    baseRetryDelayMs: 800,
    fingerprint: draft => {
      const c = (draft.payload.content || '').slice(0,32);
      return `${draft.conversation_id}|${draft.type}|${c}|${draft.createdAt}`;
    },
    now: () => Date.now(),
    debug: false
  };

  class MessageSendChannel {
    constructor(opts){
      this.opts = { ...DEFAULTS, ...opts };
      this.queue = []; // 所有 queueItem
      this._sending = false; // 调度锁
      this._bus = window.MessageEventBus || null;
      this._events = (window.Events && window.Events.Events) ? window.Events : null;
    }

    static init(options){
      if (window.MessageSendChannelInstance) return window.MessageSendChannelInstance;
      window.MessageSendChannelInstance = new MessageSendChannel(options||{});
      if (window.MessageSendChannelInstance.opts.debug) console.log('[MessageSendChannel] 初始化');
      return window.MessageSendChannelInstance;
    }

    // --- 对外 API ---
    sendText(content){
      const conversationId = this._resolveConversation();
      if (!conversationId || !content || !content.trim()) return null;
      const draft = this._buildDraft({ type:'text', conversation_id: conversationId, payload:{ content: content.trim() } });
      this._enqueue(draft);
      this._schedule();
      return draft.tempId;
    }

    async sendFile(file){
      const conversationId = this._resolveConversation();
      if (!conversationId || !file) return null;
      const draft = this._buildDraft({ type:'file', conversation_id: conversationId, payload:{ fileMeta:{ name:file.name, size:file.size, mime_type:file.type } } });
      this._enqueue(draft);
      // 上传在真正发送前执行
      draft._preSend = async ()=> {
        if (typeof this.opts.uploadFile === 'function') {
          const meta = await this.opts.uploadFile(file);
            draft.payload.fileMeta = { ...draft.payload.fileMeta, ...meta };
        } else {
          throw new Error('uploadFile 未注入');
        }
      };
      this._schedule();
      return draft.tempId;
    }

    async sendVoice(blob, durationMs){
      const conversationId = this._resolveConversation();
      if (!conversationId || !blob) return null;
      const draft = this._buildDraft({ type:'voice', conversation_id: conversationId, payload:{ voiceMeta:{ durationMs, size: blob.size || 0 } } });
      this._enqueue(draft);
      draft._preSend = async ()=> {
        if (typeof this.opts.uploadFile === 'function') {
          const meta = await this.opts.uploadFile(blob);
          draft.payload.voiceMeta = { ...draft.payload.voiceMeta, ...meta };
        } else {
          throw new Error('uploadFile 未注入');
        }
      };
      this._schedule();
      return draft.tempId;
    }

    retry(tempId){
      const item = this.queue.find(q=> q.tempId === tempId && (q.state==='failed' || q.state==='canceled'));
      if (!item) return false;
      item.state = 'pending';
      item.error = null;
      if (this.opts.onLocalPatch) this.opts.onLocalPatch(tempId,{ state:'pending', error:null });
      if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
      this._schedule();
      return true;
    }

    cancel(tempId){
      const item = this.queue.find(q=> q.tempId === tempId && (q.state==='pending' || q.state==='sending'));
      if (!item) return false;
      item.state = 'canceled';
      if (this.opts.onLocalPatch) this.opts.onLocalPatch(tempId,{ state:'canceled' });
      if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
      return true;
    }

    resendFailed(tempId){
      const item = this.queue.find(q=> q.tempId === tempId && item.state==='failed');
      return this.retry(tempId);
    }

    markServerMessage(serverMsg){
      if (!serverMsg || !serverMsg.conversation_id) return;
      // 直接 temp_id 匹配
      if (serverMsg.temp_id){
        const byTemp = this.queue.find(q=> q.tempId === serverMsg.temp_id);
        if (byTemp) return this._finalize(byTemp, serverMsg);
      }
      // 指纹匹配（仅 agent 自己发的）
      const fp = this._buildServerFingerprint(serverMsg);
      const candidate = this.queue.find(q=> q.state!=='sent' && q.fingerprint && q.fingerprint === fp);
      if (candidate) return this._finalize(candidate, serverMsg);
    }

    getQueueSnapshot(){
      return this.queue.map(q=> ({ tempId:q.tempId, state:q.state, attempt:q.attempt, type:q.type }));
    }

    // --- 内部：构建草稿 ---
    _buildDraft({ type, conversation_id, payload }){
      const tempId = 'tmp_' + (Math.random().toString(36).slice(2));
      const createdAt = this.opts.now();
      const draft = {
        tempId,
        conversation_id,
        type,
        payload: payload || {},
        state: 'pending',
        attempt: 0,
        maxRetries: this.opts.maxRetries,
        createdAt,
        lastAttemptAt: null,
        fingerprint: null,
        error: null,
        ackTimer: null
      };
      draft.fingerprint = (typeof this.opts.fingerprint === 'function') ? this.opts.fingerprint(draft) : DEFAULTS.fingerprint(draft);
      if (this.opts.onLocalEnqueue) {
        const localMsg = this._draftToLocalMessage(draft);
        this.opts.onLocalEnqueue(localMsg);
      }
      // 发布队列进入事件
      try { this._emitEvt('SEND.QUEUED', { tempId, draft }); } catch(_){}
      return draft;
    }

    _draftToLocalMessage(draft){
      // 与现有消息结构对齐（pending 乐观）
      return {
        id: null,
        temp_id: draft.tempId,
        conversation_id: draft.conversation_id,
        content: draft.type==='text' ? draft.payload.content : (draft.type==='file' ? (draft.payload.fileMeta?.name||'文件') : '语音消息'),
        files: draft.type==='file' ? [{ ...(draft.payload.fileMeta||{}) }] : [],
        voice: draft.type==='voice' ? { ...(draft.payload.voiceMeta||{}) } : null,
        sender_type: 'agent',
        timestamp: draft.createdAt,
        status: 'pending',
        _channelType: draft.type
      };
    }

    _enqueue(draft){
      this.queue.push(draft);
      if (this.opts.debug) console.log('[MessageSendChannel] enqueue', draft.tempId, draft.type);
    }

    _schedule(){
      if (this._sending) return;
      // 查找第一个 pending
      const next = this.queue.find(q=> q.state==='pending');
      if (!next) return; // 无待发送
      this._process(next);
    }

    async _process(item){
      this._sending = true;
      if (item.state!=='pending') { this._sending=false; return; }
      item.state = 'sending';
      item.attempt += 1;
      item.lastAttemptAt = this.opts.now();
      if (this.opts.onLocalPatch) this.opts.onLocalPatch(item.tempId,{ state:'sending', attempt:item.attempt });
  if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
    this._emitState(item, 'sending');
    this._emitEvt('SEND.DISPATCH', { tempId: item.tempId, attempt: item.attempt });

      try {
        // 预处理（上传文件/语音）
        if (typeof item._preSend === 'function') {
          await item._preSend();
        }
        // 构造发送 payload
        const payload = this._buildOutboundPayload(item);
        const ok = await this._sendOutbound(payload);
        if (!ok) throw new Error('WS_NOT_READY');
        // 等待服务器回流覆盖 -> 这里不立即标记 sent
        // 启动 ACK 超时定时器
        this._startAckTimer(item);
      } catch (err){
        if (this.opts.debug) console.warn('[MessageSendChannel] 发送失败', item.tempId, err.message);
        this._handleSendFailure(item, err.message || 'SEND_FAIL');
      } finally {
        this._sending = false;
        // 继续调度
        setTimeout(()=> this._schedule(), 0);
      }
    }

    _buildOutboundPayload(item){
      const base = {
        conversation_id: item.conversation_id,
        sender_type: this._resolveSenderType(),
        sender_id: this._resolveSenderId(),
        message_type: 'text',
        temp_id: item.tempId
      };
      
      if (item.type === 'text') {
        base.content = item.payload.content;
      }
      if (item.type === 'file') {
        base.content = item.payload.fileMeta?.name || '文件';
        base.message_type = 'file';
        base.files = [{ ...(item.payload.fileMeta||{}) }];
      }
      if (item.type === 'voice') {
        base.content = '语音消息';
        base.message_type = 'voice';
        base.voice = { ...(item.payload.voiceMeta||{}) };
      }
      
      return base;
    }

    _resolveSenderType(){
      // 统一从当前用户上下文推断，默认 agent
      let raw = 'agent';
      try {
        if (window.currentUser && (window.currentUser.role || window.currentUser.type)) {
          raw = window.currentUser.role || window.currentUser.type;
        } else if (localStorage.getItem('quicktalk_role')) {
          raw = localStorage.getItem('quicktalk_role');
        }
      } catch(_){ }
      if (window.MessageNormalizer && window.MessageNormalizer.normalizeSenderType) {
        return window.MessageNormalizer.normalizeSenderType(raw);
      }
      return 'agent';
    }

    _resolveSenderId(){
      try {
        if (window.currentUser && window.currentUser.id) return window.currentUser.id;
        if (localStorage.getItem('quicktalk_user_id')) return localStorage.getItem('quicktalk_user_id');
      } catch(_){ }
      return 'admin';
    }

    async _sendOutbound(payload){
      // 使用API发送而不是WebSocket，确保消息通过后端UseCase处理
      try {
        const response = await fetch(`/api/conversations/${payload.conversation_id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._getAuthToken()}`,
            'X-Session-Id': this._getSessionId()
          },
          body: JSON.stringify({
            conversation_id: payload.conversation_id,
            content: payload.content || '',
            sender_type: payload.sender_type || 'agent',
            sender_id: payload.sender_id || 'admin',
            message_type: payload.message_type || 'text',
            temp_id: payload.temp_id
          })
        });

        if (!response.ok) {
          console.error('[MessageSendChannel] API发送失败:', response.status, response.statusText);
          return false;
        }

        const result = await response.json();
        if (!result.success) {
          console.error('[MessageSendChannel] API返回失败:', result.message);
          return false;
        }

        if (this.opts.debug) console.log('[MessageSendChannel] API发送成功:', result.data);
        return true;
      } catch (error) {
        console.error('[MessageSendChannel] API发送异常:', error);
        return false;
      }
    }

    _getAuthToken() {
      // 获取认证令牌
      if (window.authHelper && typeof window.authHelper.getAuthToken === 'function') {
        return window.authHelper.getAuthToken();
      }
      // 回退到其他方式
      return localStorage.getItem('quicktalk_token') || 
             localStorage.getItem('authToken') || 
             sessionStorage.getItem('quicktalk_token') || 
             'dummy-token';
    }

    _getSessionId() {
      // 获取会话ID
      if (window.authHelper && typeof window.authHelper.getSessionId === 'function') {
        return window.authHelper.getSessionId();
      }
      return localStorage.getItem('quicktalk_user') || 
             sessionStorage.getItem('quicktalk_user') || 
             'admin-session';
    }

    _handleSendFailure(item, reason){
      if (item.attempt >= item.maxRetries){
        item.state = 'failed';
        item.error = { code:'RETRIES_EXCEEDED', message: reason };
        if (this.opts.onLocalPatch) this.opts.onLocalPatch(item.tempId,{ state:'failed', error:item.error });
        if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
        this._emitState(item, 'failed');
        this._emitEvt('SEND.FAILED', { tempId: item.tempId, reason:item.error });
      } else {
        // 指数退避后重试
        const delay = Math.min(this.opts.baseRetryDelayMs * Math.pow(2, item.attempt-1), 10000);
        item.state = 'pending'; // 重新排队
        if (this.opts.onLocalPatch) this.opts.onLocalPatch(item.tempId,{ state:'pending', retryIn: delay });
        if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
        this._emitState(item, 'pending');
        setTimeout(()=> this._schedule(), delay);
      }
    }

    _finalize(item, serverMsg){
      item.state = 'sent';
      if (item.ackTimer){ clearTimeout(item.ackTimer); item.ackTimer = null; }
      if (this.opts.onLocalPatch) this.opts.onLocalPatch(item.tempId,{ state:'sent', server_id: serverMsg.id });
      if (typeof this.opts.onFinalized === 'function') this.opts.onFinalized(item.tempId, serverMsg);
      if (this._bus) this._bus.publish('message.updated', { message: this._draftToLocalMessage(item), conversationId: item.conversation_id });
      this._emitState(item, 'sent');
      this._emitEvt('SEND.FINALIZED', { tempId: item.tempId, serverId: serverMsg.id });
    }

    _buildServerFingerprint(serverMsg){
      const t = serverMsg.timestamp || serverMsg.sent_at || serverMsg.created_at || 0;
      // 文件
      if (serverMsg.files && serverMsg.files.length > 0){
        const f = serverMsg.files[0];
        const name = (f.name||'').slice(0,24);
        const size = f.size || 0;
        return `${serverMsg.conversation_id}|file|${name}|${size}|${t}`;
      }
      // 语音（假设 voice 元数据）
      if (serverMsg.voice){
        const d = serverMsg.voice.durationMs || serverMsg.voice.duration || 0;
        const s = serverMsg.voice.size || 0;
        return `${serverMsg.conversation_id}|voice|${d}|${s}|${t}`;
      }
      // 文本
      const content = (serverMsg.content||'').slice(0,32);
      return `${serverMsg.conversation_id}|text|${content}|${t}`;
    }

    _resolveConversation(){
      if (typeof this.opts.conversationResolver === 'function') return this.opts.conversationResolver();
      return null;
    }

    _startAckTimer(item){
      const GRACE = (this.opts.ackTimeoutMs || 8000);
      if (item.ackTimer) clearTimeout(item.ackTimer);
      item.ackTimer = setTimeout(()=>{
        if (item.state !== 'sent') {
          item.state = 'failed';
          item.error = { code:'ACK_TIMEOUT', message:'服务器未在宽限期内确认' };
          if (this.opts.onLocalPatch) this.opts.onLocalPatch(item.tempId,{ state:'failed', error:item.error });
          this._emitState(item, 'failed');
          this._emitEvt('SEND.ACK_TIMEOUT', { tempId: item.tempId });
        }
      }, GRACE);
    }

    // ---- 事件封装 ----
    _emitState(item, newState){
      try {
        if (this._events) {
          this._events.emit(this._events.Events.MESSAGE.STATE_CHANGED, { tempId:item.tempId, state:newState, conversation_id:item.conversation_id });
        } else {
          document.dispatchEvent(new CustomEvent('message.state.changed', { detail:{ tempId:item.tempId, state:newState }}));
        }
      } catch(_){ }
    }

    _emitEvt(name, detail){
      try {
        if (!this._events) return;
        const parts = name.split('.'); // e.g. SEND.FAILED
        let evtObj = this._events.Events;
        parts.forEach(p=>{ if (evtObj && evtObj[p]) evtObj = evtObj[p]; });
        // 若未找到枚举, 直接用拼接
        const evtName = (typeof evtObj === 'string') ? evtObj : name.toLowerCase();
        this._events.emit(evtName, detail);
      } catch(_){ }
    }
  }

  window.MessageSendChannel = MessageSendChannel;

  console.log('✅ 统一发送通道已加载 (message-send-channel.js)');
})();
