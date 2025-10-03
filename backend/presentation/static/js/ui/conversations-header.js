(function(){
  'use strict';

  var __inited = false;

  function qs(root, sel){ return (root||document).querySelector(sel); }
  function qsa(root, sel){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  function ensureHeader(){
    var header = qs(document, '.conversations-header');
    return header || null;
  }

  function ensureSearch(){
    var header = ensureHeader();
    if (!header) return null;
    var existing = header.querySelector('#conversationSearch');
    if (existing) return existing;
    // 构建搜索容器（占位，使用已存在的 CSS 样式）
    var container = document.createElement('div');
    container.className = 'search-container';
    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'conversationSearch';
    input.className = 'search-input';
    input.placeholder = '搜索客户或消息';
    var btn = document.createElement('button');
    btn.className = 'search-btn';
    btn.textContent = '搜索';
    var clearBtn = document.createElement('button');
    clearBtn.className = 'search-btn';
    clearBtn.type = 'button';
    clearBtn.textContent = '清空';
    clearBtn.addEventListener('click', function(){
      input.value = '';
      var ev = new Event('input');
      input.dispatchEvent(ev);
    });
    container.appendChild(input);
    container.appendChild(btn);
    container.appendChild(clearBtn);
    header.appendChild(container);
    return input;
  }

  function updateStats(total, unread){
    try {
      var totalEl = document.getElementById('totalConversationsCount');
      var unreadEl = document.getElementById('unreadConversationsCount');
      if (totalEl) totalEl.textContent = String(total == null ? 0 : total);
      if (unreadEl) unreadEl.textContent = String(unread == null ? 0 : unread);
    } catch(e){ /* noop */ }
  }

  function setActiveFilter(filter){
    try {
      qsa(document, '.filter-btn').forEach(function(btn){ btn.classList.remove('active'); });
      var active = qs(document, '.filter-btn[data-filter="' + filter + '"]');
      if (active) active.classList.add('active');
    } catch(e){ /* noop */ }
  }

  function getElements(){
    var header = ensureHeader();
    return {
      header: header,
      searchInput: header ? header.querySelector('#conversationSearch') : null,
      searchBtn: header ? header.querySelector('.search-btn') : null,
      filterButtons: header ? qsa(header, '.filter-btn') : []
    };
  }

  function setSearchTerm(val){
    var el = ensureSearch();
    if (!el) return;
    el.value = val == null ? '' : String(val);
  }

  function getSearchTerm(){
    var el = ensureSearch();
    return el ? (el.value || '') : '';
  }

  function init(){
    if (__inited) return; __inited = true;
    // 在组件加载完成后确保搜索框存在
    setTimeout(ensureSearch, 0);
  }

  window.ConversationsHeaderUI = {
    init: init,
    ensureSearch: ensureSearch,
    updateStats: updateStats,
    setActiveFilter: setActiveFilter,
    getElements: getElements,
    setSearchTerm: setSearchTerm,
    getSearchTerm: getSearchTerm
  };

  console.log('✅ conversations-header UI 已加载');
})();
