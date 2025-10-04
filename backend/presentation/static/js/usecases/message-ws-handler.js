/**
 * message-ws-handler.js
 * 统一 WebSocket 处理器抽象：适配新适配器 + legacy fallback，自适应重连与事件分发。
 * 目标：
 *  - 将 message-module.js 中的 _initWSAdapter / _legacyInitWebSocket 抽离
 *  - 暴露统一 init / send / close / readyState 接口
 *  - onEvent 回调统一格式：{ raw, type, data }
 *  - 提供最小防御：JSON 解析错误捕获、重连节流
 *  - 不依赖具体业务（不触发渲染，不做状态写入）
 */
(function(){
  'use strict';

  if (window.MessageWSHandler) return; // 幂等

  const DEFAULT_RECONNECT_DELAY = 3000;
  const MAX_RECONNECT_DELAY = 15000;

  function computeNextDelay(prev){
    const next = Math.min((prev || DEFAULT_RECONNECT_DELAY) * 1.5, MAX_RECONNECT_DELAY);
    return Math.round(next);
  }

  class WSHandlerInstance {
    constructor(opts){
      this._onEvent = opts.onEvent || function(){};
      this._debug = !!opts.debug;
      this._urlBuilder = opts.urlBuilder || (()=> {
        const proto = (location.protocol === 'https:') ? 'wss:' : 'ws:';
        return proto + '//' + location.host + '/ws';
      });
      this._reconnectDelay = DEFAULT_RECONNECT_DELAY;
      this._closedExplicitly = false;
      this._adapterMode = false; // true => 使用 MessageWSAdapter
      this._ws = null; // legacy socket 引用
      this._adapter = null; // 新适配器引用
      this._init();
    }

    _log(...args){ if (this._debug) console.log('[MessageWSHandler]', ...args); }
    _warn(...args){ if (this._debug) console.warn('[MessageWSHandler]', ...args); }
    _err(...args){ console.error('[MessageWSHandler]', ...args); }

    _init(){
      if (window.MessageWSAdapter) {
        this._adapterMode = true;
        this._initAdapter();
      } else {
        this._adapterMode = false;
        this._initLegacy();
      }
    }

    _initAdapter(){
      try {
        this._adapter = new window.MessageWSAdapter({ debug: this._debug });
        this._adapter.on('*any', (evt)=> this._handleRaw(evt));
        this._adapter.on('*open', ()=> { this._log('open'); this._reconnectDelay = DEFAULT_RECONNECT_DELAY; });
        this._adapter.on('*close', (info)=> this._handleClose(info));
        this._adapter.on('*error', (err)=> this._warn('error', err));
      } catch(e){
        this._err('adapter init failed, fallback legacy', e);
        this._adapterMode = false;
        this._initLegacy();
      }
    }

    _initLegacy(){
      try {
        const url = this._urlBuilder();
        const ws = new WebSocket(url);
        this._ws = ws;
        ws.onopen = ()=> { this._log('legacy open'); this._reconnectDelay = DEFAULT_RECONNECT_DELAY; };
        ws.onmessage = (ev)=> {
          let parsed = null;
            try { parsed = JSON.parse(ev.data); } catch(e){ this._warn('parse fail', e); return; }
            this._handleRaw(parsed);
        };
        ws.onclose = (ev)=> { this._handleClose(ev); };
        ws.onerror = (err)=> { this._warn('legacy error', err); };
      } catch(e){ this._err('legacy init failed', e); this._scheduleReconnect(); }
    }

    _handleRaw(raw){
      if (!raw) return;
      const type = raw.type || raw.msg_type || (raw.event && raw.event.type) || 'unknown';
      try {
        this._onEvent({ raw, type, data: raw });
      } catch(e){ this._err('onEvent error', e); }
    }

    _handleClose(info){
      if (this._closedExplicitly) return;
      this._warn('closed', info);
      this._scheduleReconnect();
    }

    _scheduleReconnect(){
      const delay = this._reconnectDelay;
      this._reconnectDelay = computeNextDelay(this._reconnectDelay);
      setTimeout(()=>{ if (!this._closedExplicitly) this._init(); }, delay);
    }

    send(obj){
      if (!obj) return false;
      try {
        if (this._adapterMode && this._adapter) return this._adapter.send(obj) === true;
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify(obj));
          return true;
        }
      } catch(e){ this._warn('send failed', e); }
      return false;
    }

    close(){
      this._closedExplicitly = true;
      try { if (this._adapterMode && this._adapter && this._adapter._ws) this._adapter._ws.close(); } catch(_){}
      try { if (this._ws) this._ws.close(); } catch(_){}
    }

    readyState(){
      if (this._adapterMode && this._adapter && this._adapter._ws) return this._adapter._ws.readyState;
      if (this._ws) return this._ws.readyState;
      return WebSocket.CLOSED;
    }
  }

  window.MessageWSHandler = {
    init(opts){ return new WSHandlerInstance(opts || {}); }
  };

  console.log('✅ message-ws-handler.js 加载完成');
})();
