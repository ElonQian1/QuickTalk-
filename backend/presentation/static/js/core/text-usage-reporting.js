/* text-usage-reporting.js
 * 文本使用率/热度远程上报模块 (与缺失键上报解耦)。
 * 目标：
 *  - 支持两种模式：hot(上报高频) / cold(上报低频或老化候选)
 *  - 支持采样、批量、最小使用次数/最大年龄过滤
 *  - 仅依赖已公开 API: exportTextUsageStats(), exportTextLastUsedStats()
 *  - 不直接访问内部私有 Map，保持低耦合
 * API:
 *  configureTextUsageReporting(cfg) -> 当前配置快照
 *  flushTextUsageReporting()        -> 强制立即发送（返回发送的条目）
 *  典型配置：
 *    configureTextUsageReporting({
 *       enabled: true,
 *       endpoint: '/api/text-usage',
 *       mode: 'hot',           // 'hot' | 'cold'
 *       batchIntervalMs: 10000,
 *       maxBatchSize: 120,
 *       sampleRate: 1,
 *       minCount: 1,           // hot 模式过滤低频噪声
 *       maxAgeMs: 7*24*3600*1000, // cold 模式参考的老化阈值（可选）
 *       topN: 60,              // 限制每批挑选的候选数量
 *       includeLastUsed: true,
 *       onError: (err)=>{}
 *    })
 */
