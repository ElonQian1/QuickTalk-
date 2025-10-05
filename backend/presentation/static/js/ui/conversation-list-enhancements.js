/* conversation-list-enhancements.js
 * 1. 布局切换 (horizontal <-> vertical) + localStorage 记忆
 * 2. 监听新消息 / 已读事件进行局部更新 (依赖 UnifiedUIComponents.updateConversationItem + ConversationNormalizer)
 */
(function(){
  'use strict';
  var LS_KEY = 'qt_conversation_layout_mode';
  var defaultMode = 'horizontal';

  function applyLayout(mode){
    mode = (mode === 'vertical') ? 'vertical' : 'horizontal';
    document.body.classList.toggle('layout-vertical', mode === 'vertical');
    document.body.classList.toggle('layout-horizontal', mode === 'horizontal');
    try { localStorage.setItem(LS_KEY, mode); } catch(_){ }
    updateToggleState(mode);
  }

  function updateToggleState(mode){
    var btns = document.querySelectorAll('.layout-toggle-btn');
    btns.forEach(function(b){ b.classList.remove('active'); });
    var active = document.querySelector('.layout-toggle-btn[data-mode="' + mode + '"]');
    if (active) active.classList.add('active');
  }

  function ensureToggleButtons(){
    var header = document.querySelector('.conversations-header');
    if (!header || header.querySelector('.layout-toggle-group')) return;
    var group = document.createElement('div');
    group.className = 'layout-toggle-group';
    group.innerHTML = [
      '<button class="layout-toggle-btn" data-mode="horizontal">横向</button>',
      '<button class="layout-toggle-btn" data-mode="vertical">纵向</button>'
    ].join('');
    header.appendChild(group);
    group.addEventListener('click', function(e){
      var btn = e.target.closest('.layout-toggle-btn');
      if (!btn) return;
      var mode = btn.getAttribute('data-mode');
      applyLayout(mode);
    });
  }

  function initLayout(){
    ensureToggleButtons();
    var saved = null; try { saved = localStorage.getItem(LS_KEY); } catch(_){ }
    applyLayout(saved || defaultMode);
  }

  // ---- 局部更新事件桥接 ----
  function handleIncomingMessage(evt){
    var data = (evt && evt.detail) || evt || {};
    if (!data.conversation_id) return;
    var patch = {
      id: data.conversation_id,
      last_message_content: data.content || data.last_message_content || data.last_message,
      last_message_time: data.timestamp || data.sent_at || Date.now(),
    };
    if (data.sender_type === 'customer') {
      patch.unread_count = (data.unread_count != null ? data.unread_count : undefined);
      // 若没有提供新的 unread_count，交由后端聚合事件再刷新
    }
    if (window.UnifiedUIComponents && typeof window.UnifiedUIComponents.updateConversationItem === 'function'){
      window.UnifiedUIComponents.updateConversationItem(patch);
    }
  }

  function handleConversationRead(evt){
    var d = (evt && evt.detail) || {}; if (!d.conversationId && !d.conversation_id) return;
    var id = d.conversationId || d.conversation_id;
    if (window.UnifiedUIComponents && typeof window.UnifiedUIComponents.updateConversationItem === 'function'){
      window.UnifiedUIComponents.updateConversationItem(id, { unread_count:0, unreadCount:0 });
    }
  }

  function bindEvents(){
    document.addEventListener('conversation:incoming-message', handleIncomingMessage);
    document.addEventListener('conversation:read', handleConversationRead);
    // 兼容旧事件名
    document.addEventListener('message:new', handleIncomingMessage);
    document.addEventListener('ws:message', handleIncomingMessage);
    document.addEventListener('message:incoming', handleIncomingMessage);
  }

  // 调试功能
  function debugConversations(){
    const items = document.querySelectorAll('.conversation-item');
    console.log('会话项调试信息:');
    items.forEach((el, i) => {
      console.log(`会话 ${i+1}:`, {
        id: el.getAttribute('data-conversation-id'),
        raw: el.__raw,
        normalized: el.__normalized,
        lastMessage: el.querySelector('.last-message')?.textContent
      });
    });
  }

  function ready(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  ready(function(){
    initLayout();
    bindEvents();
  });

  window.ConversationListEnhancements = { applyLayout, updateToggleState, debugConversations };
  // 全局调试快捷方式
  window.__debugConversations = debugConversations;
  console.log('✅ conversation-list-enhancements 已加载');
})();
