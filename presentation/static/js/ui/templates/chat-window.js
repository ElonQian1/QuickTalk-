// Chat window rendering (stateless)
(function(global){
  const QT = global.QuickTalk || {}; const T = QT.Templates; const Time = QT.Time;
    QT.Templates = QT.Templates || {};
    if(!QT.Templates.renderMessageItem){
      console.warn('[Templates] renderMessageItem not loaded before chat-window; ensure message-item.js loads first.');
    }
    QT.Templates.renderChatWindow = function(state){
    const convId = state.ui.currentConversationId;
      const messages = QT.State ? QT.State.getMessagesForConversation(state, convId) : [];
      const renderItem = QT.Templates.renderMessageItem || (m=>`<div>${m.content||''}</div>`);
      return `<div class="qt-chat-window">${messages.map(renderItem).join('')}</div>`;
  }
  global.QuickTalk = global.QuickTalk || {}; global.QuickTalk.Templates = global.QuickTalk.Templates || {}; global.QuickTalk.Templates.renderChatWindow = renderChatWindow;
})(window);
