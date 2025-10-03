/*
 * 底部导航状态管理用例 (bottom-nav.js)
 * - 监听视图切换事件，控制底部导航显示/隐藏
 * - messagesPage 的 chatView 隐藏导航，其他视图显示导航
 */
(function(){
  'use strict';

  var inited = false;

  function onViewChange(e){
    if (!e || !e.detail) return;
    var view = e.detail.view || '';
    var page = e.detail.page || '';
    
    // 在 messagesPage 的 chatView 中隐藏导航，其他情况显示
    if (page === 'messages' && view === 'chatView') {
      if (window.BottomNavUI && typeof window.BottomNavUI.hide === 'function') {
        window.BottomNavUI.hide();
      }
    } else {
      if (window.BottomNavUI && typeof window.BottomNavUI.show === 'function') {
        window.BottomNavUI.show();
      }
    }
  }

  function bind(){
    if (inited) return;
    inited = true;
    // 监听自定义事件 view:changed
    document.addEventListener('view:changed', onViewChange);
    // 初始默认显示导航
    if (window.BottomNavUI && typeof window.BottomNavUI.show === 'function') {
      window.BottomNavUI.show();
    }
    console.log('✅ bottom-nav 用例已初始化');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else { bind(); }
})();
