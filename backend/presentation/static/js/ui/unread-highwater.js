(function(){
  'use strict';
  if (window.__UNREAD_HIGHWATER__) return;
  const cfg = window.QT_CONFIG || {}; // 允许外部注入收敛参数
  const CONVERGENCE_MS = cfg.highWaterConvergenceMs || 4000; // 服务端>=本地 持续时间
  const state = { local:0, server:0, high:0, lastUpdate:0, lastServerDominanceTs: null };
  function recalc(){ state.high = Math.max(state.local, state.server); }
  function emit(){ document.dispatchEvent(new CustomEvent('unread:highwater',{detail:{ total: state.high, local: state.local, server: state.server, ts: state.lastUpdate }})); }

  function maybeConverge(){
    // 若本地高水位>0 且 服务端 >= 本地, 记录开始时间; 持续 CONVERGENCE_MS 后收敛: 将 local=0 以使用 server
    if (state.local>0 && state.server >= state.local){
      if (!state.lastServerDominanceTs) state.lastServerDominanceTs = Date.now();
      const elapsed = Date.now() - state.lastServerDominanceTs;
      if (elapsed >= CONVERGENCE_MS){
        // 收敛: 认为服务端已追平本地增量, 清零本地影子
        state.local = 0;
        state.lastServerDominanceTs = null;
        recalc(); emit();
      }
    } else {
      // 条件不满足, 重置计时
      state.lastServerDominanceTs = null;
    }
  }

  document.addEventListener('unread:update', e=>{
    const d = e.detail||{};
    state.server = d.total||0;
    state.lastUpdate = Date.now();
    recalc(); emit();
    maybeConverge();
  });
  document.addEventListener('unread:localIncrement', e=>{
    const n = e.detail && typeof e.detail.delta==='number' ? e.detail.delta : 1;
    state.local += n;
    state.lastUpdate = Date.now();
    recalc(); emit();
  });
  document.addEventListener('ws:domain.event.message_appended', e=>{
    // 若是客户消息且不在当前会话，可视为本地增量 (聚合延迟补偿)
    const msg = e.detail && e.detail.message; if(!msg) return;
    if (msg.sender_type === 'customer') {
      const active = window.__QT_ACTIVE_CONV_ID;
      if (!active || String(active)!==String(msg.conversation_id)) {
        document.dispatchEvent(new CustomEvent('unread:localIncrement',{detail:{delta:1, reason:'domain-event'}}));
      }
    }
  });
  // 定时器检测收敛
  setInterval(()=> maybeConverge(), 1000);
  // 提供查询 API
  window.__UNREAD_HIGHWATER__ = {
    get: ()=> ({...state}),
    resetLocal(){ state.local=0; recalc(); emit(); },
    convergeNow(){ state.local=0; recalc(); emit(); }
  };
  console.log('✅ unread-highwater.js 已加载 (含收敛策略)');
})();
