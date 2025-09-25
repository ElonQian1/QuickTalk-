// Simple state store (mutable + subscription) - first iteration
(function(global){
  const QT = global.QuickTalk = global.QuickTalk || {};
  function createStore(initial){
    let state = initial;
    const subs = new Set();
    function get(){ return state; }
    function set(partial){ state = { ...state, ...partial }; subs.forEach(fn=>fn(state)); }
    function update(fn){ state = fn(state); subs.forEach(fn=>fn(state)); }
    function subscribe(fn){ subs.add(fn); return ()=>subs.delete(fn); }
    return { get, set, update, subscribe };
  }
  // Domain specific helpers
  function appendMessage(store, msg){
    store.update(s=>{
      const convId = msg.conversationId;
      const list = s.messagesByConversation[convId] ? [...s.messagesByConversation[convId]] : [];
      if(!list.find(m=>m.id===msg.id)){ list.push(msg); }
      return { ...s, messagesByConversation: { ...s.messagesByConversation, [convId]: list } };
    });
  }
  QT.State = { createStore, appendMessage };
})(window);
