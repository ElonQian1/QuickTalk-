/* ws-event-rates.js
 * 多窗口 WebSocket 事件速率统计（与 ws-event-categories 互补：该模块聚焦总体事件频率而非分类拆分）
 * 目标：
 *   - 支持多个滑动时间窗口 (默认: 60s, 300s, 900s)
 *   - 计算每窗口内事件总数与平均速率 (events/sec)
 *   - 轻量实现，避免重复存储：只存时间戳数组（环形裁剪）
 *   - 不区分事件类别；如需分类速率使用 ws-event-categories
 * 接口：
 *   enableWsEventRates(flag?, windowsMs?) -> boolean
 *   recordWsEventRateEvent(ts?) // 在任意 WS 事件发生时调用（建议与 recordWsEventCategory 同步调用）
 *   exportWsEventRates({ reset? }?) -> { windows: [ { windowMs, count, ratePerSec, oldestTs, newestTs } ], totalStored }
 */
(function(){
  'use strict';
  if (window.enableWsEventRates) return; // 幂等

  const DEFAULT_WINDOWS = [60_000, 300_000, 900_000];
  const MAX_EVENTS = 5000; // 全局事件时间戳上限

  const _state = {
    enabled: false,
    windows: DEFAULT_WINDOWS.slice(),
    events: [] // 升序 push 的时间戳（ms）
  };

  function enableWsEventRates(flag, windowsMs){
    _state.enabled = (flag === undefined) ? true : !!flag;
    if (Array.isArray(windowsMs) && windowsMs.length){
      // 过滤非法值，去重，排序
      const filtered = Array.from(new Set(windowsMs.filter(v=> typeof v === 'number' && v > 1000))).sort((a,b)=>a-b);
      if (filtered.length) _state.windows = filtered;
    }
    if (!_state.enabled){ /* 保留数据，便于关闭期间查看 */ }
    return _state.enabled;
  }

  function recordWsEventRateEvent(ts){
    if (!_state.enabled) return;
    const now = ts || Date.now();
    _state.events.push(now);
    // 裁剪：只保留最近最大窗口 * 2 的范围作为冗余（避免频繁 splice 影响性能）
    const maxWin = _state.windows[_state.windows.length - 1] || 0;
    const cutoff = now - maxWin * 2; // 留 2x 避免窗口跳动频繁重建
    // 找第一个 >= cutoff 的索引
    if (_state.events.length > MAX_EVENTS || (_state.events.length && _state.events[0] < cutoff)){
      let idx = 0;
      while(idx < _state.events.length && _state.events[idx] < cutoff) idx++;
      if (idx > 0) _state.events.splice(0, idx);
    }
  }

  function exportWsEventRates(opts){
    opts = opts || {};
    const now = Date.now();
    const result = [];
    for (const win of _state.windows){
      const since = now - win;
      // 逆序遍历提早终止
      let count = 0; let newest = 0; let oldest = 0;
      for (let i = _state.events.length - 1; i >= 0; i--) {
        const t = _state.events[i];
        if (t < since) break;
        count++;
        if (!newest || t > newest) newest = t;
        oldest = t; // 逆序最后一次赋值即最早的
      }
      const rate = win > 0 ? +(count / (win/1000)).toFixed(3) : 0;
      result.push({ windowMs: win, count, ratePerSec: rate, oldestTs: oldest || null, newestTs: newest || null });
    }
    if (opts.reset){ _state.events = []; }
    return { windows: result, totalStored: _state.events.length };
  }

  window.enableWsEventRates = enableWsEventRates;
  window.recordWsEventRateEvent = recordWsEventRateEvent;
  window.exportWsEventRates = exportWsEventRates;
  console.log('✅ ws-event-rates 已加载 (enableWsEventRates)');
})();
