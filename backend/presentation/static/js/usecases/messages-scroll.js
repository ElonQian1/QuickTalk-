/*
 * 消息滚动加载胶水 (messages-scroll.js)
 * - 监听聊天消息容器触底，触发加载更多历史消息（优雅降级）
 * - 监听对话列表容器滚动接近底部时，尝试加载更多对话（若存在分页能力）
 */
(function(){
  'use strict';

  var state = {
    loadingMessages: false,
    loadingConversations: false,
    lastMsgPage: 1,
    lastConvPage: 1,
    enabled: true
  };

  function toast(msg){ if (typeof window.showToast==='function') window.showToast(msg, 'info'); }

  function nearBottom(el, threshold){
    threshold = threshold || 80; // px
    try { return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold; } catch(_e){ return false; }
  }

  function nearTop(el, threshold){
    threshold = threshold || 40; // px
    try { return el.scrollTop <= threshold; } catch(_e){ return false; }
  }

  async function loadMoreMessages(){
    if (state.loadingMessages) return;
    var mm = window.messageModule;
    if (!mm || !mm.currentConversationId) return;
    state.loadingMessages = true;
    try {
      if (typeof mm.loadMoreMessages === 'function') {
        await mm.loadMoreMessages(++state.lastMsgPage);
      } else if (typeof window.loadMoreMessages === 'function') {
        await window.loadMoreMessages(++state.lastMsgPage);
      } else {
        // 无分页能力则禁用该胶水
        state.enabled = false;
      }
    } catch(err){ console.warn('loadMoreMessages error:', err); }
    finally { state.loadingMessages = false; }
  }

  async function loadMoreConversations(){
    if (state.loadingConversations) return;
    var mm = window.messageModule;
    if (!mm || !mm.currentShopId) return;
    state.loadingConversations = true;
    try {
      if (window.ConversationsPagination && typeof window.ConversationsPagination.loadMore === 'function'){
        window.ConversationsPagination.loadMore();
      } else
      if (typeof mm.loadMoreConversations === 'function') {
        await mm.loadMoreConversations(++state.lastConvPage);
      } else if (typeof window.loadMoreConversations === 'function') {
        await window.loadMoreConversations(++state.lastConvPage);
      } else {
        state.enabled = false; // 无分页接口
      }
    } catch(err){ console.warn('loadMoreConversations error:', err); }
    finally { state.loadingConversations = false; }
  }

  function bind(){
    var chatList = document.getElementById('chatMessages');
    var convList = document.querySelector('#conversationsListView .conversation-list') || document.querySelector('#conversationsListView');

    if (chatList) {
      chatList.addEventListener('scroll', function(){
        if (!state.enabled) return;
        // 在聊天历史里使用上拉触顶加载更早消息
        if (nearTop(chatList, 40)) {
          loadMoreMessages();
        }
      });
    }

    if (convList) {
      convList.addEventListener('scroll', function(){
        if (!state.enabled) return;
        if (nearBottom(convList, 80)) {
          loadMoreConversations();
        }
      });
    }

    console.log('✅ 消息滚动加载已绑定 (messages-scroll.js)');
  }

  function reset(){
    state.lastMsgPage = 1;
    state.lastConvPage = 1;
    state.enabled = true;
  }

  function init(){
    // 轻延迟，等待 DOM/列表渲染
    setTimeout(bind, 250);
  }

  window.MessagesScroll = { init, reset };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
