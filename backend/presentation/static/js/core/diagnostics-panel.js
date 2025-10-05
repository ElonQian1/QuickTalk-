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

  /* Preferences persistence (optional). 如果 diagnostics-prefs.js 已加载，则可保存/恢复面板参数 */
  function _savePrefsPartial(kind, obj){
    try {
      if (!window.loadDiagnosticsPrefs || !window.saveDiagnosticsPrefs) return;
      const all = window.loadDiagnosticsPrefs() || {};
      all[kind] = Object.assign({}, obj);
      window.saveDiagnosticsPrefs(all);
    } catch(_){ }
  }
  function _loadAndApplyPrefs(){
    try {
      if (!window.loadDiagnosticsPrefs) return;
      const p = window.loadDiagnosticsPrefs() || {};
      _ensureDefaultConfigs();
      if (p.spike) Object.assign(_panel.__SPIKE_CFG, p.spike);
      if (p.catSpike) Object.assign(_panel.__CAT_SPIKE_CFG, p.catSpike);
      if (p.unused) Object.assign(window.__UNUSED_DIAG_CFG, p.unused);
      if (p.prefix) Object.assign(window.__PREFIX_HEAT_CFG, p.prefix);
    } catch(_){ }
  }

  function _ensureDefaultConfigs(){
    if (_panel){
  if (!_panel.__SPIKE_CFG) _panel.__SPIKE_CFG = { factorMin:2.5, rateMin:0.2, topN:5, sustainMin:2, baselineMode:'median', recoveryWindowMs:30000 };
  if (!_panel.__CAT_SPIKE_CFG) _panel.__CAT_SPIKE_CFG = { factorMin:2.0, rateMinPerMin:0.5, topN:8, sustainMin:2, baselineMode:'median', recoveryWindowMs:30000 };
    }
    if (!window.__UNUSED_DIAG_CFG) window.__UNUSED_DIAG_CFG = { threshold:0, maxAgeMs:'', mode:'or' };
    if (!window.__PREFIX_HEAT_CFG) window.__PREFIX_HEAT_CFG = { depth:1, topN:3 };
  }

  function _el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className = cls; if(text) e.textContent = text; return e; }

  // ===== WS 渲染拆分函数（重新注入，之前误被移除） =====
  function _collectWsPrefetched(){
    const out={};
    try { if (typeof window.exportWsMetrics==='function') out.metrics=window.exportWsMetrics(); } catch(_){ }
    try { if (typeof window.exportWsHeartbeatQuality==='function') out.heartbeatQuality=window.exportWsHeartbeatQuality(); } catch(_){ }
    try { if (typeof window.exportWsEventRates==='function') out.eventRates=window.exportWsEventRates(); } catch(_){ }
    try { if (typeof window.exportWsHeartbeatLatencyStats==='function') out.rttStats=window.exportWsHeartbeatLatencyStats(); } catch(_){ }
    try { if (typeof window.exportWsHeartbeatTrend==='function') out.rttTrend=window.exportWsHeartbeatTrend(); } catch(_){ }
    try { if (typeof window.exportWsHealthScore==='function') out.healthScore=window.exportWsHealthScore({ prefetched:{ wsMetrics:out.metrics, heartbeatQuality:out.heartbeatQuality } }); } catch(_){ }
    _ensureDefaultConfigs();
    try { if (typeof window.exportWsEventSpikes==='function' && out.eventRates){ const cfg=_panel.__SPIKE_CFG; out.spikes = window.exportWsEventSpikes({ factorMin:cfg.factorMin, rateMin:cfg.rateMin, topN:cfg.topN, sustainMin:cfg.sustainMin, baselineMode:cfg.baselineMode, recoveryWindowMs:cfg.recoveryWindowMs, prefetchedRates:out.eventRates }); } } catch(_){ }
    return out;
  }
  function _wsRenderHeartbeatQuality(wrap, pf){ if (!pf.heartbeatQuality) return; const q=pf.heartbeatQuality; const badge=_el('div'); const color=q.level==='good'?'#2e8b57':(q.level==='warning'?'#b8860b':'#b22222'); badge.style.cssText='margin:4px 0 8px;padding:4px 6px;border:1px solid #333;border-radius:4px;font-size:11px;display:inline-block;background:#1c1c1c;'; badge.innerHTML=`<span style="display:inline-block;margin-right:6px;padding:2px 6px;border-radius:3px;background:${color};color:#fff;font-weight:600;">${q.level}</span><span>p50=${q.metrics.p50||'-'} p90=${q.metrics.p90||'-'} jitter=${q.metrics.jitter||'-'}</span>`; wrap.appendChild(badge); }
  function _wsRenderHealthScore(wrap, pf){ if (!pf.healthScore) return; const hs=pf.healthScore; const badge=_el('div'); const color=hs.score>=85?'#2e8b57':(hs.score>=70?'#b8860b':'#b22222'); badge.style.cssText='margin:4px 0 6px;padding:5px 8px;border:1px solid #333;border-radius:5px;font-size:11px;display:flex;flex-direction:column;background:#181818;gap:4px;'; const encoded=encodeURIComponent(JSON.stringify(hs)); const hasRecov=typeof hs.breakdown.recovery==='number'; const brStr=`(R ${hs.breakdown.reconnect} | H ${hs.breakdown.heartbeat} | G ${hs.breakdown.spikesGlobal} | C ${hs.breakdown.spikesCategory}${hasRecov? ' | Rv '+hs.breakdown.recovery:''})`; badge.innerHTML=`<div style="display:flex;align-items:center;gap:8px;"><span data-hs-detail="${encoded}" style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-weight:600;cursor:pointer;" title="点击查看健康评分明细">Health ${hs.score}</span><span style="opacity:.8;">${brStr}</span></div>`; wrap.appendChild(badge); }
  // 派生健康权重：若 hs.weights 不存在，用 breakdown 相对值近似
  function _deriveHealthWeights(hs){
    if (hs && hs.weights && Object.keys(hs.weights).length) return hs.weights;
    const bd = (hs && hs.breakdown) ? hs.breakdown : {};
    const vals = Object.entries(bd).filter(([k,v])=> typeof v === 'number' && v>=0);
    if (!vals.length) return {};
    // 为避免总分偏差，先做线性归一化：w_i = v_i / sum(v_i)
    const sum = vals.reduce((a,[,v])=> a+v,0) || 1;
    const derived={};
    vals.forEach(([k,v])=>{ derived[k] = +(v / sum).toFixed(3); });
    return derived;
  }
  function _buildHealthDetailHtml(hs){
    const rowsBreak = Object.keys(hs.breakdown||{}).map(k=>`<tr><td>${k}</td><td>${hs.breakdown[k]}</td></tr>`).join('')||'<tr><td colspan=2>-</td></tr>';
    const weights = _deriveHealthWeights(hs);
    const rowsW = Object.keys(weights).map(k=>`<tr><td>${k}</td><td>${weights[k]}</td></tr>`).join('')||'<tr><td colspan=2>-</td></tr>';
    const sugg = [];
    if (hs.breakdown){
      if (hs.breakdown.reconnect < 70) sugg.push('Reconnect reliability low: 检查网络抖动与重连退避策略');
      if (hs.breakdown.heartbeat < 70) sugg.push('Heartbeat 延迟波动高: 优化心跳间隔或监控 RTT outliers');
      if (hs.breakdown.spikesGlobal < 70) sugg.push('全局事件 spikes 频繁: 考虑速率限制或批处理');
      if (hs.breakdown.spikesCategory < 70) sugg.push('某类事件分类 spikes 频繁: 针对该分类做流控/缓存');
    }
    if (!sugg.length) sugg.push('暂无明显风险，保持观察');
    const suggHtml = sugg.map(s=>`<li>${s}</li>`).join('');
    const derivedFlag = (hs.weights && Object.keys(hs.weights).length) ? '' : `<div class='sec' style='color:#888;font-size:11px;'>* weights 为根据 breakdown 比例临时推导</div>`;
    return `<div class='sec'><b>Total:</b> ${hs.score}</div>
      <div class='sec'><b>Breakdown</b><table><thead><tr><th>Part</th><th>Score</th></tr></thead><tbody>${rowsBreak}</tbody></table></div>
      <div class='sec'><b>Weights</b><table><thead><tr><th>Part</th><th>Weight</th></tr></thead><tbody>${rowsW}</tbody></table></div>
      ${derivedFlag}
      <div class='sec'><b>Suggestions</b><ul>${suggHtml}</ul></div>`;
  }
  // 恢复密度分析：统计近 2 分钟内是否出现高密度恢复“簇”
  function _wsAnalyzeRecoveryDensity(){
    try {
      const tracker=window.__SPIKE_STREAK_TRACKER__;
      if (!(tracker && Array.isArray(tracker.__recoveryLog))) return null; // 需要假设 recovery 事件以时间戳 push 到 __recoveryLog
      const now=Date.now();
      const horizonMs=2*60*1000; // 2 分钟观测窗口
      const windowEvents=tracker.__recoveryLog.filter(ts=> now-ts <= horizonMs);
      if (windowEvents.length < 3) return null; // 低于 3 次不判断密度
      // 滑动簇检测：任意 30s 窗口内 >= clusterThreshold 视为高密度
      const clusterWin=30*1000;
      const clusterThreshold=3;
      let clusters=[];
      let sorted=[...windowEvents].sort((a,b)=>a-b);
      let i=0;
      for (let j=0;j<sorted.length;j++){
        while(sorted[j]-sorted[i] > clusterWin) i++;
        const spanCnt=j-i+1;
        if (spanCnt >= clusterThreshold){
          clusters.push({ start:sorted[i], end:sorted[j], count:spanCnt });
        }
      }
      if (!clusters.length) return null;
      // 合并重叠簇
      clusters.sort((a,b)=>a.start-b.start);
      const merged=[clusters[0]];
      for (let k=1;k<clusters.length;k++){
        const last=merged[merged.length-1];
        const cur=clusters[k];
        if (cur.start <= last.end){
          last.end=Math.max(last.end, cur.end);
          last.count=Math.max(last.count, cur.count); // 保留最大密度
        } else merged.push(cur);
      }
      const maxDensity=Math.max(...merged.map(c=>c.count));
      return { total: windowEvents.length, clusters: merged, maxDensity };
    } catch(_){ return null; }
  }
  // 在恢复概览中插入密度徽章
  function _wsInjectRecoveryDensity(bar){
    const dens=_wsAnalyzeRecoveryDensity();
    if (!dens) return;
    const worst=dens.maxDensity;
    let color='#2e8b57';
    if (worst>=5) color='#b22222'; else if (worst>=4) color='#b8860b';
    const badge=document.createElement('span');
    badge.style.cssText=`margin-left:6px;background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;cursor:default;`;
    const titleParts = dens.clusters.map(c=>{ const dur=c.end-c.start; return `${new Date(c.start).toLocaleTimeString()} +${(dur/1000).toFixed(0)}s x${c.count}`; });
    badge.title = `过去2分钟恢复次数:${dens.total}\n高密度簇:${dens.clusters.length}\n` + titleParts.join('\n');
    badge.textContent = `RecDensity x${worst}`;
    bar.appendChild(badge);
  }
  // Recovery 概览（含密度徽章）
  function _wsRenderRecoverySummary(wrap){
    try {
      const tracker=window.__SPIKE_STREAK_TRACKER__;
      if (!(tracker&&tracker.recoveryStats)) return;
      const stat5=tracker.recoveryStats(5*60*1000);
      const stat15=tracker.recoveryStats(15*60*1000);
      const stat60=tracker.recoveryStats(60*60*1000);
      const bar=_el('div','qt-rec-summary');
      bar.innerHTML=`<span style="font-weight:600;">Recovery</span><span>5m ${stat5.count}/${stat5.keysAffected}</span><span>15m ${stat15.count}/${stat15.keysAffected}</span><span>60m ${stat60.count}/${stat60.keysAffected}</span><button data-rec-timeline style="margin-left:auto;background:#2e2e2e;border:1px solid #444;color:#bbb;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:11px;" title="查看15分钟恢复时间线">TL</button>`;
      _wsInjectRecoveryDensity(bar);
      wrap.appendChild(bar);
    } catch(_){ }
  }
  function _wsRenderBaseMetrics(wrap, data){ const m=data.ws.metrics||{}; const d=data.ws.derived||{}; const baseInfo=[["Attempts",m.reconnectAttempts],["Successes",m.reconnectSuccesses],["SuccessRate",d.successRate],["MeanAttempts/Success",d.meanAttemptsPerSuccess],["FailureStreak",d.failureStreak],["MaxFailureStreak",d.maxFailureStreak],["LastSuccessAge",_formatMs(d.lastSuccessAgeMs)]]; const mt=_el('table','qt-diag-table'); mt.innerHTML='<thead><tr><th>Metric</th><th>Value</th></tr></thead>'; const tb=_el('tbody'); baseInfo.forEach(p=>{ const tr=_el('tr'); tr.innerHTML=`<td>${p[0]}</td><td>${p[1]??'-'}</td>`; tb.appendChild(tr); }); mt.appendChild(tb); wrap.appendChild(mt); }
  function _wsRenderEventRates(wrap, pf){ const r=pf.eventRates; if (!(r&&r.windows)) return; try { if (window.__WS_SPARK_HIST__?.recordWindows) window.__WS_SPARK_HIST__.recordWindows(r.windows); } catch(_){ } const tbl=_el('table','qt-diag-table'); tbl.style.marginTop='6px'; tbl.innerHTML='<thead><tr><th colspan="4">Event Rates</th></tr><tr><th>Window</th><th>Count</th><th>Rate/s</th><th>Newest Age</th></tr></thead>'; const tb=_el('tbody'); r.windows.forEach(w=>{ const newest=w.newestTs?_formatMs(Date.now()-w.newestTs):'-'; const tr=_el('tr'); tr.innerHTML=`<td>${(w.windowMs/1000).toFixed(0)}s</td><td>${w.count}</td><td>${w.ratePerSec}</td><td>${newest}</td>`; tb.appendChild(tr); }); tbl.appendChild(tb); wrap.appendChild(tbl); }
  function _wsRenderSpikes(wrap, pf){ const cfg=_panel.__SPIKE_CFG; const controls=_el('div'); controls.style.cssText='margin:6px 0 2px;display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;font-size:11px;'; controls.innerHTML=`<label style="display:flex;flex-direction:column;gap:2px;">factorMin<input data-sp-f style="width:60px" value="${cfg.factorMin}"></label><label style="display:flex;flex-direction:column;gap:2px;">rateMin<input data-sp-r style="width:60px" value="${cfg.rateMin}"></label><label style="display:flex;flex-direction:column;gap:2px;">topN<input data-sp-n style="width:50px" value="${cfg.topN}"></label><label style="display:flex;flex-direction:column;gap:2px;">sustainMin<input data-sp-s style="width:50px" value="${cfg.sustainMin}"></label><label style="display:flex;flex-direction:column;gap:2px;">baseline<div style="display:flex;align-items:center;gap:4px;"><select data-sp-bm style="width:98px"><option value="median" ${cfg.baselineMode==='median'?'selected':''}>median</option><option value="trimmedMean" ${cfg.baselineMode==='trimmedMean'?'selected':''}>trimmedMean</option></select><button data-bm-help style="width:20px;height:20px;line-height:18px;padding:0;font-size:12px;background:#2f2f2f;border:1px solid #444;color:#bbb;border-radius:3px;cursor:pointer;">?</button></div></label><label style="display:flex;flex-direction:column;gap:2px;">recoveryMs<input data-sp-rw style="width:80px" value="${cfg.recoveryWindowMs||30000}"></label><button data-sp-apply style="background:#333;border:1px solid #444;color:#ccc;height:24px;padding:0 10px;border-radius:4px;cursor:pointer;">Apply</button>`; controls.addEventListener('click', e=>{ if (e.target && e.target.getAttribute('data-sp-apply')!=null){ const f=parseFloat(controls.querySelector('[data-sp-f]').value)||2.5; const r=parseFloat(controls.querySelector('[data-sp-r]').value)||0.2; const n=parseInt(controls.querySelector('[data-sp-n]').value)||5; const s=parseInt(controls.querySelector('[data-sp-s]').value)||2; const bmSel=controls.querySelector('[data-sp-bm]'); const bm=bmSel? bmSel.value:'median'; const rw=parseInt(controls.querySelector('[data-sp-rw]').value)||30000; _panel.__SPIKE_CFG={ factorMin:f, rateMin:r, topN:Math.min(10,Math.max(1,n)), sustainMin:Math.max(1,s), baselineMode:(bm==='trimmedMean'?'trimmedMean':'median'), recoveryWindowMs:Math.max(1000,rw)}; _savePrefsPartial('spike', _panel.__SPIKE_CFG); _render(); }}); wrap.appendChild(controls); const sp=pf.spikes; if (!(sp&&sp.items&&sp.items.length)) return; const tbl=_el('table','qt-diag-table'); tbl.style.marginTop='2px'; tbl.innerHTML=`<thead><tr><th colspan="10">Event Spikes (mode=${cfg.baselineMode} ${(sp.baselineWindowMs/1000).toFixed(0)}s rate=${sp.baselineRate.toFixed(3)})</th></tr><tr><th>#</th><th>Window</th><th>Rate/s</th><th>Count</th><th>xBaseline</th><th>Streak</th><th>Sustained</th><th>Recover</th><th>RecAge</th><th>Spark</th></tr></thead>`; const tb=_el('tbody'); sp.items.forEach((it,i)=>{ const tr=_el('tr'); const recAge=it.lastRecoveryTs?_formatMs(Date.now()-it.lastRecoveryTs):'-'; let spark=''; try { const hist=window.__WS_SPARK_HIST__? window.__WS_SPARK_HIST__.getWindowHistory(it.windowMs):[]; spark=_renderSpikeSpark(hist); } catch(_){ spark='—'; } tr.innerHTML=`<td>${i+1}</td><td>${(it.windowMs/1000).toFixed(0)}s</td><td>${it.rate}</td><td>${it.count}</td><td>${it.factor}</td><td>${it.streak||1}</td><td>${it.sustained?'✔':'-'}</td><td>${it.recovering? 'R':''}</td><td>${recAge}</td><td style="font-family:monospace;">${spark}</td>`; tb.appendChild(tr); }); tbl.appendChild(tb); wrap.appendChild(tbl); }
  // 迷你 sparkline 抽象：将一组数值映射为最高 12 长度的密度字符
  function _miniSparkline(values){
    if (!Array.isArray(values) || values.length<2) return '—';
    const chars='▁▂▃▄▅▆▇█';
    const slice=values.slice(-12);
    const min=Math.min(...slice); const max=Math.max(...slice);
    if (max===min) return '—';
    return slice.map(v=>{
      const ratio=(v-min)/(max-min);
      const idx=Math.min(chars.length-1, Math.floor(ratio*(chars.length-1)));
      return chars[idx];
    }).join('');
  }
  // 替换 spikes 内联 spark 逻辑：留一个包装函数便于未来注入颜色/趋势符号
  function _renderSpikeSpark(hist){ return _miniSparkline(hist||[]); }
  // 更新 _wsRenderSpikes 内部使用 _renderSpikeSpark
  function _wsRenderRecentEvents(wrap, data){ const title=_el('div','qt-diag-subtitle','Recent Events'); const ul=_el('ul','qt-diag-events'); (data.ws.events||[]).slice(-15).reverse().forEach(ev=>{ const li=_el('li'); li.textContent=`${new Date(ev.t).toLocaleTimeString()} ${ev.evt}`; ul.appendChild(li); }); wrap.appendChild(title); wrap.appendChild(ul); }
  function _wsRenderRttStats(wrap, pf){ const r=pf.rttStats; if (!r) return; const tbl=_el('table','qt-diag-table'); tbl.style.marginTop='6px'; tbl.innerHTML='<thead><tr><th colspan="7">Heartbeat RTT (ms)</th></tr><tr><th>Count</th><th>p50</th><th>p90</th><th>p99</th><th>Mean</th><th>Max</th><th>Jitter</th></tr></thead>'; const tb=_el('tbody'); const tr=_el('tr'); const cells=[r.count,r.p50,r.p90,r.p99,r.mean,r.max,r.jitter].map(v=> v==null?' - ':v); tr.innerHTML=cells.map(v=>`<td>${v}</td>`).join(''); tb.appendChild(tr); tbl.appendChild(tb); wrap.appendChild(tbl); }
  function _wsRenderRttTrend(wrap, pf){ const t=pf.rttTrend; if (!(t&&t.points&&t.points.length)) return; const tbl=_el('table','qt-diag-table'); tbl.style.marginTop='6px'; tbl.innerHTML='<thead><tr><th colspan="5">RTT Trend (recent)</th></tr><tr><th>Time</th><th>p50</th><th>p90</th><th>Jitter</th><th>Count</th></tr></thead>'; const tb=_el('tbody'); t.points.slice(-8).forEach(pt=>{ const tr=_el('tr'); tr.innerHTML=`<td>${new Date(pt.ts).toLocaleTimeString()}</td><td>${pt.p50??'-'}</td><td>${pt.p90??'-'}</td><td>${pt.jitter??'-'}</td><td>${pt.count}</td>`; tb.appendChild(tr); }); tbl.appendChild(tb); wrap.appendChild(tbl); }
  function _renderTabWs(data, body){ const wrap=_el('div','qt-diag-ws'); const pf=_collectWsPrefetched(); _wsRenderHeartbeatQuality(wrap,pf); _wsRenderHealthScore(wrap,pf); _wsRenderRecoverySummary(wrap); _wsRenderBaseMetrics(wrap,data); _wsRenderEventRates(wrap,pf); _wsRenderSpikes(wrap,pf); _wsRenderRecentEvents(wrap,data); _wsRenderRttStats(wrap,pf); _wsRenderRttTrend(wrap,pf); body.appendChild(wrap); }

    function _buildKeyBacktrace(key){
      const info = { key, usage:null, lastUsed:null, unusedFlags:null, prefix:null, validateIssues:[] };
      try {
        if (typeof window.exportTextUsageStats==='function'){
          const arr = window.exportTextUsageStats({ reset:false })||[]; const row = arr.find(r=>r.key===key); if (row) info.usage = row.count;
        }
        if (typeof window.exportTextLastUsedStats==='function'){
          const lu = window.exportTextLastUsedStats()||[]; const row = lu.find(r=>r.key===key); if (row) info.lastUsed = row.ageMs;
        }
        if (typeof window.exportUnusedTextKeys==='function'){
          const cfg = window.__UNUSED_DIAG_CFG || { threshold:0, maxAgeMs:null, mode:'or' };
          const u = window.exportUnusedTextKeys({ threshold:cfg.threshold, maxAgeMs:cfg.maxAgeMs, mode:cfg.mode, includeUsageCounts:true, includeAge:true});
          const row = (u.unused||[]).find(r=>r.key===key); if (row) info.unusedFlags = row.flags;
        }
        if (typeof window.exportTextPrefixHeat==='function'){
          const ph = window.exportTextPrefixHeat({ depth:1, topKeyN:1 });
          const delim = ph.delimiter || '_';
          info.prefix = key.split(delim)[0];
        }
        if (typeof window.validateStateTextsSchema==='function'){
          const issues = window.validateStateTextsSchema({ silent:true })||[];
          info.validateIssues = issues.filter(is=> (is.key && is.key===key) || (is.prefix && key.startsWith(is.prefix+'_')) );
        }
      } catch(_){ }
      return info;
    }

    function _showBacktrace(info){
      const flags = info.unusedFlags && info.unusedFlags.length? info.unusedFlags.join(',') : '-';
      const issues = (info.validateIssues||[]).map(i=>i.type).join(',') || '-';
      const html = `<div style='display:grid;grid-template-columns:auto 1fr;row-gap:4px;column-gap:8px;font-size:12px;'>
        <div style='font-weight:600;'>Key</div><div>${info.key}</div>
        <div style='font-weight:600;'>Usage Count</div><div>${info.usage!=null?info.usage:'-'}</div>
        <div style='font-weight:600;'>Age(msAgo)</div><div>${info.lastUsed!=null?info.lastUsed:'-'}</div>
        <div style='font-weight:600;'>Unused Flags</div><div>${flags}</div>
        <div style='font-weight:600;'>Prefix</div><div>${info.prefix||'-'}</div>
        <div style='font-weight:600;'>Validate Issues</div><div>${issues}</div>
      </div>`;
      _openOverlay('qt-backtrace-overlay', { title:'Key Backtrace', html });
    }
  // 计算两份 snapshot 差异（浅/中度递归）：仅比较对象/数组/原始值，忽略函数与循环引用。
  function _diffSnapshots(oldSnap, newSnap, path){
    path = path || '';
    const added = []; const removed = []; const changed = [];
    function _isObj(o){ return o && typeof o==='object' && !Array.isArray(o); }
    const oKeys = _isObj(oldSnap)? Object.keys(oldSnap) : [];
    const nKeys = _isObj(newSnap)? Object.keys(newSnap) : [];
    // Removed
    oKeys.forEach(k=>{ if (!nKeys.includes(k)) removed.push(path+k); });
    // Added & Changed
    nKeys.forEach(k=>{
      const full = path+k;
      if (!oKeys.includes(k)){ added.push(full); return; }
      const ov = oldSnap[k]; const nv = newSnap[k];
      if (ov === nv) return;
      if (_isObj(ov) && _isObj(nv)){
        const sub = _diffSnapshots(ov,nv, full+'.');
        added.push.apply(added, sub.added);
        removed.push.apply(removed, sub.removed);
        changed.push.apply(changed, sub.changed);
      } else if (Array.isArray(ov) && Array.isArray(nv)){
        if (ov.length !== nv.length || ov.some((v,i)=> v!==nv[i])) changed.push(full);
      } else {
        changed.push(full);
      }
    });
    return { added, removed, changed };
  }
  // 展开结构生成字段级差异列表 (added/removed/changed)，包含新旧值截断
  function _flattenDiffDetailed(oldSnap, newSnap){
    const diff = _diffSnapshots(oldSnap, newSnap, '');
    const lookupOld = {};
    const lookupNew = {};
    function walk(obj, base, store){
      if (obj && typeof obj==='object'){
        if (Array.isArray(obj)){
          store[base] = obj; // 记录整体数组
          obj.forEach((v,i)=> walk(v, base? base+'['+i+']':'['+i+']', store));
        } else {
          Object.keys(obj).forEach(k=> walk(obj[k], base? base+k+'.': k+'.', store));
        }
      } else {
        store[base.replace(/\.$/,'')] = obj;
      }
    }
    walk(oldSnap,'',lookupOld); walk(newSnap,'',lookupNew);
    function preview(v){
      if (v==null) return 'null';
      if (typeof v==='object'){
        try { return JSON.stringify(v).slice(0,60)+(JSON.stringify(v).length>60?'…':''); } catch(_){ return '[obj]'; }
      }
      const s=String(v); return s.length>60? s.slice(0,60)+'…': s;
    }
    const rows=[];
    diff.added.forEach(p=> rows.push({ path:p, type:'added', oldVal:'', newVal:preview(lookupNew[p]) }));
    diff.removed.forEach(p=> rows.push({ path:p, type:'removed', oldVal:preview(lookupOld[p]), newVal:'' }));
    diff.changed.forEach(p=> rows.push({ path:p, type:'changed', oldVal:preview(lookupOld[p]), newVal:preview(lookupNew[p]) }));
    rows.sort((a,b)=> a.path.localeCompare(b.path));
    return { summary:diff, rows };
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
        tr.innerHTML = `<td>${i+1}</td><td data-diag-k="${row.key}">${row.key}</td><td>${row.count}</td>`;
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
      // Hot Growth 表格（使用 exportTextUsageHotspots）
      if (typeof window.exportTextUsageHotspots==='function'){
        try {
          const hs = window.exportTextUsageHotspots({ topN:10 });
          if (hs.items && hs.items.length){
            const hTbl = _el('table','qt-diag-table');
            hTbl.style.marginTop='6px';
            hTbl.innerHTML = `<thead><tr><th colspan="7">Hot Growth (interval ${hs.intervalMs}ms)</th></tr><tr><th>#</th><th>Key</th><th>Δ</th><th>Total</th><th>Prev</th><th>Δ%</th><th>Rate/s</th></tr></thead>`;
            const htb = _el('tbody');
            hs.items.forEach((r,i)=>{
              const tr = _el('tr');
              tr.innerHTML = `<td>${i+1}</td><td data-diag-k="${r.key}">${r.key}</td><td>${r.delta}</td><td>${r.total}</td><td>${r.prev}</td><td>${r.pct!=null?r.pct+'%':'-'}</td><td>${r.ratePerSec}</td>`;
              htb.appendChild(tr);
            });
            hTbl.appendChild(htb); body.appendChild(hTbl);
          }
        } catch(_){ }
      }
    } else if (tab === 'missing') {
      if (!data.missing.length) body.appendChild(_el('div','qt-diag-empty','No missing keys.'));
      else {
        const ul = _el('ul','qt-diag-list');
        data.missing.forEach(k=>{ const li = _el('li'); li.textContent = k; ul.appendChild(li); });
        body.appendChild(ul);
      }
    } else if (tab === 'ws') {
      _renderTabWs(data, body);
    } else if (tab === 'unused') {
      // 交互控件
      const cfg = window.__UNUSED_DIAG_CFG || (window.__UNUSED_DIAG_CFG = { threshold:0, maxAgeMs:'', mode:'or' });
      const controls = _el('div');
      controls.style.marginBottom='4px';
      controls.innerHTML = `Threshold <input data-u-th style="width:50px" value="${cfg.threshold}"> MaxAgeMs <input data-u-age style="width:90px" placeholder="null" value="${cfg.maxAgeMs===''||cfg.maxAgeMs==null?'':cfg.maxAgeMs}"> Mode <select data-u-mode><option value="or" ${cfg.mode==='or'?'selected':''}>or</option><option value="and" ${cfg.mode==='and'?'selected':''}>and</option></select> <button data-u-apply>Apply</button>`;
      body.appendChild(controls);
      controls.addEventListener('click', e=>{
        if (e.target && e.target.getAttribute('data-u-apply')!=null){
          const th = controls.querySelector('[data-u-th]').value.trim();
          const age = controls.querySelector('[data-u-age]').value.trim();
            const mode = controls.querySelector('[data-u-mode]').value;
          cfg.threshold = isNaN(parseInt(th,10))?0:parseInt(th,10);
          cfg.maxAgeMs = age===''? null : (isNaN(parseInt(age,10))? null : parseInt(age,10));
          cfg.mode = (mode==='and')?'and':'or';
          // 立即刷新
          _savePrefsPartial('unused', cfg);
          _render();
        }
      });
      if (!data.unused.length) body.appendChild(_el('div','qt-diag-empty','No unused keys (adjust filters).'));
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
tr.innerHTML=`<td>${i+1}</td><td data-diag-k="${row.key}">${row.key}</td><td>${row.count!=null?row.count:0}</td>${hasAge?`<td>${ageCell}</td>`:''}${hasFlags?`<td>${flagsCell}</td>`:''}`;
} tb.appendChild(tr);
});
tbl.appendChild(tb);
body.appendChild(tbl);
}
    } else if (tab === 'wscats') {
      if (!data.wsCats || !data.wsCats.categories || Object.keys(data.wsCats.categories).length===0) {
        body.appendChild(_el('div','qt-diag-empty','No WS category data.'));
      } else {
        // Category 风险评分骨架
        // Category 风险评分抽象：拆分单分类评分函数，便于后续调参/权重调整
        function _computeCategoryRiskScore(metrics){
          const rate = metrics.ratePerMin || 0; // 直接贡献
            const ageSec = metrics.lastTs? (Date.now()-metrics.lastTs)/1000 : 999999;
            const freshness = ageSec>3600?0:(ageSec>600?0.3:(ageSec>120?0.6:1));
            const countAdj = Math.min((metrics.count||0)/500, 0.5);
            const spikeAdj = (metrics.spikeFactor||0) * 0.9 + (metrics.spikeStreak||0)*0.05; // spike 影响：factor 优先, streak 次之
            const sustainAdj = metrics.spikeSustained? 0.2:0; // 有持续尖峰适度加权
            // 基础 + spike + freshness
            const score = rate + freshness*0.8 + countAdj + spikeAdj + sustainAdj;
            return +score.toFixed(3);
        }
        function _computeCategoryRisk(wsCats){
          if (!wsCats || !wsCats.categories) return [];
          const list = Object.keys(wsCats.categories).map(cat=>{
            const c = wsCats.categories[cat];
            const score = _computeCategoryRiskScore(c);
            const ageSec = c.lastTs? (Date.now()-c.lastTs)/1000 : 999999;
            const freshness = ageSec>3600?0:(ageSec>600?0.3:(ageSec>120?0.6:1));
            return { cat, score, rate:c.ratePerMin||0, count:c.count||0, lastTs:c.lastTs, freshness };
          });
          return list.sort((a,b)=> b.score - a.score);
        }
        // 风险/基本视图切换容器
        const viewCtrl=_el('div');
        viewCtrl.style.cssText='display:flex;align-items:center;gap:8px;margin:4px 0 6px;font-size:11px;';
        viewCtrl.innerHTML = `<button data-cat-view="basic" class="qt-btn-on" style="background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;">Basic</button><button data-cat-view="risk" style="background:#222;border:1px solid #444;color:#999;padding:2px 8px;border-radius:4px;cursor:pointer;">Risk</button><span style="opacity:.6;">Categories (window ${(data.wsCats.windowMs/1000)|0}s)</span>`;
        body.appendChild(viewCtrl);
        const tbl = _el('table','qt-diag-table'); body.appendChild(tbl);
        function renderCatBasic(){
          tbl.innerHTML = '<thead><tr><th>Category</th><th>Count</th><th>Rate/min</th><th>Last</th></tr></thead>';
          const tb=_el('tbody');
          Object.keys(data.wsCats.categories).sort().forEach(cat=>{
            const c=data.wsCats.categories[cat];
            const last=c.lastTs? new Date(c.lastTs).toLocaleTimeString():'-';
            const tr=_el('tr'); tr.innerHTML=`<td>${cat}</td><td>${c.count}</td><td>${c.ratePerMin}</td><td>${last}</td>`; tb.appendChild(tr);
          });
          tbl.appendChild(tb);
        }
        function renderCatRisk(){
          const riskArr=_computeCategoryRisk(data.wsCats);
          tbl.innerHTML = '<thead><tr><th>#</th><th>Category</th><th>RiskScore</th><th>Rate/m</th><th>Count</th><th>Freshness</th><th>Last</th></tr></thead>';
          const tb=_el('tbody');
          riskArr.forEach((r,i)=>{
            const last=r.lastTs? new Date(r.lastTs).toLocaleTimeString():'-';
            const freshTag = r.freshness>=0.95? 'hot': (r.freshness>=0.6? 'warm': (r.freshness>0? 'idle':'stale'));
            const tr=_el('tr'); tr.innerHTML=`<td>${i+1}</td><td>${r.cat}</td><td>${r.score}</td><td>${r.rate}</td><td>${r.count}</td><td>${freshTag}</td><td>${last}</td>`; tb.appendChild(tr);
          });
          tbl.appendChild(tb);
        }
        renderCatBasic();
        viewCtrl.addEventListener('click', e=>{
          if (e.target && e.target.getAttribute('data-cat-view')){
            viewCtrl.querySelectorAll('button[data-cat-view]').forEach(b=> b.classList.remove('qt-btn-on'));
            e.target.classList.add('qt-btn-on');
            const mode=e.target.getAttribute('data-cat-view');
            if (mode==='risk') renderCatRisk(); else renderCatBasic();
          }
        });
        // 分类 Spike 参数 + 表格
  _ensureDefaultConfigs();
        const ccfg = _panel.__CAT_SPIKE_CFG;
        const catCtrl = _el('div');
        catCtrl.style.cssText='margin:6px 0 4px;display:flex;flex-wrap:wrap;gap:6px;font-size:11px;align-items:flex-end;';
        catCtrl.innerHTML = `
          <label style="display:flex;flex-direction:column;gap:2px;">factorMin<input data-csf-f style="width:60px" value="${ccfg.factorMin}"></label>
          <label style="display:flex;flex-direction:column;gap:2px;">rateMin/m<input data-csf-r style="width:70px" value="${ccfg.rateMinPerMin}"></label>
          <label style="display:flex;flex-direction:column;gap:2px;">topN<input data-csf-n style="width:50px" value="${ccfg.topN}"></label>
          <label style="display:flex;flex-direction:column;gap:2px;">sustainMin<input data-csf-s style="width:60px" value="${ccfg.sustainMin}"></label>
          <label style="display:flex;flex-direction:column;gap:2px;">baseline<div style="display:flex;align-items:center;gap:4px;"><select data-csf-bm style="width:98px"><option value="median" ${ccfg.baselineMode==='median'?'selected':''}>median</option><option value="trimmedMean" ${ccfg.baselineMode==='trimmedMean'?'selected':''}>trimmedMean</option></select><button data-bm-help style="width:20px;height:20px;line-height:18px;padding:0;font-size:12px;background:#2f2f2f;border:1px solid #444;color:#bbb;border-radius:3px;cursor:pointer;">?</button></div></label>
          <label style="display:flex;flex-direction:column;gap:2px;">recoveryMs<input data-csf-rw style="width:80px" value="${ccfg.recoveryWindowMs||30000}"></label>
          <button data-csf-apply style="background:#333;border:1px solid #444;color:#ccc;height:24px;padding:0 10px;border-radius:4px;cursor:pointer;">Apply</button>`;
        catCtrl.addEventListener('click', e=>{
          if (e.target && e.target.getAttribute('data-csf-apply')!=null){
            const f = parseFloat(catCtrl.querySelector('[data-csf-f]').value)||2.0;
            const r = parseFloat(catCtrl.querySelector('[data-csf-r]').value)||0.5;
            const n = parseInt(catCtrl.querySelector('[data-csf-n]').value)||8;
            const s = parseInt(catCtrl.querySelector('[data-csf-s]').value)||2;
            const bmSel = catCtrl.querySelector('[data-csf-bm]');
            const bm = bmSel? bmSel.value : 'median';
            const rw = parseInt(catCtrl.querySelector('[data-csf-rw]').value)||30000;
            _panel.__CAT_SPIKE_CFG = { factorMin:f, rateMinPerMin:r, topN:Math.min(20,Math.max(1,n)), sustainMin:Math.max(1,s), baselineMode:(bm==='trimmedMean'?'trimmedMean':'median'), recoveryWindowMs:Math.max(1000,rw) };
            _savePrefsPartial('catSpike', _panel.__CAT_SPIKE_CFG);
            _render();
          }
        });
        body.appendChild(catCtrl);
        if (typeof window.exportWsEventCategorySpikes==='function'){
          try {
            const catSp = window.exportWsEventCategorySpikes({ factorMin:ccfg.factorMin, rateMinPerMin:ccfg.rateMinPerMin, topN:ccfg.topN, sustainMin:ccfg.sustainMin, baselineMode:ccfg.baselineMode, recoveryWindowMs:ccfg.recoveryWindowMs, prefetchedCategories:data.wsCats });
            // 将 spike 数据注入分类结构供风险评分使用
            try {
              if (catSp.items && data.wsCats && data.wsCats.categories){
                catSp.items.forEach(it=>{
                  const bucket = data.wsCats.categories[it.category];
                  if (bucket){ bucket.spikeFactor = Math.max(bucket.spikeFactor||0, it.factor||0); bucket.spikeStreak = it.streak||0; bucket.spikeSustained = !!it.sustained; }
                });
              }
            } catch(_){ }
            if (catSp.items && catSp.items.length){
              const sTbl = _el('table','qt-diag-table');
              sTbl.innerHTML = `<thead><tr><th colspan="10">Category Spikes (mode=${ccfg.baselineMode} rate/min=${catSp.baselineRate.toFixed(2)})</th></tr><tr><th>#</th><th>Category</th><th>Rate/min</th><th>Count</th><th>xBaseline</th><th>Streak</th><th>Sustained</th><th>Recover</th><th>RecAge</th><th>Spark</th></tr></thead>`;
              const stb = _el('tbody');
              catSp.items.forEach((it,i)=>{
                const tr=_el('tr');
                const recAge = it.lastRecoveryTs? _formatMs(Date.now()-it.lastRecoveryTs):'-';
                let spark='';
                try {
                  if (window.__WS_SPARK_HIST__){
                    // 记录分类历史（只在有 spikes 项时记录一次）
                    if (typeof window.__WS_SPARK_HIST__.recordCategories==='function') window.__WS_SPARK_HIST__.recordCategories(catSp.items);
                    const hist = window.__WS_SPARK_HIST__.getCategoryHistory(it.category);
                    if (hist.length>1){
                      const min=Math.min.apply(null,hist); const max=Math.max.apply(null,hist);
                      if (max>min){
                        const chars='▁▂▃▄▅▆▇█';
                        spark = hist.slice(-12).map(v=>{ const idx=Math.floor(((v-min)/(max-min))*(chars.length-1)); return chars[idx]; }).join('');
                      } else { spark='—'; }
                    }
                  }
                } catch(_){ }
                tr.innerHTML=`<td>${i+1}</td><td>${it.category}</td><td>${it.ratePerMin}</td><td>${it.count}</td><td>${it.factor}</td><td>${it.streak||1}</td><td>${it.sustained?'✔':'-'}</td><td>${it.recovering? 'R':''}</td><td>${recAge}</td><td style=\"font-family:monospace;\">${spark}</td>`;
                stb.appendChild(tr);
              });
              sTbl.appendChild(stb); body.appendChild(sTbl);
            }
          } catch(_){ }
        }
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
          _ensureDefaultConfigs();
          const cfg = window.__PREFIX_HEAT_CFG;
          const controls = _el('div','qt-diag-filters');
          controls.innerHTML = `
            <label>Depth<select data-ph-depth>
              <option value="1" ${cfg.depth===1?'selected':''}>1</option>
              <option value="2" ${cfg.depth===2?'selected':''}>2</option>
              <option value="3" ${cfg.depth===3?'selected':''}>3</option>
            </select></label>
            <label>TopKeyN<input type="number" min="1" max="10" step="1" value="${cfg.topN}" data-ph-topn></label>
            <button data-ph-refresh style="align-self:flex-end;height:24px;background:#333;border:1px solid #444;color:#ccc;border-radius:4px;cursor:pointer;padding:0 10px;">Apply</button>
          `;
          body.appendChild(controls);
          const res = window.exportTextPrefixHeat({ depth:cfg.depth, topKeyN:cfg.topN });
          if (!res.items.length) body.appendChild(_el('div','qt-diag-empty','No prefix data.'));
          else {
            const tbl = _el('table','qt-diag-table');
            tbl.innerHTML = '<thead><tr><th>#</th><th>Prefix</th><th>Total</th><th>Keys</th><th>Avg</th><th>TopKeys</th></tr></thead>';
            const tb = _el('tbody');
            res.items.slice(0,60).forEach((row,i)=>{
              const topKeys = (row.topKeys||[]).map(t=>`${t.key}(${t.count})`).join(',');
              const tr = _el('tr');
              tr.innerHTML = `<td>${i+1}</td><td data-diag-prefix="${row.prefix}">${row.prefix}</td><td>${row.totalCount}</td><td>${row.keyCount}</td><td>${row.avgCount}</td><td>${topKeys}</td>`;
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
            tbl.innerHTML = '<thead><tr><th>#</th><th>Kind</th><th>Target</th><th>Score</th><th>Reasons</th><th>Flags</th><th>Detail</th></tr></thead>';
            const tb = _el('tbody');
            res.items.slice(0,80).forEach((row,i)=>{
              const tr = _el('tr');
              const rf = encodeURIComponent(JSON.stringify(row.rawFactors||{}));
              tr.innerHTML = `<td>${i+1}</td><td>${row.kind}</td><td data-diag-k="${row.target}">${row.target}</td><td>${row.score}</td><td>${row.reasons.join(',')}</td><td>${row.flags.join(',')}</td><td><button data-cleanup-detail="${rf}" style="background:#2f2f2f;border:1px solid #444;color:#bbb;padding:1px 6px;font-size:11px;border-radius:4px;cursor:pointer;">ƒ</button></td>`;
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
    p.innerHTML = `<div class="qt-diag-header"><span class="qt-diag-title">Diagnostics</span><div class="qt-diag-actions"><button data-act="snapshot" title="Export Snapshot">⧉</button><button data-act="min">_</button><button data-act="close">×</button></div></div><div class="qt-diag-tabs"><button data-tab="usage" class="active">Usage</button><button data-tab="missing">Missing</button><button data-tab="ws">WS</button><button data-tab="unused">Unused</button><button data-tab="wscats">WSCats</button><button data-tab="lastused">LastUsed</button><button data-tab="prefix">Prefix</button><button data-tab="cleanup">Cleanup</button></div><div class="qt-diag-body"></div>`;
    document.body.appendChild(p);
    return p;
  }

  function _attachEvents(){
    const header = _panel.querySelector('.qt-diag-header');
    header.addEventListener('mousedown', e=>{ _drag.active = true; _drag.dx = e.clientX - _panel.offsetLeft; _drag.dy = e.clientY - _panel.offsetTop; e.preventDefault(); });
    document.addEventListener('mousemove', e=>{ if (!_drag.active) return; _panel.style.left = (e.clientX - _drag.dx) + 'px'; _panel.style.top = (e.clientY - _drag.dy) + 'px'; });
    document.addEventListener('mouseup', ()=>{ _drag.active = false; });
    // 通用 Overlay 工厂（单实例容器 + 内容面板）
    function _ensureOverlayRoot(){ let root=document.getElementById('qt-diag-overlay-root'); if(!root){ root=document.createElement('div'); root.id='qt-diag-overlay-root'; root.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:999999;'; document.body.appendChild(root);} return root; }
    function _openOverlay(id, opts){
      const root=_ensureOverlayRoot();
      // 若已存在同 ID 直接移除（切换/关闭语义）
      const exist=document.getElementById(id); if (exist){ exist.remove(); return null; }
      const mask=document.createElement('div'); mask.className='qt-ov-mask'; mask.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);';
      const panel=document.createElement('div'); panel.className='qt-ov-panel'; panel.id=id; panel.style.cssText='position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:340px;max-width:70%;max-height:70%;overflow:auto;background:#1c1c1c;border:1px solid #444;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.55);font-size:12px;color:#ccc;padding:10px;pointer-events:auto;display:flex;flex-direction:column;gap:8px;';
      const hd=document.createElement('div'); hd.style.cssText='display:flex;align-items:center;font-weight:600;gap:8px;';
      hd.innerHTML=`<span style="flex:1;">${opts.title||'Detail'}</span><button data-x style="background:#2f2f2f;border:1px solid #555;color:#bbb;cursor:pointer;font-size:12px;padding:2px 8px;border-radius:4px;">×</button>`;
      const body=document.createElement('div'); body.className='qt-ov-body'; body.innerHTML=opts.html||'';
      panel.appendChild(hd); panel.appendChild(body);
      root.appendChild(mask); root.appendChild(panel);
      const close=()=>{ panel.remove(); mask.remove(); if(opts.onClose) try{opts.onClose();}catch(_){}};
      mask.addEventListener('click', close);
      panel.querySelector('[data-x]').addEventListener('click', close);
      return { panel, body, close };
    }
    _panel.addEventListener('click', e=>{
        if (e.target && e.target.matches('button[data-bm-help]')){
          _openOverlay('qt-bm-help', { title:'Baseline 模式说明', html:`<div class='sec'><b>median</b>: 使用所有样本的中位数，抗极端值强。</div>
            <div class='sec'><b>trimmedMean</b>: 去除高/低端各 10% 后的均值，适合偶发极值干扰。</div>
            <div class='sec'><b>选择建议</b>: 样本尚少或波动轻微用 median；存在稀疏极端 spikes 且希望平滑背景用 trimmedMean。</div>
            <div class='sec'><b>注意</b>: extreme 过滤比例固定，低样本量差异很小。</div>` });
          return;
        }
      const act = e.target.getAttribute('data-act');
      if (act === 'close'){ window.hideDiagnosticsPanel(); }
      if (act === 'min'){ _panel.classList.toggle('qt-diag-min'); }
      if (act === 'snapshot'){
        if (typeof window.exportDiagnosticsSnapshot === 'function'){
          try {
            const snap = window.exportDiagnosticsSnapshot();
            const json = JSON.stringify(snap, null, 2);
            const LS_KEY='diagnostics-last-snapshot';
            const ov = _openOverlay('qt-snapshot-overlay', { title:'Snapshot', html:`<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px;'>
              <button data-copy style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Copy</button>
              <button data-dl style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Download</button>
              <button data-diff style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Compare</button>
            </div><textarea readonly style='width:100%;min-height:260px;background:#121212;color:#d6d6d6;font:11px/1.3 ui-monospace,monospace;border:1px solid #333;border-radius:4px;padding:6px;resize:vertical;'>${json}</textarea>` });
            if (ov){
              const root=ov.panel;
              const copyBtn=root.querySelector('[data-copy]');
              copyBtn.addEventListener('click', ()=>{ try { navigator.clipboard.writeText(json); copyBtn.textContent='Copied'; setTimeout(()=> copyBtn.textContent='Copy',1500);} catch(_){ } });
              const dlBtn=root.querySelector('[data-dl]');
              dlBtn.addEventListener('click', ()=>{ try { const blob=new Blob([json],{type:'application/json'}); const a=document.createElement('a'); a.download=`diagnostics-snapshot-${new Date().toISOString().replace(/[:.]/g,'-')}.json`; a.href=URL.createObjectURL(blob); document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1000);} catch(_){ } });
              const diffBtn=root.querySelector('[data-diff]');
              diffBtn.addEventListener('click', ()=>{
                try {
                  const prevRaw=localStorage.getItem(LS_KEY);
                  if (!prevRaw){ localStorage.setItem(LS_KEY, JSON.stringify({ ts:Date.now(), snap })); diffBtn.textContent='Saved'; setTimeout(()=> diffBtn.textContent='Compare',1500); return; }
                  let prevObj=null; try { prevObj=JSON.parse(prevRaw); } catch(_){ }
                  if (!prevObj || !prevObj.snap) prevObj={ snap:{} };
                  const detailed=_flattenDiffDetailed(prevObj.snap, snap);
                  const diffJson=JSON.stringify(detailed.summary, null, 2);
                  function buildFieldsTable(rows){
                    if (!rows.length) return '<div style="font-size:12px;opacity:.7;">No field changes.</div>';
                    const head='<thead><tr><th>#</th><th>Type</th><th>Path</th><th>Old</th><th>New</th></tr></thead>';
                    const body=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.type}</td><td>${r.path}</td><td>${r.oldVal}</td><td>${r.newVal}</td></tr>`).join('');
                    return `<table class='qt-diag-table' style='margin-top:4px;'>${head}<tbody>${body}</tbody></table>`;
                  }
                  const tableHtml=buildFieldsTable(detailed.rows);
                  _openOverlay('qt-snapshot-diff-overlay', { title:'Snapshot Diff', html:`<div style='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;'>
                    <button data-save style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Set Base</button>
                    <button data-view='raw' class='qt-btn-on' style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Raw</button>
                    <button data-view='fields' style='background:#222;border:1px solid #444;color:#999;padding:2px 8px;border-radius:4px;cursor:pointer;'>Fields</button>
                  </div>
                  <div data-diff-raw style='display:block;'>
                    <textarea readonly style='width:100%;min-height:240px;background:#121212;color:#d6d6d6;font:11px/1.3 ui-monospace,monospace;border:1px solid #333;border-radius:4px;padding:6px;resize:vertical;'>${diffJson}</textarea>
                  </div>
                  <div data-diff-fields style='display:none;max-height:300px;overflow:auto;'>${tableHtml}</div>` });
                  const diffPanel=document.getElementById('qt-snapshot-diff-overlay');
                  if (diffPanel){
                    const btnSave=diffPanel.querySelector('[data-save]');
                    btnSave.addEventListener('click', ()=>{ try { localStorage.setItem(LS_KEY, JSON.stringify({ ts:Date.now(), snap })); } catch(_){ } btnSave.textContent='Saved'; setTimeout(()=> btnSave.textContent='Set Base',1500); });
                    diffPanel.addEventListener('click', ev=>{
                      const v=ev.target.getAttribute && ev.target.getAttribute('data-view');
                      if (!v) return;
                      diffPanel.querySelectorAll('[data-view]').forEach(b=> b.classList.remove('qt-btn-on'));
                      ev.target.classList.add('qt-btn-on');
                      const raw=diffPanel.querySelector('[data-diff-raw]');
                      const fields=diffPanel.querySelector('[data-diff-fields]');
                      if (v==='raw'){ raw.style.display='block'; fields.style.display='none'; }
                      else { raw.style.display='none'; fields.style.display='block'; }
                    });
                  }
                } catch(_){ }
              });
            }
          } catch(_){ }
        }
        return;
      }
        const tab = e.target.getAttribute('data-tab'); 
        if (tab) _activateTab(tab);
        // health score detail
        const hsNode = e.target.closest('[data-hs-detail]');
        if (hsNode){
          let raw = hsNode.getAttribute('data-hs-detail');
          try {
            const hs = JSON.parse(decodeURIComponent(raw));
            const baseWeights = _deriveHealthWeights(hs);
            const ov = _openOverlay('qt-hs-detail', { title:'Health Score Detail', html:`<div style='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px;'>
              <button data-hw-edit style='background:#333;border:1px solid #555;color:#ccc;padding:2px 8px;border-radius:4px;cursor:pointer;'>Edit Weights</button>
              <button data-hw-reset style='background:#222;border:1px solid #444;color:#999;padding:2px 8px;border-radius:4px;cursor:pointer;display:none;'>Reset</button>
              <span data-hw-preview style='margin-left:auto;font-weight:600;'></span>
            </div>` + _buildHealthDetailHtml(hs) });
            if (ov){
              const previewNode = ov.panel.querySelector('[data-hw-preview]');
              function recomputePreview(weights){
                // 使用 breakdown * 新权重 生成预览 (归一化后)
                const bd = hs.breakdown||{}; const keys=Object.keys(weights||{});
                if (!keys.length){ previewNode.textContent=''; return; }
                const rawSum = keys.reduce((s,k)=> s + ( (bd[k]!=null? bd[k]:0) * weights[k] ),0);
                // 归一 scale 到当前 hs.score （保持视觉可比），或直接显示 raw
                previewNode.textContent = 'Preview: ' + rawSum.toFixed(1);
              }
              let editing=false; let currentWeights = { ...baseWeights };
              const btnEdit = ov.panel.querySelector('[data-hw-edit]');
              const btnReset = ov.panel.querySelector('[data-hw-reset]');
              btnEdit.addEventListener('click', ()=>{
                if (!editing){
                  editing=true; btnEdit.textContent='Apply'; btnReset.style.display='inline-block';
                  // 注入权重编辑表格（替换 Weights 那块 tbody）
                  const weights = { ...currentWeights };
                  const panelBody = ov.panel.querySelector('.qt-ov-body');
                  const weightsTable = panelBody.querySelector('b+table'); // 第一个 Breakdown 表后紧跟 Weights 表
                  // 更安全定位：查找含有 <b>Weights</b> 的 sec
                  const weightSec = Array.from(panelBody.querySelectorAll('.sec')).find(s=> s.innerHTML.includes('<b>Weights')); 
                  if (weightSec){
                    const tb = weightSec.querySelector('tbody');
                    if (tb){
                      tb.innerHTML = Object.keys(weights).map(k=>`<tr><td>${k}</td><td><input data-hw-k='${k}' value='${weights[k]}' style='width:60px;background:#111;border:1px solid #333;color:#ccc;font-size:11px;padding:1px 4px;border-radius:3px;'></td></tr>`).join('');
                    }
                  }
                  previewNode.textContent='';
                } else {
                  // 收集输入并预览
                  const inputs = ov.panel.querySelectorAll('input[data-hw-k]');
                  const nw = {}; let sum=0;
                  inputs.forEach(inp=>{ const k=inp.getAttribute('data-hw-k'); const v=parseFloat(inp.value); if(!isNaN(v)&&v>=0){ nw[k]=v; sum+=v; } });
                  if (sum>0){ Object.keys(nw).forEach(k=> nw[k]= +(nw[k]/sum).toFixed(3)); }
                  currentWeights = nw; recomputePreview(currentWeights);
                  btnEdit.textContent='Re-Edit'; editing=false; // 允许再次进入编辑
                }
              });
              btnReset.addEventListener('click', ()=>{
                currentWeights = { ...baseWeights }; editing=false; btnEdit.textContent='Edit Weights'; btnReset.style.display='none';
                // 重新渲染 detail HTML（简单起见整个重建）
                const bodyHtml = _buildHealthDetailHtml(hs); ov.body.innerHTML = ov.body.innerHTML.replace(/<div class='sec'><b>Breakdown[\s\S]*<div class='sec'><b>Suggestions/, bodyHtml + "<div class='sec'><b>Suggestions");
                previewNode.textContent='';
              });
            }
          } catch(_){ }
          return;
        }
        // recovery timeline overlay
        if (e.target && e.target.matches('button[data-rec-timeline]')){
          const tracker = window.__SPIKE_STREAK_TRACKER__;
          if (!tracker || typeof tracker.recoveryTimeline!== 'function'){ return; }
          let list = [];
          try { list = tracker.recoveryTimeline(15*60*1000) || []; } catch(_){ list = []; }
          const rows = list.map(it=>`<tr><td>${new Date(it.ts).toLocaleTimeString()}</td><td>${it.key}</td><td>${_formatMs(Date.now()-it.ts)}</td></tr>`).join('') || '<tr><td colspan=3>-</td></tr>';
          const ov = _openOverlay('qt-rec-timeline', { title:'Recovery Timeline (15m)', html:`<div class='flt'>Filter <input data-rt-flt placeholder='keyword/category'> <button data-rt-apply>Go</button> <button data-rt-clr>Clear</button></div>
            <table><thead><tr><th>Time</th><th>Key</th><th>Age</th></tr></thead><tbody>${rows}</tbody></table>` });
          if (ov){
            const applyFilter = () => {
              const kw = (ov.panel.querySelector('[data-rt-flt]').value||'').trim();
              let filtered = list;
              if (kw){ filtered = list.filter(r=> r.key.includes(kw) || String(r.key)===kw); }
              const tbody = ov.panel.querySelector('tbody');
              tbody.innerHTML = filtered.map(it=>`<tr><td>${new Date(it.ts).toLocaleTimeString()}</td><td>${it.key}</td><td>${_formatMs(Date.now()-it.ts)}</td></tr>`).join('') || '<tr><td colspan=3>-</td></tr>';
            };
            ov.panel.querySelector('[data-rt-apply]').addEventListener('click', applyFilter);
            ov.panel.querySelector('[data-rt-clr]').addEventListener('click', ()=>{ ov.panel.querySelector('[data-rt-flt]').value=''; applyFilter(); });
          }
          return;
        }
        // backtrace trigger
        const cell = e.target.closest('[data-diag-k]');
        if (cell){
          const k = cell.getAttribute('data-diag-k');
          const info = _buildKeyBacktrace(k);
          _showBacktrace(info);
          return;
        }
        // prefix heat controls
        if (e.target.matches('[data-ph-refresh]')){
          const depthSel = _panel.querySelector('[data-ph-depth]');
          const topnInp = _panel.querySelector('[data-ph-topn]');
          if (depthSel && topnInp){
            const d = parseInt(depthSel.value)||1;
            const tn = Math.min(10, Math.max(1, parseInt(topnInp.value)||3));
            window.__PREFIX_HEAT_CFG = { depth:d, topN:tn };
            _savePrefsPartial('prefix', window.__PREFIX_HEAT_CFG);
            _activateTab('prefix');
          }
        }
        // prefix drilldown
        const pCell = e.target.closest('[data-diag-prefix]');
        if (pCell){
          const prefix = pCell.getAttribute('data-diag-prefix');
          if (typeof window.exportTextUsageStats==='function'){
            let usage=[]; try { usage = window.exportTextUsageStats({ reset:false })||[]; } catch(_){ }
            const list = usage.filter(u=> u.key.startsWith(prefix+'_')); // delimiter 假设 '_'
            if (list.length){
              const total = list.reduce((s,r)=> s+r.count,0);
              list.sort((a,b)=> b.count - a.count || a.key.localeCompare(b.key));
              const exist = document.getElementById('qt-prefix-drill'); if (exist) exist.remove();
              const box = document.createElement('div'); box.id='qt-prefix-drill'; box.className='qt-diag-prefix-drill';
              const rows = list.slice(0,120).map(r=>`<tr><td data-diag-k="${r.key}">${r.key}</td><td>${r.count}</td><td>${((r.count/total)*100).toFixed(1)}%</td></tr>`).join('');
              box.innerHTML = `<div class='hd'>Prefix: ${prefix} <button data-x>×</button></div><table><thead><tr><th>Key</th><th>Count</th><th>%</th></tr></thead><tbody>${rows}</tbody></table>`;
              document.body.appendChild(box);
              box.querySelector('[data-x]').addEventListener('click', ()=> box.remove());
            }
          }
          return;
        }
        if (e.target && e.target.matches('button[data-cleanup-detail]')){
          const raw = e.target.getAttribute('data-cleanup-detail');
          let factors = {}; try { factors = JSON.parse(decodeURIComponent(raw)); } catch(_){ }
          const exist = document.getElementById('qt-cleanup-detail'); if (exist) exist.remove();
          const box = document.createElement('div'); box.id='qt-cleanup-detail'; box.className='qt-diag-cleanup-detail';
          const rows = Object.keys(factors).map(k=>`<tr><td>${k}</td><td>${factors[k]}</td></tr>`).join('') || '<tr><td colspan=2>-</td></tr>';
          box.innerHTML = `<div class='hd'>Cleanup Factors <button data-x>×</button></div><table><thead><tr><th>Factor</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
          document.body.appendChild(box);
          box.querySelector('[data-x]').addEventListener('click', ()=> box.remove());
          return;
        }
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
 .qt-diag-cleanup-detail{position:fixed;bottom:90px;right:460px;width:200px;background:#1a1a1a;border:1px solid #444;color:#ddd;font:11px/1.3 system-ui,monospace;z-index:100000;border-radius:6px;box-shadow:0 2px 10px #000;}
 .qt-diag-cleanup-detail .hd{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:#242424;border-bottom:1px solid #333;font-weight:600;font-size:11px;}
 .qt-diag-cleanup-detail table{width:100%;border-collapse:collapse;font-size:11px;}
 .qt-diag-cleanup-detail th,.qt-diag-cleanup-detail td{border:1px solid #333;padding:2px 4px;text-align:left;}
 .qt-diag-cleanup-detail button{background:#333;color:#bbb;border:0;padding:0 6px;cursor:pointer;border-radius:3px;}
 .qt-diag-cleanup-detail button:hover{background:#444;color:#fff;}
 .qt-diag-prefix-drill{position:fixed;bottom:96px;right:16px;width:320px;max-height:320px;overflow:auto;background:#1a1a1a;border:1px solid #444;color:#ddd;font:11px/1.35 system-ui,monospace;z-index:100000;border-radius:6px;box-shadow:0 2px 10px #000;padding:0;}
 .qt-diag-prefix-drill .hd{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;background:#242424;border-bottom:1px solid #333;font-weight:600;font-size:11px;}
 .qt-diag-prefix-drill table{width:100%;border-collapse:collapse;font-size:11px;}
 .qt-diag-prefix-drill th,.qt-diag-prefix-drill td{border:1px solid #333;padding:2px 4px;text-align:left;}
 .qt-diag-prefix-drill button{background:#333;color:#bbb;border:0;padding:0 6px;cursor:pointer;border-radius:3px;}
 .qt-diag-prefix-drill button:hover{background:#444;color:#fff;}
 .qt-diag-snapshot{position:fixed;top:60px;right:470px;width:420px;height:420px;background:#1a1a1a;border:1px solid #444;z-index:100000;color:#ddd;font:11px/1.35 system-ui,monospace;border-radius:6px;display:flex;flex-direction:column;box-shadow:0 2px 12px #000;}
 .qt-diag-snapshot .hd{display:flex;align-items:center;justify-content:space-between;background:#242424;padding:4px 6px;border-bottom:1px solid #333;font-weight:600;font-size:11px;gap:6px;}
 .qt-diag-snapshot .hd button{background:#333;color:#bbb;border:0;padding:2px 8px;cursor:pointer;border-radius:4px;font-size:11px;}
 .qt-diag-snapshot .hd button:hover{background:#444;color:#fff;}
 .qt-diag-snapshot textarea{flex:1;margin:0;border:0;background:#121212;color:#d6d6d6;font:11px/1.3 ui-monospace,monospace;padding:6px;resize:none;outline:none;}
.qt-hs-detail{position:fixed;top:90px;right:470px;width:300px;max-height:420px;overflow:auto;background:#1b1b1b;border:1px solid #444;color:#ddd;font:11px/1.35 system-ui,monospace;z-index:100000;border-radius:6px;box-shadow:0 2px 12px #000;padding:0;}
.qt-hs-detail .hd{display:flex;align-items:center;justify-content:space-between;background:#242424;padding:4px 6px;border-bottom:1px solid #333;font-weight:600;font-size:11px;}
.qt-hs-detail .sec{padding:6px 8px;border-bottom:1px solid #2a2a2a;}
.qt-hs-detail table{width:100%;border-collapse:collapse;margin-top:4px;}
.qt-hs-detail th,.qt-hs-detail td{border:1px solid #333;padding:2px 4px;text-align:left;}
.qt-hs-detail ul{margin:4px 0 0 16px;padding:0;}
.qt-bm-help{position:fixed;top:120px;right:470px;width:340px;background:#1c1c1c;border:1px solid #444;color:#ddd;font:11px/1.35 system-ui,monospace;z-index:100000;border-radius:6px;box-shadow:0 2px 10px #000;padding:0;}
.qt-bm-help .hd{display:flex;align-items:center;justify-content:space-between;background:#242424;padding:4px 6px;border-bottom:1px solid #333;font-weight:600;font-size:11px;}
.qt-bm-help .sec{padding:6px 8px;border-bottom:1px solid #2a2a2a;}
.qt-rec-summary{margin:2px 0 6px;display:flex;gap:10px;flex-wrap:wrap;background:#181818;border:1px solid #333;padding:4px 6px;border-radius:4px;font-size:11px;}
.qt-rec-timeline{position:fixed;top:140px;right:470px;width:340px;max-height:420px;overflow:auto;background:#1b1b1b;border:1px solid #444;color:#ddd;font:11px/1.35 system-ui,monospace;z-index:100000;border-radius:6px;box-shadow:0 2px 10px #000;padding:0;display:flex;flex-direction:column;}
.qt-rec-timeline .hd{display:flex;align-items:center;justify-content:space-between;background:#242424;padding:4px 6px;border-bottom:1px solid #333;font-weight:600;font-size:11px;}
.qt-rec-timeline .flt{padding:4px 6px;display:flex;gap:6px;align-items:center;background:#202020;border-bottom:1px solid #2a2a2a;}
.qt-rec-timeline table{width:100%;border-collapse:collapse;font-size:11px;}
.qt-rec-timeline th,.qt-rec-timeline td{border:1px solid #333;padding:2px 4px;text-align:left;}
.qt-rec-timeline button{background:#333;color:#bbb;border:1px solid #444;padding:2px 6px;cursor:pointer;border-radius:3px;font-size:11px;}
.qt-rec-timeline button:hover{background:#444;color:#fff;}
`;
    document.head.appendChild(style);
  }

  function showDiagnosticsPanel(options){
    options = options || {}; const refresh = options.refreshInterval || DEFAULT_REFRESH;
    if (!_panel){
      _ensureStyle();
      _panel = _makePanel(options);
      _attachEvents();
      // 恢复历史参数（若支持）
      _loadAndApplyPrefs();
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
