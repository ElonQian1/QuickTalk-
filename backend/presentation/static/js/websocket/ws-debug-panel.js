/* ws-debug-panel.js
 * 轻量 WebSocket 调试可视化面板
 * 依赖: window.WebSocketDiagnostics (若不存在则延迟重试), DOM ws:* 事件
 * 目标: 开发阶段快速洞察连接/消息/心跳/RTT/重连趋势
 */
(function(){
  'use strict';
  if (window.WSDebugPanel) return; // 单例防重复

  const CONFIG = {
    hotkey: { ctrl:true, alt:true, key:'d' }, // Ctrl+Alt+D 切换
    refreshInterval: 1000, // ms
    maxSparkPoints: 30
  };

  // 简易事件总线监听 -> 收集最近 RTT 序列以作火花线
  const spark = { rtts: [] };
  document.addEventListener('ws:heartbeatSent', ()=>{/* noop for now */});
  document.addEventListener('ws:message', e=>{
    const detail = e.detail || {}; const t = detail.type || detail.message_type;
    if (t==='heartbeat') {
      const sentAt = detail.clientSentAt || detail.sentAt || detail.ts; const now=Date.now();
      if (sentAt) {
        const rtt = Math.max(0, now - sentAt);
        spark.rtts.push(rtt); if (spark.rtts.length>CONFIG.maxSparkPoints) spark.rtts.shift();
      }
    }
  });

  function createPanel(){
    const panel = document.createElement('div');
    panel.id = 'ws-debug-panel';
    panel.style.cssText = [
      'position:fixed','z-index:99999','right:8px','bottom:8px','width:360px','font:12px/1.4 monospace',
      'background:rgba(20,22,30,0.92)','color:#cfd8dc','border:1px solid #263238','border-radius:6px',
      'box-shadow:0 4px 18px rgba(0,0,0,0.4)','padding:8px 10px','backdrop-filter:blur(4px)'
    ].join(';');
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <strong style="font-size:13px;">WS Debug Panel</strong>
        <div>
          <button data-act="pin" title="固定/解锁" style="margin-right:4px;">📌</button>
          <button data-act="close" title="关闭">✖</button>
        </div>
      </div>
      <div id="wsdp-quality" style="margin:2px 0 6px;font-size:11px;letter-spacing:.5px;display:flex;gap:8px;flex-wrap:wrap;"></div>
      <div id="wsdp-conn" style="margin:4px 0 6px;font-size:12px;"></div>
      <div id="wsdp-metrics" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-size:11px;"></div>
      <div style="margin-top:6px;font-size:11px;">
        <div style="margin-bottom:2px;">Heartbeat RTT (ms)</div>
        <pre id="wsdp-rtt" style="height:46px;overflow:hidden;margin:0;background:#111a23;border:1px solid #263238;padding:4px;border-radius:4px;font-size:10px;"></pre>
      </div>
      <div style="margin-top:6px;font-size:11px;">
        <div style="margin-bottom:2px;">Intervals (ms)</div>
        <pre id="wsdp-interval" style="height:32px;overflow:hidden;margin:0;background:#111a23;border:1px solid #263238;padding:4px;border-radius:4px;font-size:10px;"></pre>
      </div>
      <div style="margin-top:6px;font-size:11px;display:flex;justify-content:space-between;opacity:.75;"> <span id="wsdp-uptime"></span><span id="wsdp-hint">Ctrl+Alt+D</span></div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function sparkline(arr){
    if (!arr.length) return ''; const max = Math.max(...arr); const min = Math.min(...arr);
    if (max===min) return arr.map(()=>'-').join('');
    const chars = '▁▂▃▄▅▆▇█';
    return arr.map(v=>{ const idx = Math.min(chars.length-1, Math.floor((v-min)/(max-min)*(chars.length-1))); return chars[idx]; }).join('');
  }

  function fmtMs(v){ if(v==null) return '-'; if (v>9999) return (v/1000).toFixed(1)+'s'; return v.toString(); }

  const PanelAPI = {
    _visible:false,_pinned:false,_timer:null,_panel:null,
    _qualityCache:null,
    toggle(){ this._visible? this.hide(): this.show(); },
    show(){ if (this._visible) return; if(!this._panel) this._panel=createPanel(); this._panel.style.display='block'; this._visible=true; this._loop(); },
    hide(){ if(!this._visible) return; this._visible=false; if(this._panel) this._panel.style.display='none'; if(this._timer) {cancelAnimationFrame(this._timer); this._timer=null;} },
    _loop(){ if(!this._visible) return; this.render(); this._timer=requestAnimationFrame(()=>this._loop()); },
    render(){
      if (!window.WebSocketDiagnostics) return; const s = window.WebSocketDiagnostics.getStats();
      const conn = document.getElementById('wsdp-conn'); if(!conn) return;
      conn.innerHTML = `State: <span style="color:${colorState(s.connectionState)}">${s.connectionState||'-'}</span> | Reconnects: ${s.connections.reconnects} | Errors: ${s.connections.errors}`;
      const metrics = document.getElementById('wsdp-metrics');
      const hb = s.heartbeat || {}; const msg = s.messages || {}; const evt = s.events || {};
      metrics.innerHTML = `
        <div>Msgs: ${msg.total}</div>
        <div>Text: ${msg.text}</div>
        <div>Sys: ${msg.system}</div>
        <div>HB Sent: ${hb.sent}</div>
        <div>HB Ack: ${hb.ack}</div>
        <div>HB Lost: ${hb.lost}</div>
        <div>AvgRTT: ${fmtMs(hb.avgRTT)}</div>
        <div>LastRTT: ${fmtMs(hb.lastRTT)}</div>
        <div>AvgIntv: ${fmtMs(hb.avgInterval)}</div>`;
      const rttsPre = document.getElementById('wsdp-rtt');
      rttsPre.textContent = (hb.rtts||[]).slice(-CONFIG.maxSparkPoints).map(v=>v.toString()).join(', ')+"\n"+sparkline((hb.rtts||[]).slice(-CONFIG.maxSparkPoints));
      const intvPre = document.getElementById('wsdp-interval');
      intvPre.textContent = (hb.intervals||[]).slice(-CONFIG.maxSparkPoints).map(v=>v.toString()).join(', ')+"\n"+sparkline((hb.intervals||[]).slice(-CONFIG.maxSparkPoints));
      const uptime = document.getElementById('wsdp-uptime'); uptime.textContent = `Uptime ${Math.floor(s.uptime/1000)}s`;
      renderQuality(this._qualityCache);
    }
  };

  function colorState(st){ switch(st){ case 'connected': return '#4caf50'; case 'reconnecting': return '#ff9800'; case 'failed': return '#f44336'; default: return '#90a4ae'; } }

  function bindHotkey(){
    document.addEventListener('keydown', e=>{
      if (e.key.toLowerCase() === CONFIG.hotkey.key && !!e.ctrlKey === CONFIG.hotkey.ctrl && !!e.altKey === CONFIG.hotkey.alt){
        PanelAPI.toggle();
      }
    });
  }

  function bindPanelActions(){
    document.addEventListener('click', e=>{
      if(!PanelAPI._panel || !PanelAPI._visible) return;
      const btn = e.target.closest('button[data-act]'); if(!btn) return; const act = btn.getAttribute('data-act');
      if (act==='close') PanelAPI.hide(); else if (act==='pin'){ PanelAPI._pinned=!PanelAPI._pinned; btn.textContent=PanelAPI._pinned?'📍':'📌'; }
    });
  }

  function renderQuality(q){
    const box = document.getElementById('wsdp-quality'); if(!box) return;
    if(!window.WSQuality){ box.innerHTML = '<span style="opacity:.6">Quality: --</span>'; return; }
    if(!q){ const cur = window.WSQuality.getScore(); if(!cur){ box.innerHTML = '<span style="opacity:.6">Quality: --</span>'; return;} q=cur; }
    const lvlColor = qualityColor(q.level);
    const m = q.metrics || {}; const lossPct = m.lossRatio!=null? (m.lossRatio*100).toFixed(1)+'%':'-';
    box.innerHTML = `
      <span>Quality: <b style="color:${lvlColor}">${q.level}</b></span>
      <span>Score: ${q.score}</span>
      <span>Loss: ${lossPct}</span>
      <span>RTT: ${(m.avgRTT||0).toFixed(0)}ms</span>
      <span>Jitter: ${(m.jitter||0).toFixed(0)}ms</span>`;
  }

  function qualityColor(level){
    switch(level){
      case 'Excellent': return '#4caf50';
      case 'Good': return '#8bc34a';
      case 'Fair': return '#ffc107';
      case 'Poor': return '#ff9800';
      case 'Critical': return '#f44336';
      default: return '#90a4ae';
    }
  }

  // 监听质量变化事件（不增加动画循环复杂度，仅缓存，render 循环会调用）
  document.addEventListener('ws:qualityChanged', e=>{
    PanelAPI._qualityCache = { score: e.detail.score, level: e.detail.newLevel, metrics: e.detail.metrics };
    if (PanelAPI._visible) renderQuality(PanelAPI._qualityCache);
  });

  function waitDiagnostics(retries=20){
    if (window.WebSocketDiagnostics){ bindHotkey(); bindPanelActions(); console.log('✅ WSDebugPanel 就绪 (Ctrl+Alt+D)'); return; }
    if (retries<=0){ console.warn('WSDebugPanel: 未检测到 WebSocketDiagnostics, 放弃初始化'); return; }
    setTimeout(()=>waitDiagnostics(retries-1), 500);
  }

  window.WSDebugPanel = PanelAPI;
  waitDiagnostics();
})();
