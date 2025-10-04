/**
 * message-dev-tools.js
 * 开发/手动验证辅助工具 (非生产关键路径) - 可在控制台使用 window.MessageDev.*
 */
(function(){
  if (window.MessageDev) return;
  const log = function(...a){ if (window.QT_LOG) QT_LOG.info('messageDev', ...a); else console.log('[MessageDev]', ...a); };

  function mm(){ return window.__messageModule || window.messageModule || window.msgModule || null; }
  function store(){ return window.MessageStateStore; }

  window.MessageDev = {
    module: mm,
    store: store,
    listConversations(){
      const s = store();
      if (!s) return [];
      return Array.from(s.conversations.keys());
    },
    listMessages(convId){
      const s = store();
      if (!s) return [];
      return s.getMessages(convId || s.currentConversationId);
    },
    injectFakeMessage(content='(fake)', opts={}){
      const s = store();
      if (!s) return null;
      const convId = s.currentConversationId;
      if (!convId){ log('无当前对话'); return null; }
      const fake = Object.assign({
        id: Math.floor(Math.random()*1e9),
        conversation_id: convId,
        content,
        sender_type: opts.sender_type || 'customer',
        created_at: new Date().toISOString(),
        status: 'sent'
      }, opts);
      s.appendMessage(convId, fake);
      log('已注入假消息', fake);
      return fake;
    },
    resendFailed(tempId){
      const m = mm();
      if (!m || !m._sender){ log('sender 不可用'); return false; }
      return m._sender.resendFailed(tempId);
    },
    resendAllFailed(){
      const m = mm();
      if (!m || !m._sender){ log('sender 不可用'); return 0; }
      return m._sender.resendAllFailed();
    }
  };
  log('MessageDev 工具已就绪');
})();
