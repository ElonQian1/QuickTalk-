(function(){
  'use strict';

  var STATE = {
    pageSize: 20,
    shown: 0,
    total: 0,
    cursor: null, // 最早一条消息的时间/ID，供后端 before 使用
    noMore: false
  };

  function getChatList(){ return document.getElementById('chatMessages'); }

  function withUIPending(fn){
    var list = getChatList();
    if (window.MessagesPaginationUI && typeof window.MessagesPaginationUI.showLoading==='function'){
      window.MessagesPaginationUI.showLoading(list);
    }
    return Promise.resolve()
      .then(fn)
      .finally(function(){
        if (window.MessagesPaginationUI && typeof window.MessagesPaginationUI.hideLoading==='function'){
          window.MessagesPaginationUI.hideLoading(list);
        }
      });
  }

  function initCursor(messages){
    if (!Array.isArray(messages) || messages.length === 0) return;
    var first = messages[0];
    STATE.cursor = first.id || first.sent_at || first.created_at || null;
  }

  function applyInitial(messages){
    STATE.total = Array.isArray(messages) ? messages.length : 0;
    STATE.shown = Math.min(STATE.pageSize, STATE.total);
    STATE.noMore = false;
    initCursor(messages);
    // 隐藏超出部分
    var nodes = (getChatList()||{}).children || [];
    for (var i=0;i<nodes.length;i++){
      nodes[i].style.display = (i < STATE.shown) ? '' : 'none';
    }
  }

  function revealMoreLocal(){
    var add = STATE.pageSize;
    var before = STATE.shown;
    STATE.shown = Math.min(STATE.shown + add, STATE.total);
    var nodes = (getChatList()||{}).children || [];
    for (var i=before;i<STATE.shown;i++){
      if (nodes[i]) nodes[i].style.display = '';
    }
    if (STATE.shown >= STATE.total) STATE.noMore = true;
    if (STATE.noMore && window.MessagesPaginationUI && typeof window.MessagesPaginationUI.showNoMore==='function'){
      window.MessagesPaginationUI.showNoMore(getChatList());
    }
  }

  async function fetchEarlierFromServer(){
    var mm = window.messageModule;
    if (!mm || !mm.currentConversationId) return null;
    try {
      var url = '/api/conversations/' + mm.currentConversationId + '/messages';
      if (STATE.cursor) url += ('?before=' + encodeURIComponent(STATE.cursor));
      var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + (window.getAuthToken?getAuthToken():'' ) } });
      var data = await resp.json();
      if (!data || !data.success || !Array.isArray(data.data)) return null;
      return data.data; // 假定服务器按时间升序返回
    } catch(e){ console.warn('fetchEarlierFromServer failed', e); return null; }
  }

  async function loadMore(){
    if (STATE.noMore) return;
    // 优先尝试从后端拿更早的消息
    return withUIPending(async function(){
      var earlier = await fetchEarlierFromServer();
      if (Array.isArray(earlier) && earlier.length > 0){
        // 将更早消息 prepend 到现有 messages，并插入 DOM 顶部
        try {
          var mm = window.messageModule;
          if (mm && Array.isArray(mm.messages)){
            mm.messages = earlier.concat(mm.messages);
          }
          var list = getChatList();
          var prevScrollHeight = list ? list.scrollHeight : 0;
          // 为每条消息创建气泡（与 MessageBubbleUI 保持一致）
          earlier.forEach(function(m){
            if (window.MessageBubbleUI && typeof window.MessageBubbleUI.create==='function'){
              var node = window.MessageBubbleUI.create(m, { currentCustomerName: mm && mm.currentCustomer && mm.currentCustomer.name });
              if (list && node) list.insertBefore(node, list.firstChild);
            }
          });
          STATE.total += earlier.length;
          // 更新 cursor 为更早的第一条
          initCursor(earlier);
          // 调整滚动保持视口稳定
          if (list) list.scrollTop = list.scrollHeight - prevScrollHeight;
          // 同步本地 reveal 计数
          STATE.shown += earlier.length;
          return;
        } catch(e){ console.warn('prepend earlier failed', e); }
      }
      // 否则，回退为仅展示本地更多
      revealMoreLocal();
    });
  }

  function apply(){
    var mm = window.messageModule;
    if (!mm || !Array.isArray(mm.messages)) return;
    applyInitial(mm.messages);
    if (STATE.shown >= STATE.total && window.MessagesPaginationUI && typeof window.MessagesPaginationUI.showNoMore==='function'){
      window.MessagesPaginationUI.showNoMore(getChatList());
    }
  }

  function reset(){ STATE.shown = 0; STATE.total = 0; STATE.cursor = null; STATE.noMore = false; }

  window.MessagesPagination = { apply: apply, reset: reset, loadMore: loadMore };

  console.log('✅ messages-pagination 用例已加载');
})();
