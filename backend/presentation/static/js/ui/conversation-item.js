/*
 * UI: 对话项渲染 (conversation-item.js)
 * - 生成单个对话项 DOM，支持未读徽章、头像、名称、时间和最后消息
 * - 通过 options.onClick 绑定点击行为
 */
(function(){
  'use strict';

  function create(conversation, options){
    options = options || {};
    var el = document.createElement('div');
    el.className = 'conversation-item';
    el.setAttribute('data-conversation-id', conversation.id);
    if (conversation.shop_id) el.setAttribute('data-shop-id', conversation.shop_id);

    var lastMessageTime = conversation.last_message_time ?
      (window.Formatters ? window.Formatters.lastMessageTime(conversation.last_message_time) : new Date(conversation.last_message_time).toLocaleString()) :
      ((window.Formatters && window.Formatters.placeholders.lastMessage) || '暂无消息');

    if (window.ConversationUtils) {
      el.innerHTML = [
        window.ConversationUtils.generateAvatarHTML({
          customerId: conversation.customer_id,
          customerName: conversation.customer_name,
          unreadCount: conversation.unread_count || 0
        }),
        '<div class="conversation-content">',
          '<div class="conversation-header">',
            '<span class="customer-name">',
              window.ConversationUtils.formatCustomerName(conversation.customer_id, conversation.customer_name),
            '</span>',
            '<span class="message-time" data-conversation-id="', conversation.id ,'">', lastMessageTime, '</span>',
          '</div>',
          '<div class="last-message" data-conversation-id="', conversation.id ,'">', (conversation.last_message || (window.Formatters ? window.Formatters.placeholders.waitingCustomer : '等待客户消息...')), '</div>',
        '</div>'
      ].join('');
      if (conversation.unread_count > 0) el.classList.add('has-unread');
    } else {
      var displayName = conversation.customer_name || String(conversation.customer_id || '客户');
      var avatarInitial = displayName.charAt(displayName.length - 3) || 'C';
      el.innerHTML = [
        '<div class="conversation-avatar">', avatarInitial, '</div>',
        '<div class="conversation-content">',
          '<div class="conversation-header">',
            '<span class="customer-name">', displayName ,'</span>',
            '<span class="message-time" data-conversation-id="', conversation.id ,'">', lastMessageTime, '</span>',
          '</div>',
          '<div class="last-message" data-conversation-id="', conversation.id ,'">', (conversation.last_message || (window.Formatters ? window.Formatters.placeholders.waitingCustomer : '等待客户消息...')), '</div>',
        '</div>',
        (conversation.unread_count > 0 ? ('<div class="unread-badge" data-conversation-id="' + conversation.id + '">' + conversation.unread_count + '</div>') : '')
      ].join('');
    }

    if (window.DOMEnhancer) {
      try { window.DOMEnhancer.enhanceConversationItem(el, conversation); } catch(_e){}
    }

    if (typeof options.onClick === 'function') {
      el.addEventListener('click', function(){ options.onClick(conversation); });
    }

    return el;
  }

  window.ConversationItemUI = { create };
  console.log('✅ UI 组件已加载 (conversation-item.js)');
})();
