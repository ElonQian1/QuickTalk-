/* ws-diagnostics.js
 * 轻量 WebSocket 运行时诊断：监听 ws:* DOM 事件并统计。
 * 事件来源：websocket-base.js emit -> document.dispatchEvent('ws:<event>').
 */
(function(){
  'use strict';
  if (window.WebSocketDiagnostics) return;
  const stats = {
    startedAt: Date.now(),
    lastEventAt: null,
    events: {}, // name -> count
    messages: { total:0, text:0, system:0, heartbeat:0, other:0 },
    connections: { opened:0, closed:0, errors:0, reconnects:0 },
    lastOpenTime: null,
    lastClose: null,
    lastError: null,
    heartbeat: {
      sent: 0,
      ack: 0,
      lost: 0,
      lastSentAt: null,
      lastAckAt: null,
      intervals: [],      // ms between sends
      rtts: [],           // measured round trip times
      avgInterval: 0,
      avgRTT: 0,
      maxRTT: 0,
      minRTT: 0,
      lastRTT: 0
    }
  };
  const listeners = [];
  function inc(map, key){ map[key] = (map[key]||0)+1; }
  function tap(ev){ stats.lastEventAt = Date.now(); inc(stats.events, ev.type); }
  function on(name, fn){ document.addEventListener(name, fn); listeners.push({name, fn}); }

  function classifyMessage(detail){
    if (!detail) { stats.messages.other++; return; }
    const t = detail.type || detail.message_type || detail.kind;
    switch(t){
      case 'text': stats.messages.text++; break;
      case 'system': stats.messages.system++; break;
      case 'heartbeat': stats.messages.heartbeat++; break;
      default: stats.messages.other++; break;
    }
    stats.messages.total++;
    if (t === 'heartbeat') {
      // 若服务器回包包含 clientSentAt / ts 字段用于 RTT
      const now = Date.now();
      const sentAt = detail.clientSentAt || detail.sentAt || detail.ts || null;
      if (sentAt) {
        const rtt = Math.max(0, now - sentAt);
        stats.heartbeat.lastRTT = rtt;
        stats.heartbeat.rtts.push(rtt);
        stats.heartbeat.ack++;
        stats.heartbeat.lastAckAt = now;
        // 维护窗口，限制长度
        if (stats.heartbeat.rtts.length > 120) stats.heartbeat.rtts.shift();
        const rArr = stats.heartbeat.rtts;
        const sum = rArr.reduce((a,b)=>a+b,0);
        stats.heartbeat.avgRTT = +(sum / rArr.length).toFixed(1);
        stats.heartbeat.maxRTT = Math.max(...rArr);
        stats.heartbeat.minRTT = Math.min(...rArr);
      }
    }
  }

  on('ws:connectionStateChanged', e=>{ tap(e); const d=e.detail||{}; if(d.newState==='connected'){ stats.connections.opened++; stats.lastOpenTime=Date.now(); } if(d.newState==='reconnecting'){ stats.connections.reconnects++; } if(d.newState==='failed'){ stats.connections.errors++; }
  });
  on('ws:message', e=>{ tap(e); classifyMessage(e.detail); });
  on('ws:heartbeatSent', e=>{
    tap(e);
    const now = Date.now();
    const hb = stats.heartbeat;
    hb.sent++;
    if (hb.lastSentAt) {
      const interval = now - hb.lastSentAt;
      hb.intervals.push(interval);
      if (hb.intervals.length > 120) hb.intervals.shift();
      const sumI = hb.intervals.reduce((a,b)=>a+b,0);
      hb.avgInterval = +(sumI / hb.intervals.length).toFixed(1);
    }
    hb.lastSentAt = now;
  });
  on('ws:heartbeatLost', e=>{ tap(e); stats.heartbeat.lost++; });
  on('ws:error', e=>{ tap(e); stats.connections.errors++; stats.lastError = e.detail; });
  on('ws:close', e=>{ tap(e); stats.connections.closed++; stats.lastClose = e.detail; });

  const api = {
    getStats(){
      return Object.assign({}, stats, {
        uptime: Date.now()-stats.startedAt,
        openDuration: stats.lastOpenTime ? Date.now()-stats.lastOpenTime : 0
      });
    },
    reset(){
      const keep = { startedAt: stats.startedAt };
      Object.keys(stats).forEach(k=> delete stats[k]);
      Object.assign(stats, keep, { lastEventAt:null, events:{}, messages:{ total:0,text:0,system:0,heartbeat:0,other:0 }, connections:{ opened:0,closed:0,errors:0,reconnects:0 } });
    },
    debugTable(){ console.table(this.getStats()); },
    exportJSON(){ return JSON.stringify(this.getStats(), null, 2); }
  };
  window.WebSocketDiagnostics = api;
  console.log('✅ WebSocketDiagnostics 已初始化');
})();
