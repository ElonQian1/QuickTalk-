/* diagnostics-snapshot.js
 * 聚合调试快照：集中一次性导出当前主要观测数据，便于离线排查。
 * 仅消费已存在导出函数，不新增采样逻辑；保证每类数据调用一次。
 * API:
 *   exportDiagnosticsSnapshot(opts?) -> { ts, usage, hotspots, ws:{ metrics, health, eventSpikes, categorySpikes, heartbeat }, texts:{ unusedCfg, unused, prefixHeat, cleanup }, misc:{ missingKeys }, meta }
 * 参数:
 *   opts.limits: { usageTop, hotspotsTop, unusedTop, prefixTop, cleanupTop } （默认简化）
 */
(function(){
  'use strict';
  if (window.exportDiagnosticsSnapshot) return; // 幂等

  function _safe(fn, fallback){ try { return fn(); } catch(_){ return fallback; } }

  function exportDiagnosticsSnapshot(opts){
    opts = opts || {}; const L = Object.assign({ usageTop:60, hotspotsTop:15, unusedTop:60, prefixTop:60, cleanupTop:60 }, opts.limits||{});
    const ts = Date.now();
    // Usage & Hotspots
    const usage = _safe(()=> (typeof window.exportTextUsageStats==='function'? window.exportTextUsageStats():[]), []);
    const hotspots = _safe(()=> (typeof window.exportTextUsageHotspots==='function'? window.exportTextUsageHotspots({ topN:L.hotspotsTop }):null), null);
    // Missing keys (即时缓存)
    const missingKeys = Array.isArray(window.__LAST_MISSING_TEXT_KEYS__)? window.__LAST_MISSING_TEXT_KEYS__.slice(0,200): [];
    // Unused (带当前面板配置)
    const unusedCfg = window.__UNUSED_DIAG_CFG || { threshold:0, maxAgeMs:null, mode:'or' };
    const unused = _safe(()=> (typeof window.exportUnusedTextKeys==='function'? (window.exportUnusedTextKeys({ threshold:unusedCfg.threshold, maxAgeMs:unusedCfg.maxAgeMs, mode:unusedCfg.mode, includeUsageCounts:true, includeAge:true }).unused||[]) : []), []);
    // Prefix heat
    const prefixCfg = window.__PREFIX_HEAT_CFG || { depth:1, topN:3 };
    const prefixHeat = _safe(()=> (typeof window.exportTextPrefixHeat==='function'? window.exportTextPrefixHeat({ depth:prefixCfg.depth, topKeyN:prefixCfg.topN }): null), null);
    // Cleanup suggestions
    const cleanup = _safe(()=> (typeof window.exportTextCleanupSuggest==='function'? window.exportTextCleanupSuggest({ threshold:0, minPrefixTotal:5 }): null), null);
    // WS metrics & spikes & heartbeat & health
    const wsMetrics = _safe(()=> (typeof window.exportWsMetrics==='function'? window.exportWsMetrics(): null), null);
    const heartbeatQuality = _safe(()=> (typeof window.exportWsHeartbeatQuality==='function'? window.exportWsHeartbeatQuality(): null), null);
    const eventSpikes = _safe(()=> (typeof window.exportWsEventSpikes==='function'? window.exportWsEventSpikes({}): null), null);
    const categorySpikes = _safe(()=> (typeof window.exportWsEventCategorySpikes==='function'? window.exportWsEventCategorySpikes({}): null), null);
    const health = _safe(()=> (typeof window.exportWsHealthScore==='function'? window.exportWsHealthScore({ prefetched:{ wsMetrics, heartbeatQuality, eventSpikes, categorySpikes } }): null), null);
    // 截断输出（轻量化）
    const snapshot = {
      ts,
      usage: usage.slice(0, L.usageTop),
      hotspots: hotspots && hotspots.items ? Object.assign({}, hotspots, { items: hotspots.items.slice(0,L.hotspotsTop) }) : hotspots,
      ws: { metrics: wsMetrics, health, eventSpikes, categorySpikes, heartbeat: heartbeatQuality },
      texts: {
        unusedCfg,
        unused: (unused||[]).slice(0,L.unusedTop),
        prefixHeat: prefixHeat && prefixHeat.items ? Object.assign({}, prefixHeat, { items: prefixHeat.items.slice(0,L.prefixTop) }) : prefixHeat,
        cleanup: cleanup && cleanup.items ? Object.assign({}, cleanup, { items: cleanup.items.slice(0,L.cleanupTop) }) : cleanup
      },
      misc: { missingKeys },
      meta: { limits:L, version:'1.0' }
    };
    return snapshot;
  }

  window.exportDiagnosticsSnapshot = exportDiagnosticsSnapshot;
  console.log('✅ diagnostics-snapshot 已加载 (exportDiagnosticsSnapshot)');
})();
