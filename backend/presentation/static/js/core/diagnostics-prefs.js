/* diagnostics-prefs.js
 * 调试面板参数持久化：将用户在面板中设置的阈值/过滤/深度等保存到 localStorage
 * 仅负责读写，不做业务逻辑；面板加载时调用 loadDiagnosticsPrefs() 合并默认值。
 * Key: 'qt_diag_prefs_v1'
 * 结构示例：{
 *   spike:{ factorMin, rateMin, topN, sustainMin, baselineMode },
 *   catSpike:{ factorMin, rateMinPerMin, topN, sustainMin, baselineMode },
 *   unused:{ threshold, maxAgeMs, mode },
 *   prefix:{ depth, topN }
 * }
 */
(function(){
  'use strict';
  if (window.loadDiagnosticsPrefs) return; // 幂等

  const LS_KEY = 'qt_diag_prefs_v1';

  function loadDiagnosticsPrefs(){
    try {
      const raw = localStorage.getItem(LS_KEY); if (!raw) return {};
      const obj = JSON.parse(raw); return (obj && typeof obj==='object')? obj : {};
    } catch(_){ return {}; }
  }

  function saveDiagnosticsPrefs(prefs){
    try { localStorage.setItem(LS_KEY, JSON.stringify(prefs||{})); } catch(_){ }
  }

  window.loadDiagnosticsPrefs = loadDiagnosticsPrefs;
  window.saveDiagnosticsPrefs = saveDiagnosticsPrefs;
  console.log('✅ diagnostics-prefs 已加载 (loadDiagnosticsPrefs/saveDiagnosticsPrefs)');
})();
