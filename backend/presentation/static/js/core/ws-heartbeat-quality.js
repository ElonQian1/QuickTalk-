/* ws-heartbeat-quality.js
 * 读取现有 exportWsHeartbeatLatencyStats() 输出，派生质量等级。
 * 不重复采样 RTT，仅做阈值判定，幂等可多次调用。
 * API: exportWsHeartbeatQuality(opts?) -> { level, metrics:{p50,p90,jitter}, rationale:[...], generatedAt }
 */
(function(){
  'use strict';
  if (window.exportWsHeartbeatQuality) return;

  function exportWsHeartbeatQuality(opts){
    opts = opts || {};
    if (typeof window.exportWsHeartbeatLatencyStats !== 'function'){
      return { level:'unknown', metrics:{}, rationale:['latencyStatsUnavailable'], generatedAt:new Date().toISOString() };
    }
    let stats;
    try { stats = window.exportWsHeartbeatLatencyStats(); } catch(_){ stats=null; }
    if (!stats || !stats.dist){
      return { level:'unknown', metrics:{}, rationale:['noDist'], generatedAt:new Date().toISOString() };
    }
    const p50 = stats.dist.p50 != null ? stats.dist.p50 : null;
    const p90 = stats.dist.p90 != null ? stats.dist.p90 : null;
    const jitter = stats.dist.jitter != null ? stats.dist.jitter : (stats.dist.p90 - stats.dist.p50);
    const rationale = [];
    // 默认阈值，可通过 opts 覆盖
    const th = Object.assign({ good:{ p50:120, p90:200, jitter:80 }, warn:{ p50:250, p90:400, jitter:160 } }, opts.thresholds||{});
    let level='degraded';
    if (p50==null || p90==null){ level='unknown'; rationale.push('missingMetrics'); }
    else if (p50 <= th.good.p50 && p90 <= th.good.p90 && jitter <= th.good.jitter){ level='good'; rationale.push('withinGood'); }
    else if (p50 <= th.warn.p50 && p90 <= th.warn.p90 && jitter <= th.warn.jitter){ level='warning'; rationale.push('withinWarning'); }
    else { rationale.push('exceedsWarning'); }
    if (stats.dist.max && stats.dist.max > (th.warn.p90*2)) rationale.push('spikes');
    return { level, metrics:{ p50, p90, jitter, max:stats.dist.max, count:stats.dist.count }, rationale, generatedAt:new Date().toISOString() };
  }

  window.exportWsHeartbeatQuality = exportWsHeartbeatQuality;
  console.log('✅ ws-heartbeat-quality 已加载 (exportWsHeartbeatQuality)');
})();
