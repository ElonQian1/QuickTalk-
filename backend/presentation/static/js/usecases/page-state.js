/*
 * PageState — 页面状态与首屏数据引导
 * 将分散在各处的页面态初始化与首次数据加载，收口为统一入口，便于 app-init 调用。
 */
(function(){
  'use strict';

  function callIf(obj, name, ...args){
    try { const fn = obj && obj[name]; return typeof fn === 'function' ? fn.apply(obj, args) : undefined; } catch(e){ console.warn('PageState callIf error:', name, e); }
  }

  async function init(){
    const U = window.UnifiedUsecases;
    // 首屏仪表板数据
    if (U && typeof U.loadPageData === 'function') {
      await U.loadPageData('home');
    } else {
      await callIf(window, 'loadDashboardData');
    }
    // 个人资料页面初始化
    if (U && typeof U.initializeProfilePage === 'function') {
      U.initializeProfilePage();
    } else {
      callIf(window, 'initializeProfilePage');
    }
    // 页面状态初始化（tab 可见性/默认展示页等）
    if (U && typeof U.initializePageStates === 'function') {
      U.initializePageStates();
    } else {
      callIf(window, 'initializePageStates');
    }
    console.log('✅ PageState.init 完成');
  }

  window.PageState = { init };
})();
