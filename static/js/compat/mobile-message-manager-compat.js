// Compatibility wrapper to gradually replace legacy MobileMessageManager
(function(global){
  if(!global.MobileMessageManager){
    console.warn('[Compat] Legacy MobileMessageManager not loaded yet. Load order: legacy script first, then this file.');
    return;
  }
  const QT = global.QuickTalk || {};
  const originalInit = global.MobileMessageManager.prototype.init;
  function ensureStore(){
    if(!QT._store){
      QT._store = QT.State.createStore({ messagesByConversation:{}, ui:{ currentConversationId: null } });
      // auto re-render hook (only for active conversation container)
      QT._store.subscribe(state => {
        const convId = state.ui.currentConversationId;
        if(!convId) return;
        const container = document.getElementById('messageContent') || document.getElementById('messagesContainer');
        if(container && QT.Templates && QT.Templates.renderChatWindow){
          const parent = document.getElementById('messageContent');
          if(parent){ parent.innerHTML = QT.Templates.renderChatWindow(state); }
        }
      });
    }
  }
  global.MobileMessageManager.prototype.init = async function(){
    ensureStore();
    if(!QT._mobileApp){
      QT._mobileApp = new QT.MobileApp();
      QT._mobileApp.init();
      QT._mobileApp.on('message.appended', (msg)=>{
        QT.State.appendMessage(QT._store, msg);
      });
    }
    const result = await originalInit.apply(this, arguments);
    // 当 legacy 完成对话窗口渲染后，设定当前对话ID（如果已存在）
    if(this.currentConversation){
      QT._store.update(s=>({ ...s, ui:{ ...s.ui, currentConversationId: this.currentConversation.id } }));
    }
    return result;
  };
})(window);
