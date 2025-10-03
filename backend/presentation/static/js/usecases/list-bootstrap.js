/*
 * list-bootstrap.js — 首屏列表加载与联动
 * 1) 首次进入消息页时展示店铺入口（messageModule.showShops）
 * 2) 首次进入店铺页加载店铺列表
 * 3) 与 WS 事件桥联动，当有店铺/消息动态时，按需触发轻量刷新（防抖）
 */
(function(){
  'use strict';

  let lastRefreshAt = 0;
  const MIN_INTERVAL = 2000; // 2s 防抖

  function canRefresh(){
    const now = Date.now();
    if (now - lastRefreshAt > MIN_INTERVAL){
      lastRefreshAt = now;
      return true;
    }
    return false;
  }

  function firstLoadMessages(){
    if (typeof window.loadConversations === 'function') {
      window.loadConversations();
    }
  }

  function firstLoadShops(){
    if (typeof window.loadShops === 'function') {
      window.loadShops();
    }
  }

  function onWsMessageAppended(){
    if (window.currentPage === 'messages'){
      if (canRefresh()) firstLoadMessages();
    }
  }

  function onShopUpdated(){
    if (window.currentPage === 'shops'){
      if (canRefresh()) firstLoadShops();
    }
  }

  function hookWsBridge(){
    // 包一层，避免直接改动 ws-event-bridge 的实现
    const origHandle = window.handleWebSocketMessage;
    if (typeof origHandle !== 'function') return;
    window.handleWebSocketMessage = function(data){
      try {
        const t = data && data.type;
        if (t === 'domain.event.message_appended' || t === 'new_message'){
          onWsMessageAppended();
        } else if (t === 'shop_update'){
          onShopUpdated();
        }
      } catch(e) { /* noop */ }
      return origHandle.apply(this, arguments);
    };
  }

  function init(){
    // 首屏：根据默认页面，拉起对应列表
    if (window.currentPage === 'messages') firstLoadMessages();
    if (window.currentPage === 'shops') firstLoadShops();
    hookWsBridge();
    console.log('✅ list-bootstrap.js 初始化完成');
  }

  window.ListBootstrap = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
