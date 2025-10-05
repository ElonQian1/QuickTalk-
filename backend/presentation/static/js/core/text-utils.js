/* text-utils.js
 * 统一文本访问助手，消除早期分散的文案访问样板代码。
 * 用法： getText('EMPTY_SHOPS','暂无可用店铺')
 * 缺失键跟踪：调用不存在的键会被记录并在聚合窗口后一次性 console.warn；
 *   手动触发： window.reportMissingTextKeys()
 * 结果缓存： window.__LAST_MISSING_TEXT_KEYS__ 保存最近一次上报列表
 * 设计：轻量、幂等、无依赖；允许未来挂接多语言。
 */
(function(){
  'use strict';
  if (window.getText) return; // 幂等

  const _missingKeys = new Set();
  let _reportTimer = null;
  const _reportDelay = 1500; // 聚合上报等待窗口

  function _scheduleReport(){
    if (_reportTimer) return;
    _reportTimer = setTimeout(()=>{
      _reportTimer = null;
      if (_missingKeys.size === 0) return;
      const list = Array.from(_missingKeys).sort();
      try { console.warn('[TextKeys][Missing]', list); } catch(_){ }
      window.__LAST_MISSING_TEXT_KEYS__ = list;
    }, _reportDelay);
  }

  window.getText = function(key, fallback){
    if (!key) return fallback || '';
    try {
      if (window.StateTexts && Object.prototype.hasOwnProperty.call(window.StateTexts, key)) {
        const val = window.StateTexts[key];
        if (_usage.enabled) {
          const prev = _usage.map.get(key) || 0; _usage.map.set(key, prev + 1);
          if (_lastUsed.enabled) _lastUsed.map.set(key, Date.now());
        } else if (_lastUsed.enabled) {
          // 即便未开启 usage 统计也可单独记录 lastUsed
          _lastUsed.map.set(key, Date.now());
        }
        return val;
      }
    } catch(_){ }
    // 记录缺失键（仅在提供显式 fallback 时才认为可缺失；若无 fallback 则也记录）
    try {
      const added = !_missingKeys.has(key);
      _missingKeys.add(key);
      if (added && _textReporting.enabled) {
        const rate = _textReporting.sampleRate || 1;
        if (Math.random() <= rate) { _pendingReportKeys.add(key); _scheduleBatchSend(); }
      }
      _scheduleReport();
    } catch(_){ }
    return (fallback !== undefined) ? fallback : key;
  };

  window.getTexts = function(map){
    if (!map || typeof map !== 'object') return {};
    const out = {};
    for (const k in map){ if (Object.prototype.hasOwnProperty.call(map,k)) out[k] = getText(k, map[k]); }
    return out;
  };

  // 手动报告接口（可用于测试或在路由切换后立即查看）
  window.reportMissingTextKeys = function(){
    if (_missingKeys.size === 0) { console.info('[TextKeys] No missing keys'); return []; }
    const list = Array.from(_missingKeys).sort();
    console.warn('[TextKeys][ManualReport]', list);
    return list;
  };

  /* ===================== 远程缺失键上报 Hook ===================== */
  const _textReporting = {
    enabled: false,
    endpoint: '',
    batchIntervalMs: 5000,
    maxBatchSize: 100,
    onError: null,
    backoffFailures: 0,
    maxFailures: 3,
    cooldownMs: 60000, // 连续失败后暂停 1 分钟
    cooldownUntil: 0,
    sampleRate: 1 // (0,1] 缺失键上报采样率
  };
  let _pendingReportKeys = new Set();
  let _batchTimer = null;

  function _ensureHash(){
    // 尝试使用全局 computeStateTextsHash，若未加载则做一次简易计算（不含长度附加）
    if (typeof window.computeStateTextsHash === 'function') return window.computeStateTextsHash();
    try {
      if (window.__STATE_TEXTS_HASH__) return window.__STATE_TEXTS_HASH__;
      if (!window.StateTexts) return '';
      const entries = Object.keys(window.StateTexts).filter(k=>k!=='__META').sort().map(k => k + '=' + window.StateTexts[k]);
      let hash = 5381;
      for (let i=0;i<entries.length;i++){
        const s = entries[i] + '\n';
        for (let j=0;j<s.length;j++) hash = ((hash << 5) + hash) + s.charCodeAt(j);
      }
      const h = (hash >>> 0).toString(16);
      window.__STATE_TEXTS_HASH__ = h;
      return h;
    } catch(_){ return ''; }
  }

  function _scheduleBatchSend(){
    if (!_textReporting.enabled) return;
    const now = Date.now();
    if (_textReporting.cooldownUntil && now < _textReporting.cooldownUntil) return; // 冷却中
    if (_batchTimer) return;
    _batchTimer = setTimeout(()=>{ _batchTimer = null; _flushBatchSend(false); }, _textReporting.batchIntervalMs);
  }

  function _flushBatchSend(forced){
    if (!_textReporting.enabled) return [];
    const now = Date.now();
    if (!forced && _textReporting.cooldownUntil && now < _textReporting.cooldownUntil) return [];
    if (_pendingReportKeys.size === 0) return [];
    const all = Array.from(_pendingReportKeys).sort();
    const batch = all.slice(0, _textReporting.maxBatchSize);
    // 剩余的保留在集合中（未发送部分）
    _pendingReportKeys = new Set(all.slice(batch.length));
    const payload = {
      keys: batch,
      ts: new Date().toISOString(),
      textsHash: _ensureHash(),
      ua: (navigator && navigator.userAgent) ? navigator.userAgent : ''
    };
    try {
      fetch(_textReporting.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) throw new Error('status ' + res.status);
        _textReporting.backoffFailures = 0; // 成功重置
      }).catch(err => {
        _textReporting.backoffFailures++;
        if (_textReporting.onError) { try { _textReporting.onError(err); } catch(_){} }
        if (_textReporting.backoffFailures >= _textReporting.maxFailures){
          _textReporting.cooldownUntil = Date.now() + _textReporting.cooldownMs;
          console.warn('[TextKeys][Report] 达到失败上限，进入冷却', _textReporting.cooldownMs + 'ms');
        } else {
          // 指数退避重新调度
          const backoff = Math.min(30000, Math.pow(2, _textReporting.backoffFailures) * 1000);
          setTimeout(()=>{ _scheduleBatchSend(); }, backoff);
        }
        // 发送失败的键应重新回填待发送集合
        for (const k of batch) _pendingReportKeys.add(k);
      });
    } catch(err){
      if (_textReporting.onError) { try { _textReporting.onError(err); } catch(_){} }
      for (const k of batch) _pendingReportKeys.add(k);
    }
    return batch;
  }

  window.configureTextReporting = function(cfg){
    if (!cfg || typeof cfg !== 'object') return Object.assign({}, _textReporting);
    if (cfg.endpoint !== undefined) _textReporting.endpoint = cfg.endpoint;
    if (cfg.enabled !== undefined) _textReporting.enabled = !!cfg.enabled;
    if (cfg.batchIntervalMs !== undefined) _textReporting.batchIntervalMs = Math.max(500, cfg.batchIntervalMs|0);
    if (cfg.maxBatchSize !== undefined) _textReporting.maxBatchSize = Math.max(1, cfg.maxBatchSize|0);
    if (cfg.onError !== undefined) _textReporting.onError = cfg.onError;
    if (cfg.maxFailures !== undefined) _textReporting.maxFailures = Math.max(1, cfg.maxFailures|0);
    if (cfg.cooldownMs !== undefined) _textReporting.cooldownMs = Math.max(1000, cfg.cooldownMs|0);
    if (cfg.sampleRate !== undefined) {
      let r = Number(cfg.sampleRate);
      if (!(r > 0 && r <= 1)) r = 1;
      _textReporting.sampleRate = r;
    }
    if (_textReporting.enabled && !_textReporting.endpoint){
      console.warn('[TextKeys][Report] 已启用但未配置 endpoint');
    }
    // 立即计算 hash（懒加载也可，这里主动）
    _ensureHash();
    // 若已有待发送内容则调度
    if (_pendingReportKeys.size) _scheduleBatchSend();
    return Object.assign({}, _textReporting);
  };

  window.flushReportedMissingKeys = function(){
    return _flushBatchSend(true);
  };

  /* ===================== 文本使用频率统计 ===================== */
  const _usage = { enabled: false, map: new Map() };
  window.enableTextUsageStats = function(flag){ _usage.enabled = !!flag; if (!flag) _usage.map.clear(); return _usage.enabled; };
  window.exportTextUsageStats = function(opts){ opts = opts || {}; const arr = []; _usage.map.forEach((v,k)=> arr.push({ key:k, count:v })); arr.sort((a,b)=> b.count - a.count || a.key.localeCompare(b.key)); if (opts.reset) _usage.map.clear(); return arr; };

  /* ===================== 文本最后使用时间 ===================== */
  const _lastUsed = { enabled: false, map: new Map() };
  window.enableTextLastUsed = function(flag){ _lastUsed.enabled = !!flag; if (!flag) _lastUsed.map.clear(); return _lastUsed.enabled; };
  window.exportTextLastUsedStats = function(opts){
    opts = opts || {}; const arr = [];
    _lastUsed.map.forEach((ts,k)=> arr.push({ key:k, lastUsed: ts }));
    arr.sort((a,b)=> (b.lastUsed - a.lastUsed) || a.key.localeCompare(b.key));
    const now = Date.now();
    return arr.map(r => ({ key: r.key, lastUsed: r.lastUsed, ageMs: now - r.lastUsed }));
  };

  console.log('✅ text-utils 已加载 (getText, getTexts, missing-keys, reporting, usage-stats, lastUsed)');
})();