/*
 * dashboard-bootstrap.js — 首页仪表板胶水层
 * 负责首页的按钮/卡片行为绑定与一次性引导
 */
(function(){
  'use strict';

  function bind(){
    const root = document.getElementById('homePage') || document;

    // 查看工作台按钮（如有）
    const viewAnalyticsBtn = root.querySelector('[data-home-action="view-analytics"]');
    if (viewAnalyticsBtn){
      viewAnalyticsBtn.addEventListener('click', function(){
        if (typeof window.viewAnalytics === 'function') window.viewAnalytics();
      });
    }

    // 进入消息列表快捷（如有）
    const quickMessagesBtn = root.querySelector('[data-home-action="quick-messages"]');
    if (quickMessagesBtn){
      quickMessagesBtn.addEventListener('click', function(){
        if (typeof window.switchPage === 'function') window.switchPage('messages');
      });
    }

    // 进入店铺列表快捷（如有）
    const quickShopsBtn = root.querySelector('[data-home-action="quick-shops"]');
    if (quickShopsBtn){
      quickShopsBtn.addEventListener('click', function(){
        if (typeof window.switchPage === 'function') window.switchPage('shops');
      });
    }

    console.log('✅ dashboard-bootstrap.js 事件绑定完成');
  }

  let __wired = false;
  function init(){ if (__wired) return; __wired = true; setTimeout(bind, 200); }

  window.DashboardBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
