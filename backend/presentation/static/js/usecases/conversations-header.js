(function(){
  'use strict';

  var __wired = false;

  function computeStats(){
    // 从 DOM 计算：总对话数与未读数
    var items = document.querySelectorAll('.conversation-item');
    var total = items.length;
    var unread = 0;
    items.forEach(function(item){
      var badge = item.querySelector('.unread-badge');
      if (!badge) return;
      var txt = (badge.textContent||'').trim();
      var n = parseInt(txt, 10);
      if (!isNaN(n) && n > 0) unread += 1;
    });
    if (window.ConversationsHeaderUI && typeof window.ConversationsHeaderUI.updateStats === 'function'){
      window.ConversationsHeaderUI.updateStats(total, unread);
    }
  }

  function onSearchInput(){
    if (typeof window.searchConversations === 'function') {
      window.searchConversations();
    }
    // 可选：高亮匹配
    try {
      var term = (document.getElementById('conversationSearch')?.value || '').trim();
      if (window.SearchHighlightUI && typeof window.SearchHighlightUI.apply === 'function'){
        window.SearchHighlightUI.apply(term);
      }
    } catch(e){}
    computeStats();
  }

  function onFilterClick(e){
    var filterType = this.getAttribute('data-filter');
    if (window.ConversationsHeaderUI && typeof window.ConversationsHeaderUI.setActiveFilter === 'function'){
      window.ConversationsHeaderUI.setActiveFilter(filterType);
    }
    if (typeof window.filterConversations === 'function'){
      window.filterConversations(filterType);
    }
    computeStats();
  }

  function wire(){
    if (__wired) return; __wired = true;
    // 确保 UI 已初始化并存在搜索框
    if (window.ConversationsHeaderUI && typeof window.ConversationsHeaderUI.init === 'function'){
      window.ConversationsHeaderUI.init();
    }
    var els = window.ConversationsHeaderUI && typeof window.ConversationsHeaderUI.getElements==='function'
      ? window.ConversationsHeaderUI.getElements() : { header: null };
    if (!els || !els.header){
      // 延迟重试一次（等待 partials 注入）
      setTimeout(wire, 200);
      return;
    }
    // 绑定搜索
    var input = els.searchInput || window.ConversationsHeaderUI.ensureSearch();
    if (input && !input.__wired){
      input.addEventListener('input', onSearchInput);
      // “搜索”按钮回车行为
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') onSearchInput(); });
      input.__wired = true;
    }
    // 绑定按钮
    (els.filterButtons || []).forEach(function(btn){
      if (btn.__wired) return; btn.addEventListener('click', onFilterClick); btn.__wired = true;
    });
    // 初次计算
    setTimeout(computeStats, 50);
  }

  function refresh(){
    // 在对话列表重渲染后可调用以更新统计
    computeStats();
  }

  // 对 MessageModule 的软集成：若存在 renderConversationsList，则包裹以刷新统计
  function hookMessageModule(){
    var MM = window.MessageModule && window.MessageModule.prototype;
    if (!MM) return;
    if (MM.__convHeaderHooked) return; MM.__convHeaderHooked = true;
    var origRender = MM.renderConversationsList;
    if (typeof origRender === 'function'){
      MM.renderConversationsList = function(){
        var r = origRender.apply(this, arguments);
        try { refresh(); } catch(e){}
        return r;
      };
    }
  }

  function init(){
    wire();
    hookMessageModule();
    console.log('✅ conversations-header 用例已初始化');
  }

  window.ConversationsHeader = { init, refresh };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
