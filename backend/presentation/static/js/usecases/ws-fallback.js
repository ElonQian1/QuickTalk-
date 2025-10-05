/**
 * ws-fallback.js
 * 统一 WebSocket 连接管理（心跳/重连/降级/发送队列）
 * 适用场景：主 MessageWSHandler 未加载或需要独立健壮层
 * 特性：
 *  - 指数退避重连（1s 起，乘1.6，上限 maxBackoff）
 *  - 心跳 ping/pong 监测，连续丢失 => degraded 状态
 *  - 发送队列：断线期间入队，重连成功后自动 flush
 *  - 状态回调：onStatus(status, meta)；状态：connecting|open|degraded|reconnecting|closed
 *  - 幂等 ensure：同 URL 下可选择复用（当前简单实现总是新建以保持隔离）
 */
(function(){
  'use strict';

  function createBackoff(max){
    let attempt = 0;
    return function next(){
      const base = 1000 * Math.pow(1.6, attempt++);
      return Math.min(base, max);
    };
  }

  function nowTs(){ return Date.now(); }

  function ensureWS(opts){
    const options = Object.assign({
      urlBuilder: ()=> `ws://${location.host}/ws`,
      heartbeatSec: 25,
      maxBackoff: 15000,
      maxQueue: 100,
      maxRetry: 8,
      onEvent: (data)=>{},
      onStatus: (status)=>{},
      onOpen: ()=>{},
      onClose: ()=>{},
      onDegraded: ()=>{}
    }, opts||{});

    let ws = null;
    let status = 'connecting';
    let manualClose = false;
    let backoff = createBackoff(options.maxBackoff);
    let retryCount = 0;
    let heartbeatTimer = null;
    let lastPong = null;
    let missedPongs = 0;
    let sendQueue = [];
    let lastStatusEmit = 0;

    function emitStatus(s, meta){
      if (status === s) return; // 状态变化时才触发
      status = s;
      lastStatusEmit = nowTs();
      try { options.onStatus && options.onStatus(s, meta||{}); } catch(_){ }
      if (s === 'open') { try { options.onOpen(); } catch(_){ } }
      if (s === 'degraded') { try { options.onDegraded(); } catch(_){ } }
      if (s === 'closed') { try { options.onClose(meta||{}); } catch(_){ } }
    }

    function setStatus(s, meta){ emitStatus(s, meta); }

    function scheduleReconnect(){
      if (manualClose) return;
      if (retryCount >= options.maxRetry){
        setStatus('closed', { terminal:true });
        return;
      }
      retryCount++;
      const delay = backoff();
      setStatus('reconnecting', { retry: retryCount, delay });
      setTimeout(()=> openSocket(), delay);
    }

    function openSocket(){
      if (manualClose) return;
      try {
        setStatus(retryCount === 0 ? 'connecting' : 'reconnecting');
        ws = new WebSocket(options.urlBuilder());
        ws.onopen = ()=>{
          retryCount = 0;
            backoff = createBackoff(options.maxBackoff); // 重置退避
          lastPong = nowTs();
          missedPongs = 0;
          setStatus('open');
          flushQueue();
          startHeartbeat();
        };
        ws.onmessage = (evt)=>{
          if (!evt || typeof evt.data === 'undefined') return;
          let data = null;
          try { data = JSON.parse(evt.data); } catch(_){ /* 可能是纯文本，忽略 */ }
          if (data && (data.type === 'pong' || data.msg_type === 'pong')){
            lastPong = nowTs();
            missedPongs = 0;
            if (status === 'degraded') setStatus('open', { recover:true });
            return;
          }
          if (data) {
            // 任意业务消息也视为活跃
            lastPong = nowTs();
            missedPongs = 0;
            try { options.onEvent(data); } catch(_){ }
          }
        };
        ws.onerror = ()=> {
          // 交由 onclose 统一处理
        };
        ws.onclose = (evt)=>{
          stopHeartbeat();
          if (manualClose){
            setStatus('closed', { manual:true, code: evt && evt.code });
            return;
          }
          scheduleReconnect();
        };
      } catch(e){
        scheduleReconnect();
      }
    }

    function startHeartbeat(){
      stopHeartbeat();
      heartbeatTimer = setInterval(()=>{
        if (!ws || ws.readyState !== WebSocket.OPEN) return; // 等待 open
        const now = nowTs();
        // 检查 pong 超时
        if (lastPong && (now - lastPong) > options.heartbeatSec * 1000 * (missedPongs+1)){
          missedPongs++;
          if (missedPongs >= 2 && status === 'open'){ setStatus('degraded', { missed: missedPongs }); }
          if (missedPongs >= 4){ // 彻底判定断开
            try { ws.close(); } catch(_){ }
            return;
          }
        }
        // 发送 ping
        try { ws.send(JSON.stringify({ type:'ping', ts: now })); } catch(_){ }
      }, options.heartbeatSec * 1000);
    }

    function stopHeartbeat(){ if (heartbeatTimer){ clearInterval(heartbeatTimer); heartbeatTimer = null; } }

    function flushQueue(){
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!sendQueue.length) return;
      const q = sendQueue.slice();
      sendQueue.length = 0;
      q.forEach(item=>{ try { ws.send(item); } catch(_){ } });
    }

    function send(obj){
      const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
      if (ws && ws.readyState === WebSocket.OPEN){
        try { ws.send(payload); return true; } catch(_){ /* 回退入队 */ }
      }
      // 非 open：入队
      if (sendQueue.length >= options.maxQueue){ sendQueue.shift(); }
      sendQueue.push(payload);
      return false;
    }

    function close(){
      manualClose = true;
      try { if (ws) ws.close(); } catch(_){ }
      stopHeartbeat();
      setStatus('closed', { manual:true });
    }

    function getStatus(){ return status; }

    openSocket();

    return {
      send,
      status: getStatus,
      close,
      _debug: ()=>({ queue: sendQueue.length, status, retryCount, missedPongs })
    };
  }

  window.WSFallback = { ensureWS: ensureWS };
  console.log('✅ WSFallback 已加载 (ws-fallback.js)');
})();
