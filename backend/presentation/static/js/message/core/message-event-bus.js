/**
 * message-event-bus.js
 * 轻量事件总线 (前端消息域) - 不依赖第三方库
 * 提供 publish / subscribe / once / off
 * 向后兼容：可选桥接 DOM CustomEvent (QT_CONFIG.features.messageDomBridge)
 */
(function(){
  if (window.MessageEventBus) return; // 幂等
  const NS = 'messageCore';
  const log = (lvl, ...a)=> { if (window.QT_LOG) (QT_LOG[lvl]||QT_LOG.debug)(NS, ...a); };

  class EventBus {
    constructor(){ this._map = new Map(); }
    subscribe(evt, handler){
      if (!this._map.has(evt)) this._map.set(evt, new Set());
      this._map.get(evt).add(handler);
      return () => this.off(evt, handler);
    }
    once(evt, handler){
      const wrap = (p)=>{ try{ handler(p); } finally { this.off(evt, wrap);} };
      return this.subscribe(evt, wrap);
    }
    off(evt, handler){ const set = this._map.get(evt); if (set){ set.delete(handler); if(!set.size) this._map.delete(evt);} }
    publish(evt, payload){
      const set = this._map.get(evt);
      if (set) {
        set.forEach(fn=>{ try{ fn(payload); } catch(e){ log('warn','handler error', evt, e); } });
      }
      // DOM 桥接（可选）
      try {
        if (window.QT_CONFIG && window.QT_CONFIG.features && window.QT_CONFIG.features.messageDomBridge) {
          document.dispatchEvent(new CustomEvent('qt:'+evt, { detail: payload }));
        }
      } catch(_){ }
    }
  }

  window.MessageEventBus = new EventBus();
  log('info', 'MessageEventBus 初始化完成');
})();
