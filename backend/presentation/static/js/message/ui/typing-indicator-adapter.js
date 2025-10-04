/**
 * typing-indicator-adapter.js
 * 订阅 conversation.typing 事件并显示正在输入提示
 */
(function(){
  if (window.TypingIndicatorAdapter) return;
  const NS='messageTyping';
  const log=(lvl,...a)=>{ if(window.QT_LOG){ (QT_LOG[lvl]||QT_LOG.debug)(NS,...a);} };
  function ensureContainer(){
    let c=document.getElementById('typingIndicatorBar');
    if(!c){
      c=document.createElement('div');
      c.id='typingIndicatorBar';
      c.style.cssText='font-size:12px;color:#888;padding:4px 10px;';
      const parent=document.getElementById('chatMessages')?.parentElement || document.body;
      parent.appendChild(c);
    }
    return c;
  }
  function init(){
    if(!window.MessageEventBus) return null;
    const c=ensureContainer();
    let hideTimer=null;
    MessageEventBus.subscribe('conversation.typing', ({conversationId, customerId, customerName})=>{
      if (window.MessageStateStore && conversationId !== MessageStateStore.currentConversationId) return;
      c.textContent = (customerName||'客户') + ' 正在输入...';
      c.style.display='block';
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer=setTimeout(()=>{ c.style.display='none'; }, 4000);
    });
    log('info','TypingIndicatorAdapter 初始化');
    return { dispose(){ if(hideTimer) clearTimeout(hideTimer); } };
  }
  window.TypingIndicatorAdapter={ init };
})();
