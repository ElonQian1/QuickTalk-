(function(){
  'use strict';
  if (window.MessageWSEventsHandler) return; // 幂等
  /**
   * Deprecated Shim: MessageWSEventsHandler
   * 已被 WsEventRouter 取代，仅保留兼容防止旧代码调用。
   * 调用 create() 返回带 route(raw) 的对象，内部直接转发 WsEventRouter.route。
   */
  function warn(){ try { console.warn('[MessageWSEventsHandler] 已废弃，请使用 WsEventRouter 统一路由'); } catch(_){} }
  class Shim {
    constructor(o){ this._o = o||{}; warn(); }
    route(raw){
      if (window.WsEventRouter && typeof window.WsEventRouter.route === 'function'){
        try { window.WsEventRouter.route(this._o.context || this._o.ctx || this._o.messageModule || window.messageModule, raw); } catch(e){ }
      } else {
        // 最小退化：透传到旧回调（若仍有人使用）
        try { if (raw && raw.type && raw.type.startsWith('domain.event.') && this._o.onDomainAppend){ /* 不再细分, 交由 WsEventRouter */ } } catch(_){ }
      }
    }
  }
  window.MessageWSEventsHandler = { create: (o)=> new Shim(o) };
  console.log('⚠️ message-ws-events-handler.js 以废弃兼容模式加载 (Shim)');
})();
