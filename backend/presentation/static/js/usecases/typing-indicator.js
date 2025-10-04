/* typing-indicator.js
 * 目的：统一管理聊天窗口的正在输入(Typing)提示，避免各模块重复 DOM 处理。
 * 机制：收到 typing 事件 -> 显示提示条（5s 无刷新自动隐藏）
 * 约束：仅在当前会话匹配时显示；可扩展为显示多个客服/客户来源。
 */
(function(){
  'use strict';
  if (window.ChatTypingIndicator) return; // 幂等

  const AUTO_HIDE_MS = 5000;

  class TypingIndicator {
    constructor(){
      this._timer = null;
      this._el = null;
      this._currentConv = null;
    }
    _ensureElement(){
      if (this._el) return this._el;
      let host = document.getElementById('typingIndicatorBar');
      if (!host){
        host = document.createElement('div');
        host.id = 'typingIndicatorBar';
        host.style.cssText = 'display:none;position:relative;padding:4px 10px;font-size:12px;color:#666;background:#f5f5f5;border-top:1px solid #e2e2e2;';
        const chatView = document.getElementById('chatView');
        if (chatView){
          // 插入在输入框上方：尝试找到输入容器
            const inputArea = document.querySelector('.chat-input-area') || document.getElementById('chatInput')?.parentElement || chatView;
            inputArea.parentElement?.insertBefore(host, inputArea);
        } else {
          document.body.appendChild(host);
        }
      }
      this._el = host;
      return host;
    }
    showTyping(evt){
      if (!evt) return;
      const convId = evt.conversation_id || evt.conversationId;
      if (!convId) return;
      // 仅显示当前会话的 typing
      const current = (window.MessageModuleRef && window.MessageModuleRef.currentConversationId) || (window.messageModule && window.messageModule.currentConversationId) || null;
      if (!current || String(current) !== String(convId)) return;
      this._currentConv = convId;
      const role = evt.sender_type === 'customer' ? '客户' : '对方';
      const text = role + '正在输入…';
      const el = this._ensureElement();
      el.textContent = text;
      el.style.display = 'block';
      this._armAutoHide();
    }
    _armAutoHide(){
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(()=>{ this.hide(); }, AUTO_HIDE_MS);
    }
    hide(){
      if (this._el) this._el.style.display = 'none';
      this._currentConv = null;
    }
    forceHideForConversation(convId){
      if (this._currentConv && String(this._currentConv) === String(convId)) this.hide();
    }
  }

  window.ChatTypingIndicator = new TypingIndicator();
  console.log('✅ typing-indicator.js 已加载');
})();