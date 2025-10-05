/* state-texts-hash.js
 * 统一生成 StateTexts 哈希，用于版本识别 / 上报去重 / 缓存。
 * API: window.computeStateTextsHash() -> string
 * 算法：djb2 + keyCount + totalLen 附加信息，保持与早期实现兼容（hash 主体一致）。
 */
(function(){
  'use strict';
  if (window.computeStateTextsHash) return; // 幂等
  function compute(){
    try {
      if (!window.StateTexts) return '';
      if (window.__STATE_TEXTS_HASH__) return window.__STATE_TEXTS_HASH__;
      const keys = Object.keys(window.StateTexts).filter(k=> k !== '__META').sort();
      const entries = keys.map(k => k + '=' + window.StateTexts[k]);
      let hash = 5381; // djb2
      let totalLen = 0;
      for (let i=0;i<entries.length;i++){
        const s = entries[i] + '\n';
        totalLen += s.length;
        for (let j=0;j<s.length;j++) hash = ((hash << 5) + hash) + s.charCodeAt(j);
      }
      const h = (hash >>> 0).toString(16) + ':' + keys.length + ':' + totalLen;
      window.__STATE_TEXTS_HASH__ = h;
      return h;
    } catch(_){ return ''; }
  }
  window.computeStateTextsHash = compute;
  console.log('✅ state-texts-hash 已加载 (computeStateTextsHash)');
})();
