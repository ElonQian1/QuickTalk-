/**
 * message-ws-adapter.js
 * 职责: 提供 WebSocket 连接生命周期管理 + 事件发布订阅 + 重连与心跳。
 * 不做业务判断，不直接操作 DOM，不依赖渲染模块。
 * 外部通过 on(type, handler) 订阅原始消息事件（已解包 JSON），并在 teardown() 时清理。
 */
(function(){
  'use strict';
  const DEFAULT_ENDPOINT = '/ws';
  const RETRY_BASE = 1500; // 初始重连间隔
  const RETRY_MAX = 30000; // 上限
  const HEARTBEAT_INTERVAL = 25000; // 25s 心跳

  class MessageWSAdapter {
    constructor(opts = {}) {
      this.endpoint = opts.endpoint || DEFAULT_ENDPOINT;
      this._ws = null;
      this._connected = false;
      this._listeners = new Map(); // type -> Set<fn>
      this._retry = 0;
      this._manualClose = false;
      this._heartbeatTimer = null;
      this._connectTimer = null;
      this._debug = !!opts.debug;
      this._ctxProvider = opts.ctxProvider || null; // 可选: 获取外部上下文
      this.connect();
    }

    log(...args){ if(this._debug) console.log('[WSAdapter]', ...args); }
    warn(...args){ console.warn('[WSAdapter]', ...args); }
    error(...args){ console.error('[WSAdapter]', ...args); }

    connect(){
      if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
        return; // 已在连接中
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 追加角色 / 用户标识，便于后端区分 agent / customer；不破坏已有后端兼容（无参数时后端默认逻辑）
        let role = 'agent';
        try {
          if (window.currentUser && (currentUser.role||currentUser.type)) role = currentUser.role||currentUser.type;
          else if (localStorage.getItem('quicktalk_role')) role = localStorage.getItem('quicktalk_role');
        } catch(_){ }
        if (window.MessageNormalizer && window.MessageNormalizer.normalizeSenderType) {
          role = window.MessageNormalizer.normalizeSenderType(role);
        }
        let uid = 'admin';
        try { if (window.currentUser && currentUser.id) uid = currentUser.id; else if (localStorage.getItem('quicktalk_user_id')) uid = localStorage.getItem('quicktalk_user_id'); } catch(_){ }
        const q = `role=${encodeURIComponent(role)}&sender_id=${encodeURIComponent(uid)}`;
        const sep = this.endpoint.includes('?') ? '&' : '?';
        const url = `${proto}//${window.location.host}${this.endpoint}${sep}${q}`;
        window.__LAST_WS_URL = url;
      this.log('connecting to', url);
      try {
        this._ws = new WebSocket(url);
      } catch(e) {
        this.error('构造 WebSocket 失败', e); this._scheduleReconnect(); return;
      }

      this._ws.onopen = () => {
        this._connected = true;
        this._retry = 0;
        this.log('connected');
        this._emit('*open', {});
        this._startHeartbeat();
      };

      this._ws.onmessage = (evt) => {
        let payload = null;
        try { payload = JSON.parse(evt.data); } catch(e){ this.warn('JSON 解析失败, 传递原始字符串'); payload = { raw: evt.data }; }
        if (!payload || typeof payload !== 'object') return;
        // 原始类型字段兼容
        const type = payload.type || payload.msg_type || 'unknown';
        this._emit(type, payload);
        this._emit('*any', payload);
      };

      this._ws.onclose = (evt) => {
        this._connected = false;
        this._emit('*close', { code: evt.code, reason: evt.reason });
        this.log('closed', evt.code, evt.reason);
        this._stopHeartbeat();
        if (!this._manualClose) this._scheduleReconnect();
      };

      this._ws.onerror = (err) => {
        this.error('socket error', err);
        this._emit('*error', { error: err });
      };
    }

    _scheduleReconnect(){
      if (this._manualClose) return;
      this._retry += 1;
      const delay = Math.min(RETRY_MAX, RETRY_BASE * Math.pow(2, this._retry - 1));
      this.warn(`reconnect in ${delay}ms (#${this._retry})`);
      clearTimeout(this._connectTimer);
      this._connectTimer = setTimeout(()=> this.connect(), delay);
    }

    _startHeartbeat(){
      this._stopHeartbeat();
      this._heartbeatTimer = setInterval(()=>{
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
        try { this._ws.send(JSON.stringify({ type: 'ping', ts: Date.now() })); } catch(e){ this.warn('heartbeat send failed', e); }
      }, HEARTBEAT_INTERVAL);
    }
    _stopHeartbeat(){ if (this._heartbeatTimer){ clearInterval(this._heartbeatTimer); this._heartbeatTimer=null; } }

    on(type, handler){
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type).add(handler);
      return () => this.off(type, handler);
    }
    off(type, handler){ const set = this._listeners.get(type); if(set){ set.delete(handler); if(set.size===0) this._listeners.delete(type); } }
    _emit(type, data){
      const deliver = (t) => {
        const set = this._listeners.get(t);
        if (set) set.forEach(fn => { try { fn(data); } catch(e){ this.error('listener error', e); } });
      };
      deliver(type); // 精确
      // 可选: 通配符机制已用 *any / *open 等特殊事件
    }

    send(obj){
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN){ this.warn('send ignored: socket not open'); return false; }
      try { this._ws.send(JSON.stringify(obj)); return true; } catch(e){ this.error('send failed', e); return false; }
    }

    status(){
      if (!this._ws) return 'idle';
      switch(this._ws.readyState){
        case WebSocket.CONNECTING: return 'connecting';
        case WebSocket.OPEN: return 'open';
        case WebSocket.CLOSING: return 'closing';
        case WebSocket.CLOSED: return 'closed';
        default: return 'unknown';
      }
    }

    teardown(){
      this._manualClose = true;
      this._stopHeartbeat();
      clearTimeout(this._connectTimer);
      if (this._ws){ try { this._ws.close(); } catch(_){} }
      this._listeners.clear();
      this.log('teardown complete');
    }
  }

  window.MessageWSAdapter = MessageWSAdapter;
  console.log('✅ WebSocket 适配器已加载 (message-ws-adapter.js)');
})();
