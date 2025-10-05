/* ws-health-score.js
 * 组合 WebSocket 健康指数，聚合已有导出数据（不新增采样）：
 *   - Reconnect 可靠性 (failureStreak / maxFailureStreak / successRate)
 *   - Heartbeat 时延质量 (p50 / jitter / level)
 *   - 全局事件 Spike (最大 factor & sustained 数)
 *   - 分类事件 Spike (最大分类 factor & sustained 数)
 * 评分范围：0 ~ 100，越高越健康。
 * API:
 *   exportWsHealthScore(opts?) -> { score, breakdown:{ reconnect, heartbeat, spikesGlobal, spikesCategory }, factors:{...}, ts }
 * 参数:
 *   opts.prefetched: 可传入 { wsMetrics, heartbeatQuality, eventSpikes, categorySpikes }
 *   opts.weights: 可配置四项权重，默认均衡 { reconnect:0.3, heartbeat:0.3, spikesGlobal:0.2, spikesCategory:0.2 }
 */
(function(){
  'use strict';
  if (window.exportWsHealthScore) return; // 幂等

  function _clamp(v,min,max){ return v<min?min:(v>max?max:v); }

  function _computeReconnectScore(m){
    if (!m || !m.metrics || !m.derived) return 50; // 中性
    const d = m.derived;
    const successRate = typeof d.successRate==='number'? d.successRate:0; // 0~1
    const failureStreak = typeof d.failureStreak==='number'? d.failureStreak:0;
    const maxFailureStreak = (typeof d.maxFailureStreak==='number' && d.maxFailureStreak>0)? d.maxFailureStreak: (failureStreak||1);
    const streakPressure = failureStreak / maxFailureStreak; // 0~1
    // 成功率越高越好；连续失败越多越差
    let base = successRate; // 0~1
    const penalty = streakPressure * 0.6; // 最多减 0.6
    const score = _clamp((base - penalty), 0, 1) * 100;
    return +score.toFixed(1);
  }

  function _computeHeartbeatScore(q){
    if (!q || !q.metrics) return 60; // 中性偏上
    // 直接用 level 分档：good=90, warning=65, degraded=35，再根据 jitter / p90 调整
    let base = 60;
    if (q.level==='good') base = 90; else if (q.level==='warning') base = 65; else if (q.level==='degraded') base = 35;
    const jitter = q.metrics.jitter || 0; // ms
    const p90 = q.metrics.p90 || 0;
    // 适度惩罚：jitter>300ms 或 p90>800ms 逐步下调
    if (jitter > 300) base -= Math.min(25, (jitter-300)/20); // 每20ms 超出减1，最多减25
    if (p90 > 800) base -= Math.min(20, (p90-800)/40); // 每40ms 超出减1，最多减20
    return +_clamp(base,0,100).toFixed(1);
  }

  function _computeSpikeScore(sp, weightSustain){
    if (!sp || !sp.items) return 100; // 无 spike 视为健康
    if (!sp.items.length) return 100;
    const maxFactor = Math.max.apply(null, sp.items.map(i=> i.factor||0));
    const sustainedCount = sp.items.filter(i=> i.sustained).length;
    // factor 惩罚：>5 之后快速下降；<2.5 轻惩罚
    let factorPenalty = 0;
    if (maxFactor >= 2.5){
      factorPenalty = Math.min(70, (maxFactor-2.5)*12); // 每 +1 factor 减12 分（线性封顶）
    }
    const sustainPenalty = Math.min(30, sustainedCount * (weightSustain||5));
    const score = _clamp(100 - factorPenalty - sustainPenalty, 0, 100);
    return { score: +score.toFixed(1), maxFactor, sustainedCount };
  }

  function exportWsHealthScore(opts){
    opts = opts || {};
     // 新增 recovery 权重（默认 0.1），保持总和近似 1：重新平衡默认 => reconnect 0.27 heartbeat 0.27 spikesGlobal 0.18 spikesCategory 0.18 recovery 0.10
     const weights = Object.assign({ reconnect:0.27, heartbeat:0.27, spikesGlobal:0.18, spikesCategory:0.18, recovery:0.10 }, opts.weights||{});
    let wsMetrics = opts.prefetched?.wsMetrics;
    let hbQuality = opts.prefetched?.heartbeatQuality;
    let evSpikes = opts.prefetched?.eventSpikes;
    let catSpikes = opts.prefetched?.categorySpikes;
    // 尝试获取缺失数据（只读导出，避免重复次数级计算）
    if (!wsMetrics && typeof window.exportWsMetrics==='function'){
      try { wsMetrics = window.exportWsMetrics(); } catch(_){ }
    }
    if (!hbQuality && typeof window.exportWsHeartbeatQuality==='function'){
      try { hbQuality = window.exportWsHeartbeatQuality(); } catch(_){ }
    }
    if (!evSpikes && typeof window.exportWsEventSpikes==='function'){
      try { evSpikes = window.exportWsEventSpikes({}); } catch(_){ }
    }
    if (!catSpikes && typeof window.exportWsEventCategorySpikes==='function'){
      try { catSpikes = window.exportWsEventCategorySpikes({}); } catch(_){ }
    }

    const reconnectScore = _computeReconnectScore(wsMetrics);
    const heartbeatScore = _computeHeartbeatScore(hbQuality);
    const spikeG = _computeSpikeScore(evSpikes, 6);
    const spikeC = _computeSpikeScore(catSpikes, 4);
    // Recovery 子评分：读取 15 分钟内恢复数据 (count, keysAffected)。高恢复在低/中风险时视作积极信号；若 spikes 仍高则减弱收益。
    let recoveryScore = 50; // 中性起点
    let recoveryFactors = { count:0, keys:0, density:0 };
    try {
      const tracker = window.__SPIKE_STREAK_TRACKER__;
      if (tracker && typeof tracker.recoveryStats==='function'){
        const stat15 = tracker.recoveryStats(15*60*1000);
        const c = stat15.count||0; const k = stat15.keysAffected||0; const density = k>0? c/k : 0; // 每 key 恢复次数
        recoveryFactors = { count:c, keys:k, density:+density.toFixed(2) };
        // 基础加成：每个独立恢复 key +4 分，前 10 个权重高，之后衰减；单 key 连续密集恢复 (density>5) 视为震荡不全部加分
        let keyBoost = Math.min(10, k) * 4 + Math.max(0, k-10) * 1; // 上限 10*4 + ...
        // 密度调节：density 1~3 最佳；>5 开始扣减
        let densityMod = 0;
        if (density >= 1 && density <= 3) densityMod = 10; else if (density > 3 && density <=5) densityMod = 5; else if (density >5) densityMod = -10;
        // 与 spike 风险耦合：若全局或分类 spike 分数低 (<60) 则减少正向奖励 40%
        const spikeRiskHigh = (spikeG.score < 60) || (spikeC.score < 60);
        let raw = 50 + keyBoost + densityMod; // 50 基线 + 正向项
        if (spikeRiskHigh) raw = 50 + (raw-50)*0.6; // 收敛
        recoveryScore = _clamp(raw, 0, 100);
      }
    } catch(_){ }

    const score = reconnectScore*weights.reconnect + heartbeatScore*weights.heartbeat + spikeG.score*weights.spikesGlobal + spikeC.score*weights.spikesCategory + recoveryScore*weights.recovery;
    return {
      score: +score.toFixed(1),
      breakdown: { reconnect: reconnectScore, heartbeat: heartbeatScore, spikesGlobal: spikeG.score, spikesCategory: spikeC.score, recovery: +recoveryScore.toFixed(1) },
      factors: {
        reconnect: { successRate: wsMetrics?.derived?.successRate, failureStreak: wsMetrics?.derived?.failureStreak, maxFailureStreak: wsMetrics?.derived?.maxFailureStreak },
        heartbeat: { level: hbQuality?.level, p90: hbQuality?.metrics?.p90, jitter: hbQuality?.metrics?.jitter },
        spikesGlobal: { maxFactor: spikeG.maxFactor, sustained: spikeG.sustainedCount },
        spikesCategory: { maxFactor: spikeC.maxFactor, sustained: spikeC.sustainedCount },
        recovery: recoveryFactors
      },
      weights,
      ts: Date.now()
    };
  }

  window.exportWsHealthScore = exportWsHealthScore;
  console.log('✅ ws-health-score 已加载 (exportWsHealthScore)');
})();
