/* ws-heartbeat-trend.js
 * 基于 ws-heartbeat-latency 的分布导出构建时间序列趋势
 * 设计：
 *   - enableWsHeartbeatTrend(flag?, { sampleIntervalMs=10000, maxPoints=60 })
 *   - maybeSampleHeartbeatTrend() 在每次 heartbeat ack 后调用，若距离上次采样 >= sampleIntervalMs 则采样
 *   - exportWsHeartbeatTrend({ reset? }) -> { points:[{ ts,p50,p90,jitter,count }], lastSampleTs, sampleIntervalMs }
 * 不重复计算 RTT：直接调用 exportWsHeartbeatLatencyStats()
 */
(function(){
  'use strict';
  if (window.enableWsHeartbeatTrend) return; // 幂等

  const _trend = {
    enabled: false,
    sampleIntervalMs: 10000,
    maxPoints: 60,
    lastSampleTs: 0,
    points: []
  };

  function enableWsHeartbeatTrend(flag, opts){
    _trend.enabled = (flag === undefined) ? true : !!flag;
    if (opts){
      if (opts.sampleIntervalMs) _trend.sampleIntervalMs = Math.max(1000, opts.sampleIntervalMs|0);
      if (opts.maxPoints) _trend.maxPoints = Math.max(5, opts.maxPoints|0);
    }
    return _trend.enabled;
  }

  function maybeSampleHeartbeatTrend(){
    if (!_trend.enabled) return false;
    if (typeof window.exportWsHeartbeatLatencyStats !== 'function') return false;
    const now = Date.now();
    if (now - _trend.lastSampleTs < _trend.sampleIntervalMs) return false;
    const dist = window.exportWsHeartbeatLatencyStats();
    if (!dist || !dist.count) { _trend.lastSampleTs = now; return false; }
    _trend.points.push({ ts: now, p50: dist.p50, p90: dist.p90, jitter: dist.jitter, count: dist.count });
    if (_trend.points.length > _trend.maxPoints) _trend.points.splice(0, _trend.points.length - _trend.maxPoints);
    _trend.lastSampleTs = now;
    return true;
  }

  function exportWsHeartbeatTrend(opts){
    opts = opts || {};
    const out = { points: _trend.points.slice(), lastSampleTs: _trend.lastSampleTs, sampleIntervalMs: _trend.sampleIntervalMs };
    if (opts.reset){ _trend.points = []; _trend.lastSampleTs = 0; }
    return out;
  }

  window.enableWsHeartbeatTrend = enableWsHeartbeatTrend;
  window.maybeSampleHeartbeatTrend = maybeSampleHeartbeatTrend;
  window.exportWsHeartbeatTrend = exportWsHeartbeatTrend;
  console.log('✅ ws-heartbeat-trend 已加载 (enableWsHeartbeatTrend)');
})();
