/*
 * shops-bootstrap.js — 店铺页交互胶水层
 * 搜索/排序/筛选与点击处理，自动在列表更新后重绑
 */
(function(){
  'use strict';

  let __wired = false;
  let observer = null;

  function bind(){
    const root = document.getElementById('shopsPage') || document;

    // 如果存在专用头部控制器，则避免重复绑定搜索/排序/筛选逻辑
    if (!window.ShopsHeaderController) {
      // 搜索框
      const search = root.querySelector('#shopSearch');
      if (search){
        search.addEventListener('input', function(){
          const kw = (this.value || '').toLowerCase();
          document.querySelectorAll('.shop-card[data-shop-id]')?.forEach(function(card){
            const name = (card.querySelector('.shop-name')?.textContent || '').toLowerCase();
            card.style.display = !kw || name.includes(kw) ? '' : 'none';
          });
        });
      }
      // 排序（示例：按名称）
      const sortBtn = root.querySelector('[data-shops-action="sort-name"]');
      if (sortBtn){
        sortBtn.addEventListener('click', function(){
          const container = document.querySelector('#shopsList .shop-list') || document.querySelector('#shopsList');
          if (!container) return;
          const cards = Array.from(container.querySelectorAll('.shop-card'));
          cards.sort(function(a,b){
            const an = (a.querySelector('.shop-name')?.textContent || '').trim();
            const bn = (b.querySelector('.shop-name')?.textContent || '').trim();
            return an.localeCompare(bn, 'zh');
          });
          container.innerHTML = '';
          cards.forEach(c => container.appendChild(c));
        });
      }
      // 筛选（示例：按状态 data-status）
      const filterBtn = root.querySelector('[data-shops-action="filter-active"]');
      if (filterBtn){
        filterBtn.addEventListener('click', function(){
          document.querySelectorAll('.shop-card[data-shop-id]')?.forEach(function(card){
            const statusText = (card.querySelector('.status-badge')?.textContent || '').toLowerCase();
            const active = /active|approved/.test(statusText);
            card.style.display = active ? '' : 'none';
          });
        });
      }
    }

    // 店铺卡点击（兜底）
    document.querySelectorAll('.shop-card[data-shop-id]')?.forEach(function(card){
      if (!card.__wired_click) {
        card.__wired_click = true;
        card.addEventListener('click', function(ev){
          const id = this.getAttribute('data-shop-id');
          if (typeof window.handleShopClick === 'function') return window.handleShopClick(id, ev);
        });
      }
    });

    console.log('✅ shops-bootstrap.js 事件绑定完成');
  }

  function rebindOnListChange(){
    const listRoot = document.querySelector('#shopsList');
    if (!listRoot) return;
    if (observer) { observer.disconnect(); observer = null; }
    observer = new MutationObserver(function(mut){
      let added = false;
      for (const m of mut){
        if (m.type === 'childList' && (m.addedNodes?.length || 0) > 0) { added = true; break; }
      }
      if (added) setTimeout(bind, 100);
    });
    observer.observe(listRoot, { childList:true, subtree:true });
  }

  function init(){
    if (__wired) return; __wired = true;
    setTimeout(function(){ bind(); rebindOnListChange(); }, 200);
  }

  window.ShopsBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
