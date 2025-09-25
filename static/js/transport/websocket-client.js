// Lightweight reconnecting WebSocket client
(function(global){
  function createWebSocket(opts){
    const { url, onOpen, onMessage, onError, onClose, retry=5000 } = opts;
    let ws; let closed=false; let timer=null;
    function log(...a){ console.log('[WS]', ...a); }
    function connect(){
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const finalUrl = url || protocol+'//'+window.location.host+'/ws';
      log('connecting', finalUrl);
      ws = new WebSocket(finalUrl);
      ws.onopen = () => { log('open'); onOpen && onOpen(ws); };
      ws.onmessage = (ev) => { try { const data = JSON.parse(ev.data); onMessage && onMessage(data); } catch(e){ log('parse error', e, ev.data); } };
      ws.onerror = (e) => { log('error', e); onError && onError(e); };
      ws.onclose = (ev) => { log('close', ev.code, ev.reason); onClose && onClose(ev); if(!closed){ timer = setTimeout(connect, retry); } };
    }
    connect();
    return {
      send(obj){ if(ws && ws.readyState===1) ws.send(JSON.stringify(obj)); },
      close(){ closed=true; if(timer) clearTimeout(timer); ws && ws.close(); },
      raw(){ return ws; }
    };
  }
  global.QuickTalk = global.QuickTalk || {};
  global.QuickTalk.WS = { createWebSocket };
})(window);
