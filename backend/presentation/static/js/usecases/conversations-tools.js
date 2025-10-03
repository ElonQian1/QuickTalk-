// conversations-tools.js — 会话工具（从 mobile-dashboard.html 抽取）
// 提供：searchConversations, filterConversations, isRecentMessage, toggleQuickReplies, sendQuickReply
// 依赖：showToast（可选）、sendMessage（可选）

(function(){
  'use strict';

  window.searchConversations = function searchConversations() {
    const input = document.getElementById('conversationSearch');
    const raw = input ? input.value : '';
    const searchTerm = (raw || '').toLowerCase().trim();
    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      const nameEl = item.querySelector('.customer-name');
      const lastEl = item.querySelector('.last-message');
      const customerName = (nameEl?.textContent || '').toLowerCase();
      const lastMessage = (lastEl?.textContent || '').toLowerCase();
      item.style.display = (customerName.includes(searchTerm) || lastMessage.includes(searchTerm)) ? 'flex' : 'none';
    });
  };

  function isRecentMessage(timeString) {
    try {
      const messageTime = new Date(timeString);
      const now = new Date();
      const diffHours = (now - messageTime) / (1000 * 60 * 60);
      return diffHours <= 1;
    } catch { return false; }
  }

  window.filterConversations = function filterConversations(filterType) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-filter="${filterType}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const items = document.querySelectorAll('.conversation-item');
    items.forEach(item => {
      const unreadBadge = item.querySelector('.unread-badge');
      const hasUnread = unreadBadge && unreadBadge.textContent !== '0';
      switch (filterType) {
        case 'all':
          item.style.display = 'flex';
          break;
        case 'unread':
          item.style.display = hasUnread ? 'flex' : 'none';
          break;
        case 'active':
          const timeEl = item.querySelector('.message-time');
          const isRecent = isRecentMessage(timeEl ? timeEl.textContent : '');
          item.style.display = isRecent ? 'flex' : 'none';
          break;
      }
    });
  };

  window.toggleQuickReplies = function toggleQuickReplies() {
    const quickReplies = document.getElementById('quickReplies');
    if (!quickReplies) return;
    const display = quickReplies.style.display;
    quickReplies.style.display = (display === 'none' || display === '') ? 'flex' : 'none';
  };

  window.sendQuickReply = function sendQuickReply(text) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.value = text;
    if (typeof window.sendMessage === 'function') window.sendMessage();
    const quickReplies = document.getElementById('quickReplies');
    if (quickReplies) quickReplies.style.display = 'none';
  };
})();
