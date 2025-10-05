/* ws-metrics.js
 * WebSocket 运行期指标收集（轻量、可选启用）
 * API:
 *   enableWsMetrics(flag:boolean) -> boolean
 *   exportWsMetrics({ reset?: boolean }) -> { metrics, events }
 * 用法：在 websocket-base.js 中通过 window.__WsMetrics.record(evt, extra) 记录
 */
(function(){
  'use strict';
  if (window.enableWsMetrics) return; // 幂等

  const _state = {
    enabled: false,
    metrics: {
      reconnectAttempts: 0,
      reconnectSuccesses: 0,
      heartbeatAdjustEvents: 0,
      consecutiveFailures: 0,
      maxConsecutiveFailures: 0,
      lastReconnectSuccessTs: 0,
      lastDisconnectTs: 0,
      lastHeartbeatAdjustTs: 0
    },
    events: [] // 可选事件轨迹 (受限长度)
  };
  const _MAX_EVENTS = 200;

  const EVENT_HANDLERS = {
    RECONNECT_ATTEMPT(){ _state.metrics.reconnectAttempts++; },
    RECONNECT_SUCCESS(){
      _state.metrics.reconnectSuccesses++;
      _state.metrics.consecutiveFailures = 0;
      _state.metrics.lastReconnectSuccessTs = Date.now();
    },
    RECONNECT_FAIL(){
      _state.metrics.consecutiveFailures++;
      if (_state.metrics.consecutiveFailures > _state.metrics.maxConsecutiveFailures)
        _state.metrics.maxConsecutiveFailures = _state.metrics.consecutiveFailures;
    },
    DISCONNECT(){
      _state.metrics.lastDisconnectTs = Date.now();
    },
    HEARTBEAT_ADJUST(){
      _state.metrics.heartbeatAdjustEvents++;
      _state.metrics.lastHeartbeatAdjustTs = Date.now();
    }
  };

  function computeWsDerivedMetrics(){
    const m = _state.metrics;
    const now = Date.now();
    const successRate = m.reconnectAttempts === 0 ? 0 : +(m.reconnectSuccesses / m.reconnectAttempts).toFixed(2);
    const meanAttemptsPerSuccess = m.reconnectSuccesses === 0 ? m.reconnectAttempts : +(m.reconnectAttempts / m.reconnectSuccesses).toFixed(2);
    const lastSuccessAgeMs = m.lastReconnectSuccessTs ? (now - m.lastReconnectSuccessTs) : null;
    return {
      successRate,
      meanAttemptsPerSuccess,
      failureStreak: m.consecutiveFailures,
      maxFailureStreak: m.maxConsecutiveFailures,
      lastSuccessAgeMs
    };
  }

  function record(evt, extra){
    if (!_state.enabled) return;
    if (EVENT_HANDLERS[evt]) {
      try { EVENT_HANDLERS[evt](extra); } catch(_){ }
    }
    // 记录事件轨迹
    try {
      _state.events.push({ evt, t: Date.now(), ...(extra||{}) });
      if (_state.events.length > _MAX_EVENTS) _state.events.splice(0, _state.events.length - _MAX_EVENTS);
    } catch(_){ }
  }

  window.enableWsMetrics = function(flag){
    _state.enabled = !!flag;
    if (!flag){
      // 关闭后不自动清空指标，保留最后一次数据；可导出时 reset
    }
    return _state.enabled;
  };

  window.exportWsMetrics = function(opts){
    opts = opts || {};
    const snapshot = {
      metrics: Object.assign({}, _state.metrics),
      events: _state.events.slice(),
      derived: computeWsDerivedMetrics()
    };
    if (opts.reset){
      // 重置数值但保留启用状态
      for (const k in _state.metrics){ if (Object.prototype.hasOwnProperty.call(_state.metrics,k)){
        if (typeof _state.metrics[k] === 'number') _state.metrics[k] = 0;
      }}
      _state.metrics.lastReconnectSuccessTs = 0;
      _state.metrics.lastDisconnectTs = 0;
      _state.metrics.lastHeartbeatAdjustTs = 0;
      _state.events.length = 0;
    }
    return snapshot;
  };

  // 暴露内部 record 供 ws 代码使用
  window.__WsMetrics = { record };

  window.computeWsDerivedMetrics = computeWsDerivedMetrics;
  console.log('✅ ws-metrics 已加载 (enableWsMetrics, exportWsMetrics, computeWsDerivedMetrics)');
})();
