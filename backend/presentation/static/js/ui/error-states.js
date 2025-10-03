/*
 * UI: 错误态组件 (error-states.js)
 */
(function(){
  'use strict';
  function errorBlock(title, message){
    var wrap = document.createElement('div');
    wrap.className = 'error-message';
    wrap.innerHTML = [
      '<div class="empty-icon">❌</div>',
      '<div class="empty-title">', (title||'加载失败') ,'</div>',
      '<div class="empty-desc">', (message||'请稍后重试') ,'</div>'
    ].join('');
    return wrap;
  }
  window.ErrorStatesUI = { errorBlock };
  console.log('✅ UI 组件已加载 (error-states.js)');
})();
