/**
 * message-state-store.js
 * 职责：集中管理消息域状态（店铺/对话/消息集合 + temp 映射）
 * 不直接操作 DOM，只通过 EventBus 发布事件：
 *  - shop.selected {shopId}
 *  - conversation.selected {conversationId}
 *  - message.appended {message, conversationId}
 *  - message.updated {message, conversationId}
 *  - message.deleted {id, conversationId}
 */
(function(){
  if (window.MessageStateStore) return; // 幂等
  const bus = ()=> window.MessageEventBus;
  const NS = 'messageCore';
  const log = (lvl,...a)=> { if (window.QT_LOG) (QT_LOG[lvl]||QT_LOG.debug)(NS, ...a); };

  class MessageStateStore {
    constructor(){
      this.currentShopId = null;
      this.currentConversationId = null;
      this.conversations = new Map(); // conversationId -> meta
      this.messages = new Map();      // conversationId -> Array<Message>
      this.tempIndex = new Map();     // temp_id -> { conversationId, index }
    }

    setCurrentShop(id){
      if (this.currentShopId === id) return;
      this.currentShopId = id;
      bus().publish('shop.selected', { shopId:id });
      log('debug','setCurrentShop', id);
    }

    setCurrentConversation(id){
      if (this.currentConversationId === id) return;
      this.currentConversationId = id;
      bus().publish('conversation.selected', { conversationId:id });
      log('debug','setCurrentConversation', id);
    }

    ensureList(convId){ if (!this.messages.has(convId)) this.messages.set(convId, []); return this.messages.get(convId); }

    setMessages(convId, list, opts){
      if (!convId) return;
      const safeArr = Array.isArray(list) ? list.slice() : [];
      this.messages.set(convId, safeArr);
      // 重建 tempIndex 中该会话相关部分
      [...this.tempIndex.entries()].forEach(([tid,loc])=>{ if (loc.conversationId === convId) this.tempIndex.delete(tid); });
      safeArr.forEach((m,i)=>{ if (m.temp_id) this.tempIndex.set(m.temp_id, { conversationId: convId, index:i }); });
      const useBulk = !(opts && opts.disableBulkEvent);
      if (useBulk){
        // 新增: 批量事件减少首屏渲染抖动
        bus().publish('messages.bulkLoaded', { conversationId: convId, messages: safeArr });
      } else {
        // 兼容旧路径：逐条 appended
        safeArr.forEach(m => bus().publish('message.appended', { message:m, conversationId: convId }));
      }
      log('debug','setMessages', convId, safeArr.length, { bulk: useBulk });
    }

    appendMessage(convId, msg){
      const list = this.ensureList(convId);
      list.push(msg);
      if (msg.temp_id){ this.tempIndex.set(msg.temp_id, { conversationId: convId, index: list.length-1 }); }
      bus().publish('message.appended', { message: msg, conversationId: convId });
    }

    updateMessage(convId, partial){
      const list = this.ensureList(convId);
      const idx = list.findIndex(m => (partial.id && m.id === partial.id) || (partial.temp_id && m.temp_id === partial.temp_id));
      if (idx < 0) return false;
      list[idx] = { ...list[idx], ...partial };
      bus().publish('message.updated', { message: list[idx], conversationId: convId });
      return true;
    }

    replaceTemp(tempId, serverMsg){
      const loc = this.tempIndex.get(tempId);
      if (!loc) return false;
      const list = this.ensureList(loc.conversationId);
      const idx = loc.index;
      if (!list[idx] || list[idx].temp_id !== tempId) {
        // fallback：线性搜索
        const realIdx = list.findIndex(m=>m.temp_id===tempId);
        if (realIdx >=0) {
          list[realIdx] = { ...serverMsg };
        } else {
          list.push(serverMsg);
        }
      } else {
        list[idx] = { ...serverMsg };
      }
      this.tempIndex.delete(tempId);
      bus().publish('message.updated', { message: serverMsg, conversationId: loc.conversationId });
      return true;
    }

    removeMessage(convId, id){
      const list = this.ensureList(convId);
      const before = list.length;
      const next = list.filter(m => m.id !== id);
      if (next.length !== before){
        this.messages.set(convId, next);
        bus().publish('message.deleted', { id, conversationId: convId });
        return true;
      }
      return false;
    }

    getMessages(convId){ return this.messages.get(convId) || []; }
    getCurrentMessages(){ return this.getMessages(this.currentConversationId); }

    markMessageRead(convId, id){
      if (!convId || !id) return false;
      const list = this.getMessages(convId);
      const idx = list.findIndex(m => m.id === id);
      if (idx < 0) return false;
      if (list[idx].read_at) return false; // 已读过
      list[idx] = { ...list[idx], read_at: new Date().toISOString() };
      bus().publish('message.read', { conversationId: convId, message: list[idx] });
      return true;
    }

    markConversationRead(convId){
      const list = this.getMessages(convId);
      let changed = 0;
      list.forEach((m,i)=>{
        if (m.sender_type === 'customer' && !m.read_at){
          list[i] = { ...m, read_at: new Date().toISOString() };
          changed++;
          bus().publish('message.read', { conversationId: convId, message: list[i] });
        }
      });
      if (changed) log('debug','markConversationRead', convId, changed);
      return changed;
    }
  }

  window.MessageStateStore = new MessageStateStore();
  log('info', 'MessageStateStore 初始化完成');
})();
