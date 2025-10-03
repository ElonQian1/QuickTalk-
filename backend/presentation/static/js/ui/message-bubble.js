/*
 * UI: 消息气泡渲染 (message-bubble.js)
 * - 统一创建聊天消息 DOM：头像 + 气泡（文本 + 媒体）
 */
(function(){
  'use strict';

  function create(message, context){
    context = context || {}; // { currentCustomerName: string, isOwn: boolean }
    var wrap = document.createElement('div');
    var isCustomer = message.sender_type === 'customer';
    wrap.className = 'chat-message ' + (isCustomer ? 'customer' : 'agent');

    var avatarText = isCustomer
      ? (context.currentCustomerName ? context.currentCustomerName.charAt(0) : 'C')
      : 'A';

    var avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = avatarText;

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (message.content && String(message.content).trim()){
      var textDiv = document.createElement('div');
      textDiv.textContent = message.content;
      bubble.appendChild(textDiv);
    }

    if (Array.isArray(message.files)){
      message.files.forEach(function(file){
        if (window.MessageMediaUI && typeof window.MessageMediaUI.createMediaElement === 'function') {
          bubble.appendChild(window.MessageMediaUI.createMediaElement(file));
        }
      });
    }

    wrap.appendChild(avatar);
    wrap.appendChild(bubble);
    return wrap;
  }

  window.MessageBubbleUI = { create };
  console.log('✅ UI 组件已加载 (message-bubble.js)');
})();
