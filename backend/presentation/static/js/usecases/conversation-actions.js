// conversation-actions.js — 对话基础动作（从 mobile-dashboard.html 抽取）
// 提供：transferConversation, endConversation
// 依赖：messageManager, showToast, goBackInMessages（可选）

(function(){
  'use strict';

  window.transferConversation = function transferConversation() {
    const mm = window.messageManager;
    if (!mm || !mm.currentConversationId) {
      if (typeof window.showToast === 'function') window.showToast('请先选择一个对话', 'error');
      return;
    }
    if (typeof window.showToast === 'function') window.showToast('对话转接功能开发中...', 'info');
    // TODO: 实现对话转接功能
  };

  window.endConversation = function endConversation() {
    const mm = window.messageManager;
    if (!mm || !mm.currentConversationId) {
      if (typeof window.showToast === 'function') window.showToast('请先选择一个对话', 'error');
      return;
    }
    if (confirm('确定要结束这个对话吗？')) {
      if (typeof window.showToast === 'function') window.showToast('对话已结束', 'success');
      if (typeof window.goBackInMessages === 'function') window.goBackInMessages();
      // TODO: 实现结束对话逻辑
    }
  };
})();
