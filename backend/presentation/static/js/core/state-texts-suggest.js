/* state-texts-suggest.js
 * 文案命名模式分析与建议生成工具
 * 目标：减少新增 key 的随意性，维持命名结构一致。
 * API:
 *   analyzeStateTextPatterns() -> { prefixes:[...], patterns:[ { prefix, structure, sampleKeys } ] }
 *   suggestStateTextKey({ prefix, action, result, rawParts? }) -> { key, exists, suggestion, reason }
 *   printStateTextPatternSummary() -> 控制台表格输出
 * 说明：
 *   目前通过扫描现有 KEY 拆分 '_'，统计 prefix(首段) 与 三段式结构 PREFIX_ACTION_RESULT。
 */
(function(){
  'use strict';
  if (window.analyzeStateTextPatterns) return; // 幂等

  function _collectKeys(){
    if (!window.StateTexts) return [];
    return Object.keys(window.StateTexts).filter(k=>k!=='__META');
  }

  function _analyze(){
    const keys = _collectKeys();
    const prefixCount = new Map();
    const trigramMap = new Map(); // prefix_action_result -> samples
    keys.forEach(k=>{
      const parts = k.split('_'); if (!parts.length) return;
      const prefix = parts[0];
      prefixCount.set(prefix, (prefixCount.get(prefix)||0)+1);
      if (parts.length === 3){
        const sig = parts.join('_');
        if (!trigramMap.has(prefix)) trigramMap.set(prefix, new Map());
        const inner = trigramMap.get(prefix);
        const actionResult = parts.slice(1).join('_');
        if (!inner.has(actionResult)) inner.set(actionResult, []);
        const arr = inner.get(actionResult);
        if (arr.length < 5) arr.push(k); // 采样限制
      }
    });
    const prefixes = Array.from(prefixCount.entries()).map(([prefix,count])=>({ prefix, count })).sort((a,b)=> b.count - a.count || a.prefix.localeCompare(b.prefix));
    const patterns = [];
    trigramMap.forEach((inner,prefix)=>{
      inner.forEach((samples,ar)=>{
        patterns.push({ prefix, structure: prefix + '_' + ar, sampleKeys: samples });
      });
    });
    return { prefixes, patterns };
  }

  window.analyzeStateTextPatterns = function(){
    return _analyze();
  };

  window.printStateTextPatternSummary = function(){
    const { prefixes, patterns } = _analyze();
    console.groupCollapsed('StateTexts Pattern Summary');
    console.table(prefixes.slice(0,20));
    console.table(patterns.slice(0,30));
    console.groupEnd();
    return { prefixes, patterns };
  };

  window.suggestStateTextKey = function(opts){
    opts = opts || {}; const { prefix, action, result, rawParts } = opts;
    if (rawParts && Array.isArray(rawParts) && rawParts.length){
      const key = rawParts.join('_').toUpperCase();
      return { key, exists: !!(window.StateTexts && window.StateTexts[key]), suggestion: key, reason: 'rawParts组合' };
    }
    if (!prefix) return { key:'', exists:false, suggestion:'', reason:'缺少 prefix' };
    // 规范：全部大写
    const norm = s => (s||'').trim().toUpperCase();
    const p = norm(prefix);
    const a = action ? norm(action) : null;
    const r = result ? norm(result) : null;

    // 优先三段式 p_a_r
    if (a && r){
      const key = [p,a,r].join('_');
      const exists = !!(window.StateTexts && window.StateTexts[key]);
      return { key, exists, suggestion: exists? key : key, reason: '三段式建议' };
    }
    // 次优：双段或仅前缀 + 语义后缀 FAIL/ERROR
    if (a && !r){
      const candidates = ['FAIL','ERROR','GENERIC'];
      for (const suf of candidates){
        const key = [p,a,suf].join('_');
        if (!(window.StateTexts && window.StateTexts[key])){
          return { key, exists:false, suggestion:key, reason:`追加后缀 ${suf}` };
        }
      }
      return { key: p + '_' + a + '_FAIL', exists:true, suggestion:p + '_' + a + '_FAIL', reason:'全部占用，返回已有' };
    }
    // 仅 prefix：返回一个提示
    return { key:p, exists: !!(window.StateTexts && window.StateTexts[p]), suggestion:p + '_GENERIC', reason:'仅提供 prefix，建议加泛化后缀' };
  };

  // 模块注册
  if (typeof window.ModuleLoader?.registerModule === 'function') {
      window.ModuleLoader.registerModule('state-texts-suggest', 'core', 'state-texts-suggest 已加载 (analyzeStateTextPatterns, suggestStateTextKey)');
  } else {
      console.log('✅ state-texts-suggest 已加载 (analyzeStateTextPatterns, suggestStateTextKey)');
  }
})();
