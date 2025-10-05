/* text-cleanup-suggest.js
 * 生成文本治理清理建议，将多源信号整合为可排序列表。
 * 信号来源：
 *   - Unused/低使用/老化: exportUnusedTextKeys(含 flags)
 *   - 前缀聚合: exportTextPrefixHeat (识别“碎片化小前缀”)
 *   - Schema 校验: validateStateTextsSchema (命名/注释问题)
 *   - 命名建议: suggestStateTextKey（仅用于后续扩展，当前不批量调用以免噪声）
 * 输出字段：
 *   item = { kind:'key'|'prefix'|'issue', target, reasons:[...], flags:[...], score:Number, meta:{} }
 * 评分启发式：
 *   - stale + lowUsage: +40
 *   - lowUsage only: +25
 *   - stale only: +20
 *   - 碎片化小前缀: +15 (keyCount<=2 & totalCount<=minPrefixTotal)
 *   - 命名/注释 issue: +10
 *   - 多重信号叠加累加；score 降序排序
 * API:
 *   exportTextCleanupSuggest(opts?) -> { generatedAt, items:[...], stats:{} }
 */
(function(){
  'use strict';
  if (window.exportTextCleanupSuggest) return; // 幂等

  function exportTextCleanupSuggest(opts){
    opts = opts || {};
    const threshold = opts.threshold != null ? opts.threshold : 0;
    const maxAgeMs = opts.maxAgeMs != null ? opts.maxAgeMs : null;
    const unusedMode = opts.unusedMode === 'and' || opts.unusedMode === 'or' ? opts.unusedMode : 'or';
    const minPrefixTotal = opts.minPrefixTotal != null ? opts.minPrefixTotal : 5;
    const maxItems = opts.maxItems != null ? opts.maxItems : 200;

    const items = [];
    const stats = { unused:0, prefixSmall:0, issues:0 };

    // 1. Unused / 低使用
    let unusedData = null;
    if (typeof window.exportUnusedTextKeys === 'function') {
      try { unusedData = window.exportUnusedTextKeys({ threshold, maxAgeMs, mode: unusedMode, includeUsageCounts:true, includeAge:true }); } catch(_){ unusedData = null; }
    }
    if (unusedData && Array.isArray(unusedData.unused)){
      unusedData.unused.forEach(r => {
        const reasons = [];
        let score = 0;
        if (r.flags && r.flags.includes('lowUsage')){ reasons.push('lowUsage'); score += 25; }
        if (r.flags && r.flags.includes('stale')){ reasons.push('stale'); score += (r.flags.includes('lowUsage')? 15 : 20); }
        items.push({ kind:'key', target:r.key, reasons, flags:r.flags.slice(), score, meta:{ count:r.count, ageMs:r.ageMs } });
      });
      stats.unused = unusedData.unused.length;
    }

    // 2. 前缀碎片化（小前缀）
    if (typeof window.exportTextPrefixHeat === 'function'){
      try {
        const ph = window.exportTextPrefixHeat({ depth:1, topKeyN:3 });
        (ph.items||[]).forEach(p => {
          if (p.keyCount <= 2 && p.totalCount <= minPrefixTotal){
            items.push({ kind:'prefix', target:p.prefix, reasons:['fragmentedPrefix'], flags:['prefixSmall'], score:15, meta:{ keyCount:p.keyCount, totalCount:p.totalCount } });
            stats.prefixSmall++;
          }
        });
      } catch(_){ }
    }

    // 3. Schema issues (命名 / 注释)
    if (typeof window.validateStateTextsSchema === 'function'){
      try {
        const issues = window.validateStateTextsSchema({ silent:true }) || [];
        issues.forEach(issue => {
          let score = 10; const reasons=[issue.type];
            items.push({ kind:'issue', target: issue.key || issue.prefix || 'n/a', reasons, flags:[issue.type], score, meta: issue });
        });
        stats.issues = issues.length;
      } catch(_){ }
    }

    // 合并同 target（不同来源） -> 聚合 score/reasons/flags
    const merged = new Map();
    for (const it of items){
      const id = it.kind + ':' + it.target;
      if (!merged.has(id)) { merged.set(id, { kind:it.kind, target:it.target, reasons:new Set(), flags:new Set(), score:0, meta:{} }); }
      const slot = merged.get(id);
      it.reasons.forEach(r=>slot.reasons.add(r));
      it.flags.forEach(f=>slot.flags.add(f));
      slot.score += it.score;
      // 合并 meta 简单策略：首个+补充
      slot.meta = Object.assign({}, it.meta, slot.meta);
    }
    let final = Array.from(merged.values()).map(v => ({
      kind: v.kind,
      target: v.target,
      reasons: Array.from(v.reasons),
      flags: Array.from(v.flags),
      score: v.score,
      meta: v.meta
    }));

    // 排序：score desc -> reasons 多 -> target
    final.sort((a,b)=> b.score - a.score || (b.reasons.length - a.reasons.length) || a.target.localeCompare(b.target));
    if (final.length > maxItems) final = final.slice(0, maxItems);

    return {
      generatedAt: new Date().toISOString(),
      items: final,
      stats: Object.assign(stats, { total: final.length })
    };
  }

  window.exportTextCleanupSuggest = exportTextCleanupSuggest;
  console.log('✅ text-cleanup-suggest 已加载 (exportTextCleanupSuggest)');
})();
