/* ws-event-spikes.js
 * 基于现有 exportWsEventRates 的简单突发(Spike)检测层（纯读取，不新增采样）。
 * 设计原则：
 *   - 不重复维护时间戳；仅调用一次 exportWsEventRates() 获取多窗口统计
 *   - 使用最长窗口的 rate 作为 baseline；若 baseline 极低则回退到次长窗口或使用全窗口中位数
 *   - 计算 factor = short.rate / baselineRate
 *   - 仅返回满足 (rate >= rateMin) 且 (factor >= factorMin) 的窗口（排除最长窗口自身）
 *   - 输出已按 factor 从高到低排序，限制前 topN 条
 * API:
 *   exportWsEventSpikes(opts?) -> { baselineWindowMs, baselineRate, items:[ { windowMs, rate, count, factor, streak, sustained } ] }
 * 参数:
 *   opts.factorMin (默认 2.5)
 *   opts.rateMin   (默认 0.2 events/sec)
 *   opts.topN      (默认 5)
 *   opts.requireMinBaseline (默认 0.01) 若 baseline 低于该值尝试寻找更稳定的较低窗口 baseline
 *   opts.prefetchedRates  (可选) 由外部提前调用 exportWsEventRates() 结果传入，避免二次调用
 *   opts.sustainMin (默认 2) 满足 spike 连续达到次数达到该值标记 sustained=true
 */
(function(){
  'use strict';
  if (window.exportWsEventSpikes) return; // 幂等

  // 由公共基线工具计算基线值，仍保留 baselineWindowMs（取最长窗口作为代表窗口）
  function _pickBaseline(windows, requireMin, mode){
    if (!windows.length) return { baselineWindowMs:0, baselineRate:0, modeUsed:mode||'median' };
    const longest = windows.slice().sort((a,b)=> a.windowMs - b.windowMs)[windows.length-1];
    if (typeof window.computeSpikeBaseline === 'function'){
      const rates = windows.map(w=> w.ratePerSec);
      const res = window.computeSpikeBaseline(rates, { minBaseline: requireMin, mode });
      return { baselineWindowMs: longest.windowMs, baselineRate: res.baseline, modeUsed: res.modeUsed };
    }
    // 回退到旧逻辑（极端情况下 baseline 工具未加载）
    if (longest.ratePerSec <= requireMin) return { baselineWindowMs: longest.windowMs, baselineRate: requireMin, modeUsed:'fallback' };
    return { baselineWindowMs: longest.windowMs, baselineRate: longest.ratePerSec, modeUsed:'fallback' };
  }

  // 使用共享 streak 工具，避免重复实现
  const _tracker = (typeof window.__SPIKE_STREAK_TRACKER__ !== 'undefined') ? window.__SPIKE_STREAK_TRACKER__ : ((typeof window.createSpikeStreakTracker==='function')? window.createSpikeStreakTracker(): null);

  function exportWsEventSpikes(opts){
    opts = opts || {};
    const factorMin = typeof opts.factorMin === 'number'? opts.factorMin : 2.5;
    const rateMin = typeof opts.rateMin === 'number'? opts.rateMin : 0.2;
    const topN = typeof opts.topN === 'number'? Math.min(10, Math.max(1, opts.topN)) : 5;
    const requireMinBaseline = typeof opts.requireMinBaseline === 'number'? opts.requireMinBaseline : 0.01;
  const baselineMode = opts.baselineMode === 'trimmedMean' ? 'trimmedMean' : 'median';
    const sustainMin = typeof opts.sustainMin === 'number'? Math.max(1, opts.sustainMin) : 2;
    const recoveryWindowMs = typeof opts.recoveryWindowMs === 'number' && opts.recoveryWindowMs>0 ? opts.recoveryWindowMs : 30_000;
    if (_tracker && typeof _tracker.setRecoveryWindowMs === 'function') _tracker.setRecoveryWindowMs(recoveryWindowMs);
    if (!opts.prefetchedRates){
      if (typeof window.exportWsEventRates !== 'function') return { baselineWindowMs:0, baselineRate:0, items:[], reason:'ws-event-rates not loaded' };
    }
    let rates = opts.prefetchedRates;
    if (!rates){ try { rates = window.exportWsEventRates(); } catch(_){ return { baselineWindowMs:0, baselineRate:0, items:[], reason:'rates export failed' }; } }
    if (!rates || !Array.isArray(rates.windows)) return { baselineWindowMs:0, baselineRate:0, items:[], reason:'invalid windows' };
  const { baselineWindowMs, baselineRate } = _pickBaseline(rates.windows, requireMinBaseline, baselineMode);
    const items = [];
    const seenWindows = new Set();
    if (baselineRate > 0){
      for (const w of rates.windows){
        if (w.windowMs === baselineWindowMs) continue; // baseline 自身不判定 spike
        seenWindows.add(w.windowMs);
        let isSpike = false; let factor = 0;
        if (w.ratePerSec >= rateMin){
          factor = +(w.ratePerSec / baselineRate).toFixed(2);
          if (factor >= factorMin){
            isSpike = true;
            if (_tracker){
              const { streak, sustained, recovering, lastRecoveryTs } = _tracker.update(String(w.windowMs), true);
              items.push({ windowMs: w.windowMs, rate: w.ratePerSec, count: w.count, factor, streak, sustained, recovering, lastRecoveryTs });
            } else {
              // 回退：无 tracker 时保持兼容（不应发生）
              items.push({ windowMs: w.windowMs, rate: w.ratePerSec, count: w.count, factor, streak:1, sustained: (1>=sustainMin) });
            }
            continue;
          }
        }
        if (_tracker) _tracker.update(String(w.windowMs), false);
      }
    }
    // 共享 tracker 内部不保留未知 key；无需清理（保持轻量）。
    items.sort((a,b)=> b.factor - a.factor || a.windowMs - b.windowMs);
    return { baselineWindowMs, baselineRate, items: items.slice(0, topN) };
  }

  window.exportWsEventSpikes = exportWsEventSpikes;
  console.log('✅ ws-event-spikes 已加载 (exportWsEventSpikes)');
})();
