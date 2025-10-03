/*
 * 正在输入指示胶水 (messages-typing.js)
 * - 给 MessageModule 注入 handleTypingIndicator(data) 方法
 * - 简单在聊天头部显示“对方正在输入...”3秒，或用 toast 兜底
 */
(function(){
  'use strict';

  function showTyping(){
    if (window.TypingIndicatorUI && typeof window.TypingIndicatorUI.show==='function'){
      window.TypingIndicatorUI.show('对方正在输入...');
    } else if (typeof window.showToast === 'function') {
      window.showToast('对方正在输入...', 'info');
    }
  }

  // 注入到 MessageModule 原型（若存在）
  function patch(){
    if (!window.MessageModule || !window.MessageModule.prototype) return;
    if (typeof window.MessageModule.prototype.handleTypingIndicator === 'function') return; // 不覆盖已有实现
    window.MessageModule.prototype.handleTypingIndicator = function(_data){ showTyping(); };
    console.log('✅ 已注入 handleTypingIndicator 到 MessageModule.prototype');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch);
  } else { patch(); }
})();
