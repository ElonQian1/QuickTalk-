/**
 * ws-events-metrics.js
 * WebSocket 事件指标统计（前端侧）
 * 目标：观测 domain / legacy / 未识别 事件占比，为安全移除 inline handler 与 legacy 分支提供数据支撑。
 * 特性：
 *  - 幂等：多次加载不重复覆盖已累计
 *  - 轻量：纯内存，不写 localStorage
 *  - 可视：window.__WsEventsMetrics.get() / print() 输出表格
 *  - 附加：计算最近窗口（rolling）统计 (最近 N 条)
 */
(function(){
  'use strict';
  if (window.__WsEventsMetrics && window.__WsEventsMetrics.record) return; // 幂等

  const counters = {
    total: 0,
    domain: 0,
    legacyInline: 0,
    legacyOther: 0,
    unknown: 0,
    typing: 0,
    conversationUpdate: 0,
    message: 0
  };
  const rolling = [];// 保存最近 150 条事件 type
  const MAX_ROLLING = 150;

  function classify(evt){
    if (!evt || !evt.type) return 'unknown';
    const t = evt.type;
    if (t.startsWith('domain.event.')) return 'domain';
    if (t === 'message' || evt.msg_type === 'message') return 'message';
    if (t === 'typing') return 'typing';
    if (t === 'conversation_update') return 'conversationUpdate';
    return 'unknown';
  }

  function record(raw, meta){
    try {
      counters.total++;
      const cls = classify(raw);
      counters[cls] = (counters[cls]||0)+1;
      if (meta && meta.path === 'inline') counters.legacyInline++;
      if (meta && meta.path === 'legacy') counters.legacyOther++;
      rolling.push({ t: Date.now(), type: raw && raw.type || 'NA', path: meta && meta.path || 'n/a' });
      if (rolling.length > MAX_ROLLING) rolling.shift();
    } catch(_){}
  }

  function get(){
    const percent = (k)=> counters.total? ((counters[k]||0)/counters.total*100).toFixed(1)+'%':'0%';
    return {
      summary: { ...counters, pct:{
        domain: percent('domain'),
        message: percent('message'),
        typing: percent('typing'),
        conversationUpdate: percent('conversationUpdate'),
        unknown: percent('unknown'),
        legacyInline: percent('legacyInline'),
        legacyOther: percent('legacyOther')
      } },
      rolling: rolling.slice()
    };
  }

  function print(){ try { console.table(get().summary); } catch(e){ console.log('[WsEventsMetrics]', get().summary); } }
  function reset(){ Object.keys(counters).forEach(k=> counters[k]=0); rolling.splice(0, rolling.length); }

  window.__WsEventsMetrics = { record, get, print, reset };
})();
