/* ws-heartbeat-latency.js
 * 采集 WebSocket 心跳 RTT 延迟分布 (独立于 ws-metrics)
 * API:
 *   enableWsHeartbeatLatency(flag:boolean) -> boolean
 *   recordWsHeartbeatSent(sentAt:number)   // 在发送心跳时调用
 *   recordWsHeartbeatAck(clientSentAt:number) // 收到心跳响应并含原发送时间时调用
 *   exportWsHeartbeatLatencyStats({ reset?: boolean }) -> { count, p50,p90,p99,mean,max,jitter, lastSampleTs }
 * 设计：
 *   - 轻量环形缓冲，默认容量 200
 *   - jitter = p90 - p50 近似
 *   - 未依赖 ws-metrics，避免耦合（只在面板展示联动）
 */
(function(){
  'use strict';
  if (window.enableWsHeartbeatLatency) return; // 幂等

  const _state = {
    enabled: false,
    cap: 200,
    samples: new Array(200),
    idx: 0,
    size: 0,
    lastSentTs: 0,
    lastSampleTs: 0
  };

  function enableWsHeartbeatLatency(flag){
    _state.enabled = !!flag;
    if (!flag){ /* 保留历史数据，便于关闭后再查看 */ }
    return _state.enabled;
  }

  function recordWsHeartbeatSent(ts){
    if (!_state.enabled) return;
    _state.lastSentTs = ts || Date.now();
  }

  function recordWsHeartbeatAck(clientSentAt){
    if (!_state.enabled) return;
    const sent = clientSentAt || _state.lastSentTs;
    if (!sent) return;
    const rtt = Date.now() - sent;
    if (rtt < 0 || rtt > 5*60*1000) return; // 防御：忽略异常值
    _state.samples[_state.idx] = rtt;
    _state.idx = (_state.idx + 1) % _state.cap;
    if (_state.size < _state.cap) _state.size++;
    _state.lastSampleTs = Date.now();
  }

  function _compute(){
    if (_state.size === 0) return { count:0,p50:null,p90:null,p99:null,mean:null,max:null,jitter:null,lastSampleTs:_state.lastSampleTs };
    const arr = [];
    for (let i=0;i<_state.size;i++){ const v = _state.samples[i]; if (typeof v === 'number') arr.push(v); }
    if (!arr.length) return { count:0,p50:null,p90:null,p99:null,mean:null,max:null,jitter:null,lastSampleTs:_state.lastSampleTs };
    arr.sort((a,b)=>a-b);
    const n = arr.length;
    function pct(p){
      if (n===0) return null;
      const idx = Math.min(n-1, Math.floor(p/100 * (n-1)));
      return arr[idx];
    }
    const sum = arr.reduce((s,v)=>s+v,0);
    const mean = +(sum / n).toFixed(2);
    const p50 = pct(50), p90 = pct(90), p99 = pct(99);
    const max = arr[n-1];
    const jitter = (p90!=null && p50!=null) ? +(p90 - p50).toFixed(2) : null;
    return { count:n, p50, p90, p99, mean, max, jitter, lastSampleTs: _state.lastSampleTs };
  }

  function exportWsHeartbeatLatencyStats(opts){
    opts = opts || {};
    const snap = _compute();
    if (opts.reset){
      _state.samples = new Array(_state.cap);
      _state.idx = 0; _state.size = 0; _state.lastSampleTs = 0; _state.lastSentTs = 0;
    }
    return snap;
  }

  window.enableWsHeartbeatLatency = enableWsHeartbeatLatency;
  window.recordWsHeartbeatSent = recordWsHeartbeatSent;
  window.recordWsHeartbeatAck = recordWsHeartbeatAck;
  window.exportWsHeartbeatLatencyStats = exportWsHeartbeatLatencyStats;
  console.log('✅ ws-heartbeat-latency 已加载 (enableWsHeartbeatLatency)');
})();
