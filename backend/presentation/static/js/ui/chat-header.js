/*
 * UI: 聊天头部组件 (chat-header.js)
 * - 统一更新聊天头部的返回按钮文案、标题、客户头像与名称
 * - 纯 UI 组件，无业务依赖；缺元素时安全降级
 */
(function(){
  'use strict';

  function text(el, value){ if (el) el.textContent = value; }
  function show(el){ if (el) el.style.display = 'inline-block'; }

  function computeCustomerName(conversation){
    try {
      if (window.ConversationUtils && typeof window.ConversationUtils.formatCustomerName === 'function') {
        return window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name);
      }
      return conversation.customer_name || (conversation.customer_id ? String(conversation.customer_id) : '客户');
    } catch(_e){ return conversation.customer_name || '客户'; }
  }

  function setAvatar(conversation){
    var el = document.getElementById('customerAvatar');
    if (!el) return;
    if (window.ConversationUtils && typeof window.ConversationUtils.generateAvatarInitial === 'function'){
      var initial = window.ConversationUtils.generateAvatarInitial(conversation.customer_id, conversation.customer_name);
      var theme = window.ConversationUtils.generateAvatarTheme && window.ConversationUtils.generateAvatarTheme(conversation.customer_id);
      text(el, initial);
      el.className = 'customer-avatar' + (theme ? (' ' + theme) : '');
      return;
    }
    var name = conversation.customer_name || 'C';
    text(el, name.charAt(0).toUpperCase());
  }

  function updateForConversation(conversation, opts){
    opts = opts || {};
    var backBtn = document.getElementById('messagesBackBtn');
    var titleEl = document.getElementById('messagesTitle');
    var nameEl = document.getElementById('customerName');

    if (backBtn) { text(backBtn, '← 对话列表'); show(backBtn); }

    var displayName = opts.customerName || computeCustomerName(conversation);
    text(titleEl, displayName);
    if (nameEl) text(nameEl, displayName);
    setAvatar(conversation);
  }

  window.ChatHeaderUI = { updateForConversation };
  console.log('✅ UI 组件已加载 (chat-header.js)');
})();
