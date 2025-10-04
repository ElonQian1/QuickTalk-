/**
 * legacy/legacy-senders.js
 * 抽离自 message-module.js 的旧发送逻辑。
 * 行为保持原样，仅用于在尚未统一至 MessageSendChannel 之前维持兼容。
 */
(function(){
  'use strict';
  if (window.LegacySenders) return;

  const LegacySenders = {
    /**
     * 旧：_legacySendMessage
     * @param {Object} ctx { messageModule, content }
     */
    sendMessage(ctx){
      const { messageModule, content } = ctx;
      if (!messageModule || !content) return;
      if (!messageModule.currentConversationId) return;

      const payload = {
        type: 'message',
        conversation_id: messageModule.currentConversationId,
        content: content,
        files: [],
        sender_type: 'agent',
        timestamp: Date.now()
      };

      let sent = false;
      if (messageModule.wsAdapter) {
        try { sent = messageModule.wsAdapter.send(payload); } catch(_) { sent = false; }
      } else if (messageModule.websocket && messageModule.websocket.readyState === WebSocket.OPEN) {
        try { messageModule.websocket.send(JSON.stringify(payload)); sent = true; } catch(_) { sent = false; }
      }

      if (!sent) {
        console.error('[LegacySenders] WebSocket发送失败');
      }
    }
  };

  window.LegacySenders = LegacySenders;
  console.log('✅ legacy-senders.js 加载完成');
})();
