(function(){
  'use strict';

  var STATE = {
    enabled: true,
    pageSize: 10,
    shown: 0,
    total: 0,
    currentShopId: null,
    bar: null
  };

  function getListContainer(){ return document.querySelector('#conversationsListView .conversation-list'); }
  function getItems(){ return document.querySelectorAll('#conversationsListView .conversation-list .conversation-item'); }

  function hideBeyondShown(){
    var items = getItems();
    for (var i=0;i<items.length;i++){
      items[i].style.display = (i < STATE.shown) ? 'flex' : 'none';
    }
  }

  function appendBar(){
    var root = document.getElementById('conversationsListView');
    if (!root) return;
    if (!window.PaginationUI || typeof window.PaginationUI.createBar !== 'function') return;
    // 移除旧的
    var old = root.querySelector('.qt-pagination'); if (old) old.remove();
    var bar = window.PaginationUI.createBar({ total: STATE.total, shown: STATE.shown, onLoadMore: onLoadMore });
    STATE.bar = bar;
    root.appendChild(bar);
  }

  function onLoadMore(){
    var add = STATE.pageSize;
    STATE.shown = Math.min(STATE.shown + add, STATE.total);
    hideBeyondShown();
    if (STATE.bar && STATE.bar.__update) STATE.bar.__update({ total: STATE.total, shown: STATE.shown });
    if (window.ConversationsHeader && typeof window.ConversationsHeader.refresh === 'function'){
      window.ConversationsHeader.refresh();
    }
  }

  function apply(){
    if (!STATE.enabled) return;
    var list = getListContainer();
    if (!list){ return; }
    var items = getItems();
    STATE.total = items.length;
    STATE.shown = Math.min(STATE.pageSize, STATE.total);
    hideBeyondShown();
    appendBar();
  }

  function reset(shopId){
    STATE.currentShopId = shopId == null ? null : shopId;
    STATE.shown = 0; STATE.total = 0; STATE.bar = null;
  }

  function hookMessageModule(){
    var MM = window.MessageModule && window.MessageModule.prototype;
    if (!MM || MM.__convPaginationHooked) return;
    MM.__convPaginationHooked = true;

    var origSelectShop = MM.selectShop;
    if (typeof origSelectShop === 'function'){
      MM.selectShop = async function(shop){
        reset(shop && shop.id);
        var r = await origSelectShop.apply(this, arguments);
        try { apply(); } catch(e){}
        return r;
      };
    }

    var origRender = MM.renderConversationsList;
    if (typeof origRender === 'function'){
      MM.renderConversationsList = function(){
        var r = origRender.apply(this, arguments);
        try { apply(); } catch(e){}
        return r;
      };
    }
  }

  function loadMore(){ onLoadMore(); }

  function init(){ hookMessageModule(); }

  window.ConversationsPagination = { init: init, apply: apply, reset: reset, loadMore: loadMore };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
