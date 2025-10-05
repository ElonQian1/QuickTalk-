/* state-texts-validate.js
 * 校验 StateTexts / Schema 命名与注释质量
 * API: window.validateStateTextsSchema(options?) -> issues[]
 * 依赖：exportStateTextsSchema 已加载（若未加载则直接构建最小 schema）
 * Issue 类型：
 *  - DUPLICATE_VALUE: 不同 key 拥有相同 defaultValue（可能可合并）
 *  - INCONSISTENT_SUFFIX: 同前缀(基础部分)混用 FAIL/ERROR/GENERIC 等后缀
 *  - LONE_PREFIX: 前缀仅出现一次（不在白名单且不是 misc）
 *  - MISSING_NOTE: 重要分组 key 缺少 note
 */
(function(){
  'use strict';
  if (window.validateStateTextsSchema) return; // 幂等

  const IMPORTANT_GROUPS = new Set(['message','reconnect','heartbeat','adaptive']);
  const LONE_PREFIX_WHITELIST = new Set(['GENERIC','RETRY']);
  const SUFFIX_SET = ['FAIL','ERROR','GENERIC'];

  function buildSchemaFallback(){
    if (!window.StateTexts) return [];
    return Object.keys(window.StateTexts).sort().map(k=>({
      key:k,
      defaultValue: window.StateTexts[k],
      group: 'unknown',
      note: ''
    }));
  }

  function extractPrefix(key){
    // 取第一段或前两段作为逻辑前缀，如 MESSAGE_SEND_FINAL_FAIL -> MESSAGE_SEND
    const parts = key.split('_');
    if (parts.length <= 2) return parts[0];
    return parts.slice(0, 2).join('_');
  }

  function detectSuffix(key){
    for (const s of SUFFIX_SET){ if (key.endsWith('_'+s)) return s; }
    return null;
  }

  function ruleDuplicateValue(schema){
    const map = new Map();
    schema.forEach(r=>{
      if (!map.has(r.defaultValue)) map.set(r.defaultValue, []);
      map.get(r.defaultValue).push(r.key);
    });
    const issues = [];
    map.forEach((keys,val)=>{
      if (val && val.length > 0 && keys.length > 1) {
        issues.push({ type:'DUPLICATE_VALUE', keys, value: val, detail:`多个key共用相同文案: ${val}` , suggestion:'考虑合并或加前缀区分场景'});
      }
    });
    return issues;
  }

  function ruleInconsistentSuffix(schema){
    const bucket = new Map();
    schema.forEach(r=>{
      const prefix = extractPrefix(r.key);
      const suffix = detectSuffix(r.key);
      if (!bucket.has(prefix)) bucket.set(prefix, new Set());
      if (suffix) bucket.get(prefix).add(suffix);
    });
    const issues = [];
    bucket.forEach((set,prefix)=>{
      if (set.size > 1){
        issues.push({ type:'INCONSISTENT_SUFFIX', prefix, suffixes:Array.from(set), detail:`前缀 ${prefix} 混用后缀: ${Array.from(set).join(',')}`, suggestion:'统一为单一后缀 (优先 FAIL 或 ERROR)' });
      }
    });
    return issues;
  }

  function ruleLonePrefix(schema){
    const counts = new Map();
    schema.forEach(r=>{ const p = extractPrefix(r.key); counts.set(p,(counts.get(p)||0)+1); });
    const issues = [];
    counts.forEach((cnt,prefix)=>{
      if (cnt === 1 && !LONE_PREFIX_WHITELIST.has(prefix)){
        issues.push({ type:'LONE_PREFIX', prefix, detail:`前缀 ${prefix} 仅出现一次`, suggestion:'若非特例，可统一前缀或合并语义' });
      }
    });
    return issues;
  }

  function ruleMissingNote(schema){
    const issues = [];
    schema.forEach(r=>{
      if (IMPORTANT_GROUPS.has(r.group) && !r.note){
        issues.push({ type:'MISSING_NOTE', key:r.key, group:r.group, detail:`关键分组 ${r.group} 缺少 note`, suggestion:'在 __META 中补充 note 或扩展 autoNote 规则' });
      }
    });
    return issues;
  }

  window.validateStateTextsSchema = function(options){
    options = options || {};
    let schema = [];
    if (typeof window.exportStateTextsSchema === 'function') {
      schema = window.exportStateTextsSchema();
    } else {
      schema = buildSchemaFallback();
    }
    const rules = [
      ruleDuplicateValue,
      ruleInconsistentSuffix,
      ruleLonePrefix,
      ruleMissingNote
    ];
    let issues = [];
    rules.forEach(fn=>{ try { issues = issues.concat(fn(schema)); } catch(e){ console.warn('schema rule error', fn.name, e); } });
    if (!options.silent){
      if (issues.length === 0) {
        console.log('✅ StateTexts 校验通过 (0 issues)');
      } else {
        console.warn(`⚠️ StateTexts 校验发现 ${issues.length} 条问题`, issues);
      }
    }
    return issues;
  };

  console.log('✅ state-texts-validate 已加载 (validateStateTextsSchema)');
})();
