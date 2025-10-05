/* ws-quality.js
 * 基于 diagnostics 指标的网络质量评分
 * 输出：window.WSQuality.getScore() => { score, level, metrics }
 * 事件：质量等级变化时 dispatchEvent('ws:qualityChanged', { oldLevel, newLevel, score, metrics })
 */
(function(){
  'use strict';
  if (window.WSQuality) return; // 单例

  const LEVELS = [
    { name:'Excellent', min:90 },
    { name:'Good',      min:75 },
    { name:'Fair',      min:60 },
    { name:'Poor',      min:40 },
    { name:'Critical',  min: 0 }
  ];

  const CONFIG = {
    evalInterval: 3000,          // 评分计算周期
    minChangeEmitScoreDelta: 8,  // 分数变化超过阈值且跨等级才触发
    jitterWindow: 30,            // 计算 RTT 抖动样本窗口
    lossWeight: 0.35,
    rttWeight: 0.30,
    jitterWeight: 0.15,
    reconnectWeight: 0.12,
    errorWeight: 0.08,
    // 期望与上限（归一化参考）
    targetRTT: 150,    // ms 以下视为理想
    maxRTT: 1500,
    targetJitter: 40,  // ms
    maxJitter: 600,
    maxLossRatio: 0.5, // 50% 按最差
    maxReconnectsPerMin: 12,
    maxErrorsPerMin: 20
  };

  let lastLevel = null; let lastScore = null; let timer = null;

  function clamp01(v){ return v<0?0: v>1?1: v; }
  function percentile(pct, arr){ if(!arr.length) return 0; const sorted=[...arr].sort((a,b)=>a-b); const idx=Math.min(sorted.length-1, Math.floor(pct*(sorted.length-1))); return sorted[idx]; }

  function computeMetrics(diag){
    if (!diag) return null;
    const hb = diag.heartbeat || {}; const cons = diag.connections || {}; const msgs = diag.messages || {}; const ev = diag.events || {};
    const rtts = (hb.rtts||[]).slice(-CONFIG.jitterWindow);
    const avgRTT = hb.avgRTT || 0;
    const lossRatio = hb.sent? (hb.lost / hb.sent): 0;
    const jitter = rtts.length>1? (percentile(0.9,rtts)-percentile(0.1,rtts)) : 0; // P90-P10 近似抖动范围
    // 计算过去 1 分钟内重连/错误频率 (若缺乏时间戳，这里基于总量粗略换算)
    const uptimeSec = Math.max(1, diag.uptime/1000);
    const perMinFactor = 60 / uptimeSec; // 总量 * perMinFactor ~ 每分钟估计
    const reconnectsPerMin = cons.reconnects * perMinFactor;
    const errorsPerMin = cons.errors * perMinFactor;

    return {
      avgRTT, jitter, lossRatio, reconnectsPerMin, errorsPerMin,
      raw: { hbSent: hb.sent, hbLost: hb.lost, hbAck: hb.ack }
    };
  }

  function normalize(metrics){
    const rttScore = 1 - clamp01((metrics.avgRTT - CONFIG.targetRTT)/(CONFIG.maxRTT - CONFIG.targetRTT));
    const jitterScore = 1 - clamp01((metrics.jitter - CONFIG.targetJitter)/(CONFIG.maxJitter - CONFIG.targetJitter));
    const lossScore = 1 - clamp01(metrics.lossRatio / CONFIG.maxLossRatio);
    const reconnectScore = 1 - clamp01(metrics.reconnectsPerMin / CONFIG.maxReconnectsPerMin);
    const errorScore = 1 - clamp01(metrics.errorsPerMin / CONFIG.maxErrorsPerMin);

    const score = (
      lossScore     * CONFIG.lossWeight +
      rttScore      * CONFIG.rttWeight +
      jitterScore   * CONFIG.jitterWeight +
      reconnectScore* CONFIG.reconnectWeight +
      errorScore    * CONFIG.errorWeight
    ) * 100;

    return { score: +score.toFixed(1), partial:{ rttScore, jitterScore, lossScore, reconnectScore, errorScore } };
  }

  function levelOf(score){ return LEVELS.find(l=> score>=l.min ) || LEVELS[LEVELS.length-1]; }

  function evaluate(){
    if (!window.WebSocketDiagnostics){ schedule(); return; }
    const diag = window.WebSocketDiagnostics.getStats();
    const metrics = computeMetrics(diag);
    const { score, partial } = normalize(metrics);
    const level = levelOf(score);
    const changed = (!lastLevel || level.name!==lastLevel.name) && (lastScore==null || Math.abs(score-lastScore)>=CONFIG.minChangeEmitScoreDelta);
    if (changed){
      const detail = { oldLevel: lastLevel && lastLevel.name, newLevel: level.name, score, metrics, partial };
      document.dispatchEvent(new CustomEvent('ws:qualityChanged',{ detail }));
      if (window.QT_LOG && window.QT_LOG.info){ window.QT_LOG.info('ws-quality', 'qualityChanged', detail); }
    }
    lastLevel = level; lastScore = score; cache.result = { score, level: level.name, metrics, partial };
    schedule();
  }

  function schedule(){ timer = setTimeout(evaluate, CONFIG.evalInterval); }

  const cache = { result: null };

  const API = {
    getScore(){ return cache.result; },
    forceRecalculate(){ evaluate(); },
    getConfig(){ return CONFIG; },
    getLevels(){ return LEVELS.map(l=>({...l})); }
  };

  window.WSQuality = API;
  evaluate(); // 启动
})();
