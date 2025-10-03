(function(){
  'use strict';

  var IDS = {
    topBar: 'chatTopLoader',
    noMore: 'chatNoMore'
  };

  function ensureTopBar(container){
    if (!container) return null;
    var bar = container.querySelector('#' + IDS.topBar);
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = IDS.topBar;
    bar.style.cssText = 'text-align:center;padding:8px 0;color:#6c757d;font-size:12px;';
    bar.innerHTML = '<span class="spinner" style="display:none;margin-right:6px">⏳</span><span class="text">上拉加载更早消息</span>';
    container.prepend(bar);
    return bar;
  }

  function showLoading(container){
    var bar = ensureTopBar(container);
    if (!bar) return;
    var sp = bar.querySelector('.spinner');
    var tx = bar.querySelector('.text');
    if (sp) sp.style.display = 'inline-block';
    if (tx) tx.textContent = '正在加载更早消息...';
  }

  function hideLoading(container){
    var bar = ensureTopBar(container);
    if (!bar) return;
    var sp = bar.querySelector('.spinner');
    var tx = bar.querySelector('.text');
    if (sp) sp.style.display = 'none';
    if (tx) tx.textContent = '上拉加载更早消息';
  }

  function showNoMore(container){
    var bar = ensureTopBar(container);
    if (!bar) return;
    var sp = bar.querySelector('.spinner');
    var tx = bar.querySelector('.text');
    if (sp) sp.style.display = 'none';
    if (tx) tx.textContent = '没有更早的消息了';
  }

  window.MessagesPaginationUI = {
    ensureTopBar: ensureTopBar,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showNoMore: showNoMore
  };

  console.log('✅ messages-pagination UI 已加载');
})();
