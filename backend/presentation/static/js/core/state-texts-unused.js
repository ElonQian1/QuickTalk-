/* state-texts-unused.js
 * 检测未使用 / 低使用 / 老化 的 StateTexts 文案键。
 * 扩展：
 *   - 双条件模式：threshold + maxAgeMs 组合 (mode: 'and' | 'or')
 *   - 返回 flags: ['lowUsage','stale']
 *   - 可选 includeAge (默认 true) 输出 ageMs
 */
(function(){
  'use strict';
  if (window.exportUnusedTextKeys && window.exportUnusedTextKeys.__ENHANCED__) return; // 幂等（允许覆盖旧版

  const DEFAULT_WHITELIST_PREFIXES = [
    // 这里可以放置一些即便未访问也暂不判为未使用的前缀
    'DEV_', 'EXPERIMENT_' // 示例
  ];

  function exportUnusedTextKeys(options){
    options = options || {};
    const threshold = (options.threshold !== undefined) ? options.threshold : 0; // 次数 <= threshold 视为低使用
    const whitelist = Array.isArray(options.whitelistPrefixes) ? options.whitelistPrefixes : DEFAULT_WHITELIST_PREFIXES;
    const includeUsageCounts = options.includeUsageCounts !== false; // 默认包含 count
    const includeAge = options.includeAge !== false; // 默认包含 ageMs
    const maxAgeMs = (options.maxAgeMs != null) ? options.maxAgeMs : null; // age 需 >= maxAgeMs 判为 stale
    const mode = (options.mode === 'and' || options.mode === 'or') ? options.mode : 'or';

    const all = (window.StateTexts && typeof window.StateTexts === 'object') ? window.StateTexts : {};
    const keys = Object.keys(all).filter(k => k !== '__META');

    // usage snapshot
    let usageMap = new Map();
    try {
      if (window.exportTextUsageStats) {
        const statsArr = window.exportTextUsageStats({ reset:false }) || [];
        usageMap = new Map(statsArr.map(r => [r.key, r.count]));
      }
    } catch(_){ }

    // lastUsed snapshot
    let lastUsedMap = null;
    if (includeAge && typeof window.exportTextLastUsedStats === 'function') {
      try {
        const luArr = window.exportTextLastUsedStats();
        lastUsedMap = new Map(luArr.map(r => [r.key, r]));
      } catch(_){ lastUsedMap = null; }
    }

    function isWhitelisted(k){ for (let i=0;i<whitelist.length;i++){ if (k.startsWith(whitelist[i])) return true; } return false; }

    const unused = [];
    for (const k of keys){
      if (isWhitelisted(k)) continue;
      const cnt = usageMap.has(k) ? usageMap.get(k) : 0;
      const ageRec = lastUsedMap ? lastUsedMap.get(k) : null;
      const ageMs = ageRec ? ageRec.ageMs : null;
      const lowUsage = cnt <= threshold;
      const stale = (maxAgeMs != null && ageMs != null && ageMs >= maxAgeMs);
      let pick = false;
      if (mode === 'and') { pick = lowUsage && (maxAgeMs==null ? lowUsage : stale); }
      else { // 'or'
        pick = lowUsage || (stale && maxAgeMs!=null);
      }
      if (!pick) continue;
      const flags = [];
      if (lowUsage) flags.push('lowUsage');
      if (stale) flags.push('stale');
      const base = { key: k };
      if (includeUsageCounts) base.count = cnt;
      if (includeAge) base.ageMs = ageMs;
      base.flags = flags;
      unused.push(base);
    }

    // 排序策略：flags多的优先 -> count升序 -> ageMs降序 -> key
    unused.sort((a,b)=>{
      const fc = (b.flags.length - a.flags.length); if (fc !== 0) return fc;
      if (a.count !== b.count) return (a.count||0) - (b.count||0);
      if ((b.ageMs||0) !== (a.ageMs||0)) return (b.ageMs||0) - (a.ageMs||0);
      return a.key.localeCompare(b.key);
    });

    return {
      unused,
      stats: {
        total: keys.length,
        scanned: keys.length,
        unusedCount: unused.length,
        threshold,
        maxAgeMs,
        mode,
        whitelistPrefixes: whitelist.slice()
      }
    };
  }

  exportUnusedTextKeys.__ENHANCED__ = true;
  window.exportUnusedTextKeys = exportUnusedTextKeys;
  console.log('✅ state-texts-unused 已加载 (exportUnusedTextKeys + dual-condition)');
})();
