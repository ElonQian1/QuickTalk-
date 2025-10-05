/* formatters.js
 * 统一格式化 & 占位文案，减少 scattered 字符串。
 */
(function(){
  'use strict';
  if (window.Formatters) return;
  const T = (k,f)=> (typeof window.getText==='function') ? window.getText(k,f) : ((window.StateTexts && window.StateTexts[k]) || f || k);
  const placeholders = {
    lastMessage: T('LAST_MESSAGE_PLACEHOLDER','暂无消息'),
    waitingCustomer: '等待客户消息...'
  };
  function lastMessageTime(ts){
    if (!ts) return placeholders.lastMessage;
    try { return new Date(ts).toLocaleString(); } catch(_){ return placeholders.lastMessage; }
  }
  window.Formatters = { placeholders, lastMessageTime };
  console.log('✅ Formatters 已加载');
})();
