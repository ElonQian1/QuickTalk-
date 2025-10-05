/* text-usage-hotspots.js
 * 基于 exportTextUsageStats 的增量热点分析，不重复统计，只做快照 diff。
 * API: exportTextUsageHotspots(opts?) -> { generatedAt, intervalMs, items:[{key,delta,total,prev,pct,ratePerSec}], stats:{} }
 */
(function(){
  'use strict';
  if (window.exportTextUsageHotspots) return; // 幂等

  let _prevSnap = null; // { ts, map: Map<key,count> }

  function exportTextUsageHotspots(opts){
    opts = opts || {};
    const topN = opts.topN != null ? opts.topN : 15;
    if (typeof window.exportTextUsageStats !== 'function'){
      return { generatedAt:new Date().toISOString(), intervalMs:0, items:[], stats:{ reason:'usageStatsUnavailable' } };
    }
    const now = Date.now();
    let arr;
    try { arr = window.exportTextUsageStats({ reset:false }) || []; } catch(_){ arr=[]; }
    if (!_prevSnap){
      // 首次：创建快照，返回空（无 diff 基线）
      _prevSnap = { ts: now, map: new Map(arr.map(r=>[r.key, r.count])) };
      return { generatedAt:new Date().toISOString(), intervalMs:0, items:[], stats:{ initial:true } };
    }
    const intervalMs = Math.max(10, now - _prevSnap.ts); // 保护避免除零
    const items = [];
    for (const r of arr){
      const prev = _prevSnap.map.get(r.key) || 0;
      const delta = r.count - prev;
      if (delta > 0){
        const pct = prev>0 ? +(delta / prev * 100).toFixed(1) : null;
        const ratePerSec = +(delta / (intervalMs/1000)).toFixed(3);
        items.push({ key:r.key, delta, total:r.count, prev, pct, ratePerSec });
      }
    }
    items.sort((a,b)=> b.delta - a.delta || b.total - a.total || a.key.localeCompare(b.key));
    const sliced = items.slice(0, topN);
    // 更新快照
    _prevSnap = { ts: now, map: new Map(arr.map(r=>[r.key, r.count])) };
    return {
      generatedAt: new Date().toISOString(),
      intervalMs,
      items: sliced,
      stats: { totalPositive: items.length, snapshotSize: arr.length }
    };
  }

  window.exportTextUsageHotspots = exportTextUsageHotspots;
  console.log('✅ text-usage-hotspots 已加载 (exportTextUsageHotspots)');
})();
