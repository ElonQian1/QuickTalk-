/*
 * 全局状态与启动 (globals.js)
 * - 统一声明跨模块共享的全局变量（保留旧名，避免破坏）
 * - DOMContentLoaded 阶段由 app-init 接管启动
 */
(function(){
  'use strict';
  // 统一的全局状态（尽量集中管理）
  window.currentPage = window.currentPage || 'home';
  window.userData = window.userData || null;
  window.shopsData = window.shopsData || [];
  window.conversationsData = window.conversationsData || [];
  window.websocket = window.websocket || null;
  window.currentShopId = window.currentShopId || null;
  window.isPageSwitching = window.isPageSwitching || false;

  // 不再在此处挂载 DOMContentLoaded，避免与 app-init 冲突
  console.log('✅ globals.js 已加载并初始化默认全局状态');
})();
