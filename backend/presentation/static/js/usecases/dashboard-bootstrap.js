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

    // 快捷操作按钮绑定（使用事件委托）
    const actionButtons = root.querySelector('.action-buttons');
    if (actionButtons) {
      actionButtons.addEventListener('click', function(e) {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;
        
        // data-switch-page 属性
        const switchPage = btn.getAttribute('data-switch-page');
        if (switchPage && typeof window.switchPage === 'function') {
          window.switchPage(switchPage);
          return;
        }
        
        // data-action 属性
        const action = btn.getAttribute('data-action');
        if (action === 'create-shop') {
          if (typeof window.createNewShop === 'function') {
            window.createNewShop();
          } else if (window.CreateShopModal && typeof window.CreateShopModal.open === 'function') {
            window.CreateShopModal.open();
          }
          return;
        }
        
        // 降级：根据文本判断
        const text = btn.textContent.trim();
        if (text.includes('新增店铺') || text.includes('➕')) {
          if (typeof window.createNewShop === 'function') {
            window.createNewShop();
          } else if (window.CreateShopModal && typeof window.CreateShopModal.open === 'function') {
            window.CreateShopModal.open();
          }
        } else if (text.includes('工作台') || text.includes('报表') || text.includes('📊')) {
          if (typeof window.viewAnalytics === 'function') {
            window.viewAnalytics();
          } else if (typeof window.switchPage === 'function') {
            window.switchPage('workbench');
          }
        }
      });
    }

    console.log('✅ dashboard-bootstrap.js 事件绑定完成（含快捷操作）');
  }

  let __wired = false;
  function init(){ 
    if (__wired) return; 
    __wired = true; 
    setTimeout(() => {
      bind();
      // 加载首页数据
      if (typeof window.loadDashboardData === 'function') {
        window.loadDashboardData().catch(e => console.error('❌ 加载首页数据失败:', e));
      }
    }, 200); 
  }

  window.DashboardBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
