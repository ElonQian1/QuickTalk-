/*
 * 列表状态管理用例 (list-states.js)
 * - 统一注入空态/错误态到各列表容器
 * - 提供 showEmpty/showError/clear 接口
 */
(function(){
  'use strict';

  function showEmpty(containerId, type){
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var emptyNode = null;
    if (window.EmptyStatesUI) {
      switch(type){
        case 'conversations':
          emptyNode = window.EmptyStatesUI.conversations();
          break;
        case 'shops':
          emptyNode = window.EmptyStatesUI.shops();
          break;
        case 'messages':
          emptyNode = window.EmptyStatesUI.messages();
          break;
        case 'search':
          emptyNode = window.EmptyStatesUI.search();
          break;
        case 'workbench':
          emptyNode = window.EmptyStatesUI.workbench();
          break;
        default:
          emptyNode = window.EmptyStatesUI.generic('📋', '暂无内容', '');
      }
      if (emptyNode) container.appendChild(emptyNode);
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">暂无内容</div>';
    }
  }

  function showError(containerId, message){
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    var errorNode = null;
    if (window.ErrorStatesUI && typeof window.ErrorStatesUI.create === 'function') {
      errorNode = window.ErrorStatesUI.create(message || '加载失败', function(){
        // 预留重试回调
        if (window.showToast) window.showToast('请手动刷新重试');
      });
      container.appendChild(errorNode);
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:#ff4757;">❌ ' + (message || '加载失败') + '</div>';
    }
  }

  function clear(containerId){
    var container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
  }

  window.ListStates = { showEmpty: showEmpty, showError: showError, clear: clear };
  console.log('✅ list-states 用例已加载');
})();
