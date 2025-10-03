/*
 * 消息视图切换胶水 (messages-views.js)
 * - 统一切换 shopsListView / conversationsListView / chatView
 * - 负责底部导航显示与隐藏
 */
(function(){
  'use strict';

  var VIEWS = ['shopsListView', 'conversationsListView', 'chatView'];

  function show(viewId){
    VIEWS.forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      el.style.display = (id === viewId) ? 'block' : 'none';
    });
    var bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
      if (viewId === 'chatView') bottomNav.classList.add('hidden');
      else bottomNav.classList.remove('hidden');
    }
  }

  window.MessagesViews = { show };
  console.log('✅ 消息视图切换已加载 (messages-views.js)');
})();
