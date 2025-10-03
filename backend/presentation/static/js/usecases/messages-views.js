/*
 * 消息视图切换胶水 (messages-views.js)
 * - 统一切换 shopsListView / conversationsListView / chatView
 * - 派发 view:changed 事件供其他模块（如 bottom-nav）监听
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
    
    // 派发视图切换事件
    try {
      document.dispatchEvent(new CustomEvent('view:changed', { 
        detail: { page: 'messages', view: viewId } 
      }));
    } catch(e){}
    
    // 保留向后兼容的直接 DOM 操作（如果 bottom-nav UI 未加载）
    var bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav && !window.BottomNavUI) {
      if (viewId === 'chatView') bottomNav.classList.add('hidden');
      else bottomNav.classList.remove('hidden');
    }
  }

  window.MessagesViews = { show };
  console.log('✅ 消息视图切换已加载 (messages-views.js)');
})();

