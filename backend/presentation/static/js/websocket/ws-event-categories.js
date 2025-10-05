/* ws-event-categories.js
 * WebSocket 事件分类统计（补充 ws-metrics 的聚合视角）。
 * 目标：
 *   - 提供按事件类别（open/close/reconnectAttempt/reconnectSuccess/reconnectFail/message/error/heartbeatSent/heartbeatLost/adaptiveChange）统计
 *   - 支持时间窗口过滤（windowMs，可选）
 *   - 轻量，不重复存储 ws-metrics 已含核心计数，仅存事件时间戳与分类标签
 * 接口：
 *   enableWsEventCategories(flag?) -> boolean
 *   recordWsEventCategory(type, detail?)  // 供 websocket-base 或其它模块调用
 *   exportWsEventCategories(opts?) -> { windowMs, since, total, categories: { type: { count, lastTs, ratePerMin } } }
 */
(function(){
  'use strict';
  if (window.enableWsEventCategories) return; // 幂等

  const _state = {
    enabled: false,
    events: [] // { t:Number, type:String }
  };

  const CATEGORY_MAP = {
    open: 'open',
    close: 'close',
    reconnect: 'reconnectAttempt',
    reconnectAttempt: 'reconnectAttempt',
    reconnecting: 'reconnectAttempt',
    reconnect_success: 'reconnectSuccess',
    reconnectSuccess: 'reconnectSuccess',
    reconnect_fail: 'reconnectFail',
    reconnectFail: 'reconnectFail',
    failed: 'reconnectFail',
    message: 'message',
    error: 'error',
    heartbeatSent: 'heartbeatSent',
    heartbeatLost: 'heartbeatLost',
    adaptiveHeartbeatChanged: 'adaptiveChange'
  };

  const VALID = new Set(Object.values(CATEGORY_MAP));

  function enableWsEventCategories(flag){
    _state.enabled = (flag === undefined) ? true : !!flag;
    if (!_state.enabled) { _state.events = []; }
    return _state.enabled;
  }

  function recordWsEventCategory(type, detail){
    if (!_state.enabled) return;
    const mapped = CATEGORY_MAP[type] || type;
    if (!VALID.has(mapped)) return; // 忽略未知分类
    _state.events.push({ t: Date.now(), type: mapped });
    // 内存限制：只保留最近 2000 条
    if (_state.events.length > 2000) _state.events.splice(0, _state.events.length - 2000);
  }

  function exportWsEventCategories(opts){
    opts = opts || {};
    const windowMs = opts.windowMs || 5*60*1000; // 默认5分钟窗口
    const now = Date.now();
    const since = now - windowMs;
    const cats = {};

    for (let i = _state.events.length - 1; i >=0; i--) {
      const ev = _state.events[i];
      if (ev.t < since) break; // 事件按时间先后 push，可逆序提早终止
      const bucket = cats[ev.type] || (cats[ev.type] = { count:0, lastTs:0 });
      bucket.count++;
      if (ev.t > bucket.lastTs) bucket.lastTs = ev.t;
    }

    // 计算 rate (每分钟)
    const windowMinutes = windowMs / 60000;
    Object.keys(cats).forEach(k => {
      cats[k].ratePerMin = +(cats[k].count / windowMinutes).toFixed(2);
    });

    return {
      windowMs,
      since,
      total: _state.events.length,
      categories: cats
    };
  }

  window.enableWsEventCategories = enableWsEventCategories;
  window.recordWsEventCategory = recordWsEventCategory;
  window.exportWsEventCategories = exportWsEventCategories;

  console.log('✅ ws-event-categories 已加载');
})();
