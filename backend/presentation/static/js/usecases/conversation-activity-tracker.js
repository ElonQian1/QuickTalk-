/**
 * conversation-activity-tracker.js
 * 目的: 前端层面检测用户正查看哪个会话 + 页面可见性, 主动触发本地已读事件
 * 事件:
 *   emit Events.CONVERSATION.READ_LOCAL => detail { conversation_id, at }
 * 策略:
 *   - 切换对话 / 初次进入会话时触发
 *   - 页面重新可见 && 仍在该会话 -> 再次触发(防丢)
 *   - 防抖: 500ms 内重复忽略
 */
(function(){
  'use strict';
  if (window.ConversationActivityTracker) return;

  class ConversationActivityTracker {
    constructor(opts){
      this.opts = { debounceMs: 500, debug:false, ...opts };
      this._lastEmit = { id:null, ts:0 };
      this._activeConv = null;
      this._bind();
      if (this.opts.debug) console.log('[ConversationActivityTracker] init');
    }

    _bind(){
      // 监听全局当前会话标记 (__QT_ACTIVE_CONV_ID 由 message-module-refactored 设置)
      document.addEventListener('ws:domain.event.message_appended', (e)=>{
        // 不做任何处理，这里仅保留可扩展钩子
      });
      // MutationObserver 监听 active 会话标记变化可选; 简化: 轮询
      setInterval(()=> this._pollActive(), 1500);
      document.addEventListener('visibilitychange', ()=>{
        if (document.visibilityState === 'visible') {
          this._maybeEmit();
        }
      });
    }

    setActive(conversationId){
      if (!conversationId) return;
      this._activeConv = conversationId;
      this._maybeEmit();
    }

    _pollActive(){
      try {
        const cur = window.__QT_ACTIVE_CONV_ID;
        if (cur && cur !== this._activeConv) {
          this._activeConv = cur;
          this._maybeEmit();
        }
      } catch(_){ }
    }

    _maybeEmit(){
      if (!this._activeConv) return;
      const now = Date.now();
      if (this._lastEmit.id === this._activeConv && (now - this._lastEmit.ts) < this.opts.debounceMs) return;
      this._lastEmit = { id:this._activeConv, ts:now };
      const detail = { conversation_id: this._activeConv, at: now };
      try {
        if (window.Events) window.Events.emit(window.Events.Events.CONVERSATION.READ_LOCAL, detail);
        else document.dispatchEvent(new CustomEvent('conversation.read.local',{ detail }));
      } catch(_){ }
      if (this.opts.debug) console.log('[ConversationActivityTracker] emit read-local', detail);
    }
  }

  window.ConversationActivityTracker = ConversationActivityTracker;
  if (window.registerModule) window.registerModule('ConversationActivityTracker', ConversationActivityTracker);
  console.log('✅ conversation-activity-tracker.js 已加载');
})();
