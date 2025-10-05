/* ws-event-category-spikes.js
 * 基于 exportWsEventCategories 的分类级突发检测（纯派生，不新增事件采样）。
 * 原理：
 *   - 读取一次分类窗口统计 (prefetched 或内部调用)
 *   - 选取基线：采用所有分类 ratePerMin 的中位数；若中位数 < requireMinBaseline 则使用第一个 >= requireMinBaseline 的分类；仍无则使用 requireMinBaseline
 *   - factor = cat.ratePerMin / baselineRate
 *   - 过滤：ratePerMin >= rateMinPerMin 且 factor >= factorMin
 *   - 连续次数 (streak) & sustained 判定（与全局 spike 模块逻辑一致）
 * API:
 *   exportWsEventCategorySpikes(opts?) -> { baselineRate, windowMs, items:[ { category, ratePerMin, count, factor, streak, sustained } ] }
 * 参数:
 *   opts.factorMin (默认 2.0)
 *   opts.rateMinPerMin (默认 0.5)
 *   opts.topN (默认 8)
 *   opts.requireMinBaseline (默认 0.1)
 *   opts.prefetchedCategories (可选)
 *   opts.sustainMin (默认 2)
 */
(function(){
  'use strict';
  if (window.exportWsEventCategorySpikes) return; // 幂等

  const _tracker = (typeof window.__SPIKE_STREAK_TRACKER__ !== 'undefined') ? window.__SPIKE_STREAK_TRACKER__ : ((typeof window.createSpikeStreakTracker==='function')? window.createSpikeStreakTracker(): null);

  function _median(arr){ if(!arr.length) return 0; const s=arr.slice().sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m] : (s[m-1]+s[m])/2; } // 仅作为回退

  function exportWsEventCategorySpikes(opts){
    opts = opts || {};
    const factorMin = typeof opts.factorMin==='number'? opts.factorMin : 2.0;
    const rateMinPerMin = typeof opts.rateMinPerMin==='number'? opts.rateMinPerMin : 0.5;
    const topN = typeof opts.topN==='number'? Math.min(20, Math.max(1, opts.topN)) : 8;
  const requireMinBaseline = typeof opts.requireMinBaseline==='number'? opts.requireMinBaseline : 0.1;
  const baselineMode = opts.baselineMode === 'trimmedMean' ? 'trimmedMean' : 'median';
  const sustainMin = typeof opts.sustainMin==='number'? Math.max(1, opts.sustainMin) : 2;
  const recoveryWindowMs = typeof opts.recoveryWindowMs==='number' && opts.recoveryWindowMs>0 ? opts.recoveryWindowMs : 30_000; // 目前 tracker 内部自己维护窗口；此值预留给未来若要分 tracker
    let catsData = opts.prefetchedCategories;
    if (!catsData){
      if (typeof window.exportWsEventCategories !== 'function') return { baselineRate:0, windowMs:0, items:[], reason:'ws-event-categories not loaded' };
      try { catsData = window.exportWsEventCategories({ windowMs: opts.windowMs }); } catch(_){ return { baselineRate:0, windowMs:0, items:[], reason:'categories export failed' }; }
    }
    if (!catsData || !catsData.categories) return { baselineRate:0, windowMs:0, items:[], reason:'invalid data' };
    const cats = catsData.categories;
    const rates = Object.keys(cats).map(k=> cats[k].ratePerMin).filter(r=> typeof r==='number');
    let baseline;
    if (typeof window.computeSpikeBaseline === 'function'){
      baseline = window.computeSpikeBaseline(rates, { minBaseline: requireMinBaseline, mode: baselineMode }).baseline;
    } else { // 回退
      baseline = _median(rates);
      if (baseline < requireMinBaseline){
        const sorted = rates.slice().sort((a,b)=>a-b);
        const found = sorted.find(r=> r>= requireMinBaseline);
        baseline = found != null ? found : requireMinBaseline;
      }
      if (baseline <=0) baseline = requireMinBaseline;
    }
  const items=[]; const seen=new Set();
    Object.keys(cats).forEach(cat=>{
      const c = cats[cat]; const r = c.ratePerMin; seen.add(cat);
      if (r >= rateMinPerMin){
        const factor = +(r / baseline).toFixed(2);
        if (factor >= factorMin){
          if (_tracker){
            const res = _tracker.update(cat, true);
            items.push({ category:cat, ratePerMin:r, count:c.count, factor, streak:res.streak, sustained:res.sustained, recovering:res.recovering, lastRecoveryTs:res.lastRecoveryTs });
          } else {
            items.push({ category:cat, ratePerMin:r, count:c.count, factor, streak:1, sustained:(1>=sustainMin) });
          }
          return;
        }
      }
      if (_tracker) _tracker.update(cat, false);
    });
    items.sort((a,b)=> b.factor - a.factor || a.category.localeCompare(b.category));
    return { baselineRate: baseline, windowMs: catsData.windowMs, items: items.slice(0, topN) };
  }

  window.exportWsEventCategorySpikes = exportWsEventCategorySpikes;
  console.log('✅ ws-event-category-spikes 已加载 (exportWsEventCategorySpikes)');
})();
