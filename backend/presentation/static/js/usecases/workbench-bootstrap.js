/*
 * workbench-bootstrap.js — 工作台/报表页胶水层
 * 负责工作台页的交互初始化：过滤器、刷新、返回等（根据组件存在性绑定）
 */
(function(){
  'use strict';

  function bind(){
    const root = document.getElementById('workbenchPage') || document;

    // 返回首页
    const backBtn = root.querySelector('[data-workbench-action="back-home"]');
    if (backBtn){
      backBtn.addEventListener('click', function(){
        if (typeof window.switchPage === 'function') window.switchPage('home');
      });
    }

    // 刷新数据
    const refreshBtn = root.querySelector('[data-workbench-action="refresh"]');
    if (refreshBtn){
      refreshBtn.addEventListener('click', function(){
        if (typeof window.loadWorkbenchSummary === 'function') window.loadWorkbenchSummary();
      });
    }

    // 店铺筛选（示例：data-shop-id 属性按钮）
    root.querySelectorAll('[data-workbench-shop]')?.forEach(function(btn){
      btn.addEventListener('click', function(){
        const id = this.getAttribute('data-workbench-shop');
        window.currentShopId = id || null;
        if (typeof window.loadWorkbenchSummary === 'function') window.loadWorkbenchSummary();
      });
    });

    console.log('✅ workbench-bootstrap.js 事件绑定完成');
  }

  let __wired = false;
  function init(){ if (__wired) return; __wired = true; setTimeout(bind, 200); }

  window.WorkbenchBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
