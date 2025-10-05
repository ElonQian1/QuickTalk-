/* ws-sparkline-util.js
 * 维护窗口 / 分类 spike 速率历史，用于在诊断面板中渲染 sparkline。
 * 设计:
 *   recordWindows(ratesWindowsArray)  // 传入 exportWsEventRates().windows
 *   recordCategories(catSpikesItems)  // 传入 category spikes items (含 category, ratePerMin)
 *   getWindowHistory(windowMs) -> [rates...]
 *   getCategoryHistory(category) -> [ratesPerMin...]
 * 历史长度限制: 默认保留最近 MAX_LEN=24 (约随刷新 2s*24=48s, 可覆盖多轮刷新)。
 * 单例: window.__WS_SPARK_HIST__
 */
(function(){
  'use strict';
  if (window.__WS_SPARK_HIST__) return; // 幂等
  const MAX_LEN = 24;
  const winHist = new Map(); // key: windowMs(string)
  const catHist = new Map(); // key: category
  function _push(map, key, val){
    if (val==null || isNaN(val)) return;
    let arr = map.get(key);
    if (!arr){ arr = []; map.set(key, arr); }
    arr.push(val);
    if (arr.length > MAX_LEN) arr.splice(0, arr.length - MAX_LEN);
  }
  const api = {
    recordWindows(wins){
      if (!Array.isArray(wins)) return;
      wins.forEach(w=>{ if (w && typeof w.windowMs==='number' && typeof w.ratePerSec==='number') _push(winHist, String(w.windowMs), +w.ratePerSec.toFixed(3)); });
    },
    recordCategories(items){
      if (!Array.isArray(items)) return;
      items.forEach(it=>{ if (it && it.category && typeof it.ratePerMin==='number') _push(catHist, it.category, +it.ratePerMin.toFixed(2)); });
    },
    getWindowHistory(ms){ return winHist.get(String(ms)) || []; },
    getCategoryHistory(cat){ return catHist.get(cat) || []; }
  };
  window.__WS_SPARK_HIST__ = api;
  console.log('✅ ws-sparkline-util 已加载 (__WS_SPARK_HIST__)');
})();
