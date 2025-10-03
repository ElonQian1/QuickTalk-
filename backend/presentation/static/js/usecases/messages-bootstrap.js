/*
 * messages-bootstrap.js — 消息页交互胶水层
 * 绑定搜索、筛选、快捷回复、表情与媒体按钮；使用现有全局函数并优雅降级
 */
(function(){
  'use strict';

  function bind(){
    const root = document.getElementById('messagesPage') || document;

    // 若 ConversationsHeader 已接管搜索/筛选，则跳过以避免重复绑定
    const headerTaken = !!(window.ConversationsHeader || window.ConversationsHeaderUI);
    if (!headerTaken){
      // 搜索输入实时过滤
      const searchInput = root.getElementById ? root.getElementById('conversationSearch') : document.getElementById('conversationSearch');
      if (searchInput){
        searchInput.addEventListener('input', function(){
          if (typeof window.searchConversations === 'function') {
            window.searchConversations(this.value || '');
          }
        });
      }

      // 筛选按钮
      root.querySelectorAll?.('.filter-btn')?.forEach(function(btn){
        btn.addEventListener('click', function(){
          const filterType = this.getAttribute('data-filter');
          if (typeof window.filterConversations === 'function') {
            window.filterConversations(filterType);
          }
        });
      });
    }

    // 快捷回复入口
    const quickReplyBtn = root.querySelector('#quickReplyBtn');
    if (quickReplyBtn){
      quickReplyBtn.addEventListener('click', function(){
        if (typeof window.toggleQuickReplies === 'function') window.toggleQuickReplies();
      });
    }

    // 已渲染的快捷回复按钮
    root.querySelectorAll?.('.quick-reply-btn')?.forEach(function(btn){
      btn.addEventListener('click', function(){
        const text = this.textContent || '';
        if (typeof window.sendQuickReply === 'function') window.sendQuickReply(text);
      });
    });

    // 表情与媒体按钮（提示占位）
    const emojiBtn = root.querySelector('#emojiBtn');
    if (emojiBtn){
      emojiBtn.addEventListener('click', function(){ if (typeof window.showToast==='function') window.showToast('表情功能开发中...', 'info'); });
    }
    const mediaBtn = root.querySelector('#mediaBtn');
    if (mediaBtn){
      mediaBtn.addEventListener('click', function(){ if (typeof window.showToast==='function') window.showToast('文件上传功能开发中...', 'info'); });
    }

    console.log('✅ messages-bootstrap.js 事件绑定完成');
  }

  let __wired = false;
  function init(){ if (__wired) return; __wired = true; setTimeout(bind, 200); }

  window.MessagesBootstrap = { init };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
