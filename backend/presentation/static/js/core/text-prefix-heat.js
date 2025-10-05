/* text-prefix-heat.js
 * 文本 Key 前缀聚合热度统计 (基于 exportTextUsageStats 输出)
 * 目的：帮助发现命名结构中高热集群与碎片化前缀，辅助治理/归档
 * 特性：
 *   - 支持 depth=1 或 2 (基于 '_' 或 '.' 分隔符；选择出现次数更多的分隔符作为主分隔)
 *   - 计算每个前缀下：totalCount, keyCount, avgCount, topKeys(截取前N)
 *   - 可选最小总计数/最小 key 个数过滤
 * API:
 *   exportTextPrefixHeat(options?) -> { depth, delimiter, totalPrefixes, items:[ { prefix,totalCount,keyCount,avgCount,topKeys } ] }
 */
(function(){
  'use strict';
  if (window.exportTextPrefixHeat) return; // 幂等

  function _chooseDelimiter(keys){
    let underscore = 0, dot = 0;
    for (const k of keys){ if (k.indexOf('_') !== -1) underscore++; if (k.indexOf('.') !== -1) dot++; }
    if (underscore === 0 && dot === 0) return '_';
    if (underscore >= dot) return '_';
    return '.';
  }

  function exportTextPrefixHeat(opts){
    opts = opts || {};
    const depth = (opts.depth === 2) ? 2 : 1;
    const minTotal = opts.minTotal || 0;
    const minKeys = opts.minKeys || 0;
    const topKeyN = opts.topKeyN || 5;
    const usageArr = (typeof window.exportTextUsageStats==='function') ? window.exportTextUsageStats({ reset:false }) : [];
    if (!usageArr.length) return { depth, delimiter: '_', totalPrefixes:0, items:[] };
    const keys = usageArr.map(r=>r.key);
    const delimiter = _chooseDelimiter(keys);
    const agg = new Map(); // prefix -> { totalCount, entries:[{key,count}] }
    for (const row of usageArr){
      const parts = row.key.split(delimiter);
      if (parts.length < 1) continue;
      const prefix = (depth===2 && parts.length>1) ? parts[0] + delimiter + parts[1] : parts[0];
      const slot = agg.get(prefix) || { totalCount:0, entries:[] };
      slot.totalCount += row.count;
      slot.entries.push({ key: row.key, count: row.count });
      agg.set(prefix, slot);
    }
    const items = [];
    agg.forEach((v,prefix)=>{
      if (v.totalCount < minTotal) return;
      if (v.entries.length < minKeys) return;
      v.entries.sort((a,b)=> b.count - a.count || a.key.localeCompare(b.key));
      const keyCount = v.entries.length;
      const avg = +(v.totalCount / keyCount).toFixed(2);
      items.push({ prefix, totalCount: v.totalCount, keyCount, avgCount: avg, topKeys: v.entries.slice(0, topKeyN) });
    });
    // 排序：按 totalCount desc, 再 avg desc
    items.sort((a,b)=> b.totalCount - a.totalCount || b.avgCount - a.avgCount || a.prefix.localeCompare(b.prefix));
    return { depth, delimiter, totalPrefixes: items.length, items };
  }

  window.exportTextPrefixHeat = exportTextPrefixHeat;
  console.log('✅ text-prefix-heat 已加载 (exportTextPrefixHeat)');
})();
