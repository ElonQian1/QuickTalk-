/*
 * UI: 加载态组件 (loading-states.js)
 */
(function(){
  'use strict';
  function spinner(text){
    var wrap = document.createElement('div');
    wrap.className = 'loading-state';
    wrap.innerHTML = [
      '<div class="loading-spinner"></div>',
      '<div class="loading-text">', (text||'正在加载...') ,'</div>'
    ].join('');
    return wrap;
  }
  window.LoadingStatesUI = { spinner };
  console.log('✅ UI 组件已加载 (loading-states.js)');
})();