(function(){
  'use strict';
  if (window.configureTextUsageReporting) return; // 幂等

  const _usageReporting = {
    enabled: false,
    endpoint: '',
    mode: 'hot', // 'hot' | 'cold'
    batchIntervalMs: 10000,
    maxBatchSize: 120,
    sampleRate: 1,
    minCount: 1,
    maxAgeMs: null,
    topN: 80,
    includeLastUsed: true,
    onError: null,
    backoffFailures: 0,
    maxFailures: 3,
    cooldownMs: 60000,
    cooldownUntil: 0,
    // Delta 模式参数
    enableDelta: false,
    minDelta: 1
  };

  let _timer = null;
  let _pending = []; // 暂存已挑选但尚未发送的队列（非重复）

  function _now(){ return Date.now(); }

  function _clearTimer(){ if (_timer){ clearTimeout(_timer); _timer=null; } }

  function _schedule(){
    if (!_usageReporting.enabled) return;
    const now = _now();
    if (_usageReporting.cooldownUntil && now < _usageReporting.cooldownUntil) return;
    if (_timer) return;
    _timer = setTimeout(()=>{ _timer=null; _flush(false); }, _usageReporting.batchIntervalMs);
  }

  function _chooseCandidates(){
    // 获取 usage 列表
    const usageArr = (typeof window.exportTextUsageStats==='function') ? window.exportTextUsageStats({ reset:false }) : [];
    // 获取 lastUsed 列表（可能为空）
    let lastUsedMap = new Map();
    if (_usageReporting.includeLastUsed && typeof window.exportTextLastUsedStats==='function') {
      try {
        const lu = window.exportTextLastUsedStats(); // [{ key, lastUsed, ageMs }]
        lastUsedMap = new Map(lu.map(r => [r.key, r]));
      } catch(_){ }
    }

    const now = _now();
    const mode = _usageReporting.mode;
    const minCount = _usageReporting.minCount || 0;
    const maxAgeMs = _usageReporting.maxAgeMs;

    let candidates = [];

    if (mode === 'hot') {
      // 高频：按 count 降序，过滤掉 count < minCount
      const filtered = usageArr.filter(r => r.count >= minCount);
      filtered.sort((a,b)=> b.count - a.count || a.key.localeCompare(b.key));
      candidates = filtered.slice(0, _usageReporting.topN);
    } else {
      // cold：按 (count 升序 + age 降序) 选出潜在冷门
      // 如果没有 usage 统计，则直接返回空
      usageArr.sort((a,b)=> a.count - b.count || a.key.localeCompare(b.key));
      const enriched = usageArr.map(r => {
        const lu = lastUsedMap.get(r.key);
        const ageMs = lu ? lu.ageMs : null;
        return { key: r.key, count: r.count, ageMs };
      });
      let list = enriched;
      if (maxAgeMs != null) list = list.filter(r => (r.ageMs != null) && r.ageMs >= maxAgeMs);
      // 再按 ageMs 降序优先老化
      list.sort((a,b)=> {
        const ac = a.count - b.count; if (ac !==0) return ac; // count 少优先
        const aa = (b.ageMs||0) - (a.ageMs||0); if (aa !==0) return aa; // age 大优先
        return a.key.localeCompare(b.key);
      });
      candidates = list.slice(0, _usageReporting.topN);
    }

    // 去除已经在 pending 中存在的 key
    if (_pending.length){
      const existing = new Set(_pending.map(i=>i.key));
      candidates = candidates.filter(c => !existing.has(c.key));
    }

    // 采样
    const rate = _usageReporting.sampleRate || 1;
    if (rate < 1) candidates = candidates.filter(()=> Math.random() <= rate);

    const ts = new Date().toISOString();
    return candidates.map(c => ({ key: c.key, count: c.count, ageMs: c.ageMs, ts }));
  }

  function _buildBatch(){
    // 先补充候选
    if (_pending.length < _usageReporting.maxBatchSize){
      const add = _chooseCandidates();
      if (add.length) _pending = _pending.concat(add);
    }
    if (_pending.length === 0) return [];
    const batch = _pending.slice(0, _usageReporting.maxBatchSize);
    _pending = _pending.slice(batch.length);
    return batch;
  }

  function _flush(forced){
    if (!_usageReporting.enabled) return [];
    const now = _now();
    if (!forced && _usageReporting.cooldownUntil && now < _usageReporting.cooldownUntil) return [];
    let batch = _buildBatch();
    // Delta 过滤：基于快照挑出增量
    if (_usageReporting.enableDelta) {
      if (!_delta.snapshot){ _delta.snapshot = new Map(); }
      const minDelta = _usageReporting.minDelta || 1;
      const deltas = [];
      for (const item of batch){
        const prev = _delta.snapshot.get(item.key) || 0;
        const inc = item.count - prev;
        if (inc >= minDelta){
          deltas.push(Object.assign({}, item, { delta: inc }));
          _delta.snapshot.set(item.key, item.count);
        }
      }
      batch = deltas;
      _delta.lastDeltaCount = batch.length;
      _delta.lastFlushTs = now;
      if (!batch.length){ return []; }
    }
    if (!batch.length) return [];
    const payload = {
      mode: _usageReporting.mode,
      items: batch,
      sentAt: new Date().toISOString(),
      meta: {
        sampleRate: _usageReporting.sampleRate,
        minCount: _usageReporting.minCount,
        maxAgeMs: _usageReporting.maxAgeMs,
        includeLastUsed: _usageReporting.includeLastUsed,
        delta: _usageReporting.enableDelta || false,
        minDelta: _usageReporting.minDelta || 1,
        lastDeltaCount: _delta.lastDeltaCount || 0
      }
    };
    try {
      fetch(_usageReporting.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(res => {
        if (!res.ok) throw new Error('status ' + res.status);
        _usageReporting.backoffFailures = 0;
      }).catch(err => {
        _usageReporting.backoffFailures++;
        if (_usageReporting.onError) { try { _usageReporting.onError(err); } catch(_){} }
        if (_usageReporting.backoffFailures >= _usageReporting.maxFailures){
          _usageReporting.cooldownUntil = _now() + _usageReporting.cooldownMs;
          console.warn('[TextUsage][Report] 达到失败上限，进入冷却', _usageReporting.cooldownMs + 'ms');
        } else {
          const backoff = Math.min(30000, Math.pow(2, _usageReporting.backoffFailures) * 1000);
          setTimeout(()=>{ _schedule(); }, backoff);
        }
        // 失败：把 batch 回填
        _pending = batch.concat(_pending);
      });
    } catch(err){
      if (_usageReporting.onError) { try { _usageReporting.onError(err); } catch(_){} }
      _pending = batch.concat(_pending);
    }
    return batch;
  }

  window.configureTextUsageReporting = function(cfg){
    if (!cfg || typeof cfg !== 'object') return Object.assign({}, _usageReporting);
    if (cfg.endpoint !== undefined) _usageReporting.endpoint = cfg.endpoint;
    if (cfg.enabled !== undefined) _usageReporting.enabled = !!cfg.enabled;
    if (cfg.mode !== undefined && (cfg.mode==='hot' || cfg.mode==='cold')) _usageReporting.mode = cfg.mode;
    if (cfg.batchIntervalMs !== undefined) _usageReporting.batchIntervalMs = Math.max(2000, cfg.batchIntervalMs|0);
    if (cfg.maxBatchSize !== undefined) _usageReporting.maxBatchSize = Math.max(10, cfg.maxBatchSize|0);
    if (cfg.sampleRate !== undefined){ let r=Number(cfg.sampleRate); if(!(r>0 && r<=1)) r=1; _usageReporting.sampleRate=r; }
    if (cfg.minCount !== undefined) _usageReporting.minCount = Math.max(0, cfg.minCount|0);
    if (cfg.maxAgeMs !== undefined) _usageReporting.maxAgeMs = (cfg.maxAgeMs==null)? null : Math.max(0, cfg.maxAgeMs|0);
    if (cfg.topN !== undefined) _usageReporting.topN = Math.max(1, cfg.topN|0);
    if (cfg.includeLastUsed !== undefined) _usageReporting.includeLastUsed = !!cfg.includeLastUsed;
    if (cfg.onError !== undefined) _usageReporting.onError = cfg.onError;
    if (cfg.maxFailures !== undefined) _usageReporting.maxFailures = Math.max(1, cfg.maxFailures|0);
    if (cfg.cooldownMs !== undefined) _usageReporting.cooldownMs = Math.max(1000, cfg.cooldownMs|0);
    if (cfg.enableDelta !== undefined) _usageReporting.enableDelta = !!cfg.enableDelta;
    if (cfg.minDelta !== undefined) _usageReporting.minDelta = Math.max(1, cfg.minDelta|0);

    if (_usageReporting.enabled && !_usageReporting.endpoint){
      console.warn('[TextUsage][Report] 已启用但未配置 endpoint');
    }
    _clearTimer();
    if (_usageReporting.enabled) _schedule();
    return Object.assign({}, _usageReporting);
  };

  window.flushTextUsageReporting = function(){ return _flush(true); };

  // 内部 delta 状态（延迟声明以避免被外部误用）
  const _delta = {
    snapshot: null,        // Map<key,count>
    lastDeltaCount: 0,
    lastFlushTs: 0
  };

  // 模块注册
  if (typeof window.ModuleLoader?.registerModule === 'function') {
      window.ModuleLoader.registerModule('text-usage-reporting', 'core', 'text-usage-reporting 已加载 (configureTextUsageReporting)');
  } else {
      console.log('✅ text-usage-reporting 已加载 (configureTextUsageReporting)');
  }
})();
