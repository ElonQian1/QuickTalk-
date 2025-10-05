/* diagnostics-panel.js
 * 统一调试面板：聚合 Missing Keys / Text Usage / WS Metrics / Unused Texts / LastUsed
 * API:
 *   showDiagnosticsPanel(options?)
 *   hideDiagnosticsPanel()
 * 说明：纯前端调试辅助，不参与业务逻辑与上报。
 */
(function(){
  'use strict';
  if (window.showDiagnosticsPanel) return; // 幂等

  const DEFAULT_REFRESH = 2000;
  let _panel = null;
  let _timer = null;
  let _drag = { active:false, dx:0, dy:0 };

  function _el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className = cls; if(text) e.textContent = text; return e; }

  function _formatMs(ms){ if(ms==null) return '-'; if(ms<1000) return ms+'ms'; const s = ms/1000; if(s<60) return s.toFixed(1)+'s'; const m = s/60; if(m<60) return m.toFixed(1)+'m'; return (m/60).toFixed(1)+'h'; }

  function _collectData(){
    const data = {};
    data.missing = Array.isArray(window.__LAST_MISSING_TEXT_KEYS__)? window.__LAST_MISSING_TEXT_KEYS__.slice() : [];
    if (typeof window.exportTextUsageStats === 'function') {
      data.usage = window.exportTextUsageStats();
    } else data.usage = [];
    if (typeof window.exportWsMetrics === 'function') {
      data.ws = window.exportWsMetrics();
    } else data.ws = { metrics:{}, derived:{}, events:[] };
    if (typeof window.exportUnusedTextKeys === 'function') {
      try { data.unused = window.exportUnusedTextKeys({ includeUsageCounts:true }).unused; } catch(_){ data.unused = []; }
    } else data.unused = [];
    if (typeof window.exportWsEventCategories === 'function') {
      try { data.wsCats = window.exportWsEventCategories({ windowMs: 5*60*1000 }); } catch(_){ data.wsCats = null; }
    } else data.wsCats = null;
    data.lastUsed = typeof window.exportTextLastUsedStats==='function'? window.exportTextLastUsedStats().slice(0,80): [];
    return data;
  }

  function _render(){
    if (!_panel) return;
    const data = _collectData();
    const tab = _panel.querySelector('[data-tab-active]')?.getAttribute('data-tab-active') || 'usage';
    const body = _panel.querySelector('.qt-diag-body');
    body.innerHTML = '';

    if (tab === 'usage') {
      const tbl = _el('table','qt-diag-table');
      tbl.innerHTML = '<thead><tr><th>#</th><th>Key</th><th>Count</th></tr></thead>';
      const tb = _el('tbody');
      (data.usage||[]).slice(0,40).forEach((row,i)=>{
        const tr = _el('tr');
        tr.innerHTML = `<td>${i+1}</td><td>${row.key}</td><td>${row.count}</td>`;
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      body.appendChild(tbl);
      // Delta 状态提示（如果 usage 上报已启用且是 delta 模式）
      try {
        if (window.configureTextUsageReporting){
          const cfg = window.configureTextUsageReporting();
          if (cfg && cfg.enableDelta){
            const info = _el('div','qt-diag-subtitle');
            info.textContent = `DeltaMode enabled (minDelta=${cfg.minDelta||1})`;
            body.appendChild(info);
          }
        }
      } catch(_){ }
    } else if (tab === 'missing') {
      if (!data.missing.length) body.appendChild(_el('div','qt-diag-empty','No missing keys.'));
      else {
        const ul = _el('ul','qt-diag-list');
        data.missing.forEach(k=>{ const li = _el('li'); li.textContent = k; ul.appendChild(li); });
        body.appendChild(ul);
      }
    } else if (tab === 'ws') {
      const wrap = _el('div','qt-diag-ws');
      const m = data.ws.metrics || {}; const d = data.ws.derived || {}; 
      const info = [
        ['Attempts', m.reconnectAttempts],
        ['Successes', m.reconnectSuccesses],
        ['SuccessRate', d.successRate],
        ['MeanAttempts/Success', d.meanAttemptsPerSuccess],
        ['FailureStreak', d.failureStreak],
        ['MaxFailureStreak', d.maxFailureStreak],
        ['LastSuccessAge', _formatMs(d.lastSuccessAgeMs)]
      ];
      const tbl = _el('table','qt-diag-table');
      tbl.innerHTML = '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
      const tb = _el('tbody');
      info.forEach(p=>{ const tr = _el('tr'); tr.innerHTML = `<td>${p[0]}</td><td>${p[1]??'-'}</td>`; tb.appendChild(tr); });
      tbl.appendChild(tb); wrap.appendChild(tbl);
      /* Event Rates (multi-window) */
      if (typeof window.exportWsEventRates==='function') {
        try {
          const rates = window.exportWsEventRates();
          const rTbl = _el('table','qt-diag-table');
          rTbl.style.marginTop='6px';
          rTbl.innerHTML = '<thead><tr><th colspan="4">Event Rates</th></tr><tr><th>Window</th><th>Count</th><th>Rate/s</th><th>Newest Age</th></tr></thead>';
          const rtb = _el('tbody');
          (rates.windows||[]).forEach(w => {
            const newestAge = w.newestTs ? _formatMs(Date.now() - w.newestTs) : '-';
            const tr = _el('tr');
            tr.innerHTML = `<td>${(w.windowMs/1000).toFixed(0)}s</td><td>${w.count}</td><td>${w.ratePerSec}</td><td>${newestAge}</td>`;
            rtb.appendChild(tr);
          });
          rTbl.appendChild(rtb);
          wrap.appendChild(rTbl);
        } catch(_){ }
      }
      const evTitle = _el('div','qt-diag-subtitle','Recent Events');
      const evList = _el('ul','qt-diag-events');
      (data.ws.events||[]).slice(-15).reverse().forEach(ev=>{
        const li = _el('li');
        li.textContent = `${new Date(ev.t).toLocaleTimeString()} ${ev.evt}`;
        evList.appendChild(li);
      });
      wrap.appendChild(evTitle); wrap.appendChild(evList);
      /* RTT block */
      if (typeof window.exportWsHeartbeatLatencyStats==='function'){
        try {
          const rtt=window.exportWsHeartbeatLatencyStats();
          const rttTbl=_el('table','qt-diag-table');
          rttTbl.style.marginTop='6px';
          rttTbl.innerHTML='<thead><tr><th colspan="7">Heartbeat RTT (ms)</th></tr><tr><th>Count</th><th>p50</th><th>p90</th><th>p99</th><th>Mean</th><th>Max</th><th>Jitter</th></tr></thead>';
          const rtb=_el('tbody');
          const tr=_el('tr');
          const cells=[rtt.count,rtt.p50,rtt.p90,rtt.p99,rtt.mean,rtt.max,rtt.jitter].map(v=> (v==null?' - ':v));
          tr.innerHTML=cells.map(v=>`<td>${v}</td>`).join('');
          rtb.appendChild(tr);
          rttTbl.appendChild(rtb);
          wrap.appendChild(rttTbl);
        } catch(_){ }
      }
      /* RTT Trend */
      if (typeof window.exportWsHeartbeatTrend==='function'){
        try {
          const trend = window.exportWsHeartbeatTrend();
          if (trend.points && trend.points.length){
            const tTbl=_el('table','qt-diag-table');
            tTbl.style.marginTop='6px';
            tTbl.innerHTML='<thead><tr><th colspan="5">RTT Trend (recent)</th></tr><tr><th>Time</th><th>p50</th><th>p90</th><th>Jitter</th><th>Count</th></tr></thead>';
            const tb2=_el('tbody');
            trend.points.slice(-8).forEach(pt=>{
              const tr=_el('tr');
              tr.innerHTML=`<td>${new Date(pt.ts).toLocaleTimeString()}</td><td>${pt.p50??'-'}</td><td>${pt.p90??'-'}</td><td>${pt.jitter??'-'}</td><td>${pt.count}</td>`;
              tb2.appendChild(tr);
            });
            tTbl.appendChild(tb2);
            wrap.appendChild(tTbl);
          }
        } catch(_){ }
      }
      body.appendChild(wrap);
    } else if (tab === 'unused') {
      if (!data.unused.length) body.appendChild(_el('div','qt-diag-empty','No unused keys (threshold=0).'));
      else {
        const tbl = _el('table','qt-diag-table');
        const hasAge=data.unused.some(r=>r && typeof r==='object' && 'ageMs' in r);
const hasFlags=data.unused.some(r=>r && typeof r==='object' && r.flags && r.flags.length);
let head='<tr><th>#</th><th>Key</th><th>Count</th>';
if(hasAge) head+='<th>Age</th>';
if(hasFlags) head+='<th>Flags</th>';
head+='</tr>';
tbl.innerHTML='<thead>'+head+'</thead>';
const tb=_el('tbody');
data.unused.slice(0,50).forEach((row,i)=>{
const tr=_el('tr');
if(typeof row==='string'){
tr.innerHTML=`<td>${i+1}</td><td>${row}</td><td>0</td>${hasAge?'<td>-</td>':''}${hasFlags?'<td></td>':''}`;
} else {
const ageCell=hasAge?(row.ageMs!=null?row.ageMs:'-'):' ';
const flagsCell=hasFlags?(row.flags||[]).join(','):' ';
tr.innerHTML=`<td>${i+1}</td><td>${row.key}</td><td>${row.count!=null?row.count:0}</td>${hasAge?`<td>${ageCell}</td>`:''}${hasFlags?`<td>${flagsCell}</td>`:''}`;
} tb.appendChild(tr);
});
tbl.appendChild(tb);
body.appendChild(tbl);
}
    } else if (tab === 'wscats') {
      if (!data.wsCats || !data.wsCats.categories || Object.keys(data.wsCats.categories).length===0) {
        body.appendChild(_el('div','qt-diag-empty','No WS category data.'));
      } else {
        const tbl = _el('table','qt-diag-table');
        tbl.innerHTML = '<thead><tr><th>Category</th><th>Count</th><th>Rate/min</th><th>Last</th></tr></thead>';
        const tb = _el('tbody');
        Object.keys(data.wsCats.categories).sort().forEach(cat => {
          const c = data.wsCats.categories[cat];
          const last = c.lastTs ? new Date(c.lastTs).toLocaleTimeString() : '-';
          const tr = _el('tr');
          tr.innerHTML = `<td>${cat}</td><td>${c.count}</td><td>${c.ratePerMin}</td><td>${last}</td>`;
          tb.appendChild(tr);
        });
        tbl.appendChild(tb); body.appendChild(tbl);
      }
    } else if (tab === 'lastused') {
      if (!data.lastUsed.length) body.appendChild(_el('div','qt-diag-empty','No lastUsed data (enableTextLastUsed).'));
      else {
        const tbl = _el('table','qt-diag-table');
        tbl.innerHTML = '<thead><tr><th>#</th><th>Key</th><th>LastUsed(msAgo)</th><th>Age</th></tr></thead>';
        const tb = _el('tbody');
        data.lastUsed.slice(0,60).forEach((row,i)=>{
          const age = row.ageMs;
          const tr = _el('tr');
          tr.innerHTML = `<td>${i+1}</td><td>${row.key}</td><td>${age}</td><td>${_formatMs(age)}</td>`;
          tb.appendChild(tr);
        });
        tbl.appendChild(tb);
        body.appendChild(tbl);
      }
    } else if (tab === 'prefix') {
      if (typeof window.exportTextPrefixHeat !== 'function') {
        body.appendChild(_el('div','qt-diag-empty','Prefix heat module not loaded.'));
      } else {
        try {
          const res = window.exportTextPrefixHeat({ depth:1, topKeyN:3 });
          if (!res.items.length) body.appendChild(_el('div','qt-diag-empty','No prefix data.'));
          else {
            const tbl = _el('table','qt-diag-table');
            tbl.innerHTML = '<thead><tr><th>#</th><th>Prefix</th><th>Total</th><th>Keys</th><th>Avg</th><th>TopKeys</th></tr></thead>';
            const tb = _el('tbody');
            res.items.slice(0,60).forEach((row,i)=>{
              const topKeys = (row.topKeys||[]).map(t=>`${t.key}(${t.count})`).join(',');
              const tr = _el('tr');
              tr.innerHTML = `<td>${i+1}</td><td>${row.prefix}</td><td>${row.totalCount}</td><td>${row.keyCount}</td><td>${row.avgCount}</td><td>${topKeys}</td>`;
              tb.appendChild(tr);
            });
            tbl.appendChild(tb);
            body.appendChild(tbl);
          }
        } catch(_){ body.appendChild(_el('div','qt-diag-empty','Prefix heat error.')); }
      }
    } else if (tab === 'cleanup') {
      if (typeof window.exportTextCleanupSuggest !== 'function') {
        body.appendChild(_el('div','qt-diag-empty','Cleanup suggest module not loaded.'));
      } else {
        try {
          const res = window.exportTextCleanupSuggest({ threshold:0, minPrefixTotal:5 });
          if (!res.items.length) body.appendChild(_el('div','qt-diag-empty','No cleanup suggestions.'));
          else {
            const tbl = _el('table','qt-diag-table');
            tbl.innerHTML = '<thead><tr><th>#</th><th>Kind</th><th>Target</th><th>Score</th><th>Reasons</th><th>Flags</th></tr></thead>';
            const tb = _el('tbody');
            res.items.slice(0,80).forEach((row,i)=>{
              const tr = _el('tr');
              tr.innerHTML = `<td>${i+1}</td><td>${row.kind}</td><td>${row.target}</td><td>${row.score}</td><td>${row.reasons.join(',')}</td><td>${row.flags.join(',')}</td>`;
              tb.appendChild(tr);
            });
            tbl.appendChild(tb);
            body.appendChild(tbl);
          }
        } catch(_){ body.appendChild(_el('div','qt-diag-empty','Cleanup suggest error.')); }
      }
    }
  }

  function _activateTab(tab){
    if (!_panel) return;
    const tabs = _panel.querySelectorAll('.qt-diag-tabs button');
    tabs.forEach(btn=>{ if (btn.dataset.tab === tab) btn.classList.add('active'); else btn.classList.remove('active'); });
    _panel.setAttribute('data-tab-active', tab);
    _render();
  }

  function _makePanel(options){
    const p = _el('div','qt-diag');
    p.innerHTML = `<div class="qt-diag-header"><span class="qt-diag-title">Diagnostics</span><div class="qt-diag-actions"><button data-act="min">_</button><button data-act="close">×</button></div></div><div class="qt-diag-tabs"><button data-tab="usage" class="active">Usage</button><button data-tab="missing">Missing</button><button data-tab="ws">WS</button><button data-tab="unused">Unused</button><button data-tab="wscats">WSCats</button><button data-tab="lastused">LastUsed</button><button data-tab="prefix">Prefix</button><button data-tab="cleanup">Cleanup</button></div><div class="qt-diag-body"></div>`;
    document.body.appendChild(p);
    return p;
  }

  function _attachEvents(){
    const header = _panel.querySelector('.qt-diag-header');
    header.addEventListener('mousedown', e=>{ _drag.active = true; _drag.dx = e.clientX - _panel.offsetLeft; _drag.dy = e.clientY - _panel.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', e=>{ if (!_drag.active) return; _panel.style.left = (e.clientX - _drag.dx) + 'px'; _panel.style.top = (e.clientY - _drag.dy) + 'px'; });
    document.addEventListener('mouseup', ()=>{ _drag.active = false; });
    _panel.addEventListener('click', e=>{
      const act = e.target.getAttribute('data-act');
      if (act === 'close'){ window.hideDiagnosticsPanel(); }
      if (act === 'min'){ _panel.classList.toggle('qt-diag-min'); }
      const tab = e.target.getAttribute('data-tab'); if (tab) _activateTab(tab);
    });
  }

  function _ensureStyle(){
    if (document.getElementById('qt-diag-style')) return;
    const style = _el('style'); style.id = 'qt-diag-style';
    style.textContent = `.qt-diag{position:fixed;right:16px;bottom:16px;width:430px;font:12px/1.4 system-ui,Arial,sans-serif;background:#111;color:#eee;border:1px solid #444;z-index:99999;box-shadow:0 4px 18px rgba(0,0,0,.4);border-radius:6px;display:flex;flex-direction:column;}
.qt-diag-min{height:32px !important;overflow:hidden;}
.qt-diag-header{cursor:move;user-select:none;background:#222;padding:4px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #333;}
.qt-diag-title{font-weight:600;font-size:13px;}
.qt-diag-actions button{background:#333;color:#eee;border:0;padding:2px 6px;margin-left:4px;cursor:pointer;border-radius:3px;font-size:12px;}
.qt-diag-actions button:hover{background:#555;}
.qt-diag-tabs{display:flex;border-bottom:1px solid #333;flex-wrap:wrap;}
.qt-diag-tabs button{flex:1;background:#1b1b1b;border:0;color:#bbb;padding:4px 0;cursor:pointer;font-size:12px;}
.qt-diag-tabs button.active{background:#2d2d2d;color:#fff;font-weight:600;}
.qt-diag-body{padding:6px;overflow:auto;max-height:360px;}
.qt-diag-table{width:100%;border-collapse:collapse;font-size:11px;}
.qt-diag-table th, .qt-diag-table td{border:1px solid #333;padding:2px 4px;text-align:left;}
.qt-diag-empty{padding:8px;color:#888;}
.qt-diag-list{margin:0;padding:0 0 4px 14px;max-height:300px;overflow:auto;}
.qt-diag-ws .qt-diag-subtitle{margin-top:6px;font-weight:600;font-size:12px;}
.qt-diag-events{margin:4px 0 0 0;padding:0 0 0 14px;max-height:140px;overflow:auto;font-size:11px;}
`;
    document.head.appendChild(style);
  }

  function showDiagnosticsPanel(options){
    options = options || {}; const refresh = options.refreshInterval || DEFAULT_REFRESH;
    if (!_panel){
      _ensureStyle();
      _panel = _makePanel(options);
      _attachEvents();
      _activateTab('usage');
    }
    if (_timer) clearInterval(_timer);
    _timer = setInterval(_render, refresh);
    _render();
    return true;
  }

  function hideDiagnosticsPanel(){
    if (_timer){ clearInterval(_timer); _timer = null; }
    if (_panel){ _panel.remove(); _panel = null; }
  }

  window.showDiagnosticsPanel = showDiagnosticsPanel;
  window.hideDiagnosticsPanel = hideDiagnosticsPanel;

  console.log('✅ diagnostics-panel 已加载 (showDiagnosticsPanel)');
})();
