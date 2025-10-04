/**
 * message-render-adapter.js
 * 事件驱动渲染适配器：订阅 MessageEventBus/StateStore 事件，最小化 DOM 更新。
 */
(function(){
  if (window.MessageRenderAdapter) return;
  const NS='messageRender';
  const log=(lvl,...a)=>{ if(window.QT_LOG){ (QT_LOG[lvl]||QT_LOG.debug)(NS,...a);} };

  function renderStatusAdornment(msg){
    if (msg.status==='pending') return ' <span class="msg-status-dot" title="发送中">⏳</span>';
    if (msg.status==='failed') return ' <button class="msg-retry-btn" data-retry="'+(msg.temp_id||'')+'" title="重试">重试</button>';
    return '';
  }
  function escapeHtml(str){ return (str||'').replace(/[&<>\"]/g, s=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s])); }
  function findContainer(){ return document.getElementById('chatMessages'); }

  function createMessageNode(message){
    const div=document.createElement('div');
    const stateClass = message.status==='pending'?'pending':(message.status==='failed'?'failed':'');
    const type = (message.message_type)||'text';
    let typeCls=''; let icon='';
    try {
      if (window.MessageTypeRegistry){
        const def = MessageTypeRegistry.get(type);
        typeCls = def && def.className ? def.className : ('msg-'+type);
        icon = def && def.icon ? def.icon+' ' : '';
      }
    } catch(_){ }
    div.className = 'chat-message '+(message.sender_type||'')+' '+stateClass+' '+typeCls;
    if (message.temp_id) div.dataset.tempId = message.temp_id;
    if (message.id) div.dataset.id = message.id;
    const raw = message.content || '';
    const escaped = escapeHtml(raw);
    // 判断是否需要折叠：长度或行数
    const needCollapse = raw.length > 360 || (raw.match(/\n/g)||[]).length > 6;
    const bubble = document.createElement('div');
    bubble.className = 'bubble'+(needCollapse? ' collapsible need-fade':'');
    bubble.innerHTML = `${icon}${escaped}${renderStatusAdornment(message)}`;
    if (needCollapse){
      const toggle=document.createElement('div');
      toggle.className='bubble-toggle';
      toggle.textContent='展开';
      toggle.addEventListener('click', (e)=>{
        e.stopPropagation();
        const expanded = bubble.classList.toggle('expanded');
        if (expanded){ bubble.classList.remove('need-fade'); toggle.textContent='收起'; }
        else { bubble.classList.add('need-fade'); toggle.textContent='展开'; }
      });
      bubble.appendChild(toggle);
    }
    div.appendChild(bubble);
    return div;
  }

  function replaceOrAppend(message){
    const c=findContainer(); if(!c) return;
    let node=null;
    if (message.temp_id) node = c.querySelector(`.chat-message[data-temp-id="${message.temp_id}"]`);
    if (!node && message.id) node = c.querySelector(`.chat-message[data-id="${message.id}"]`);
    const fresh=createMessageNode(message);
    if (node) c.replaceChild(fresh, node); else c.appendChild(fresh);
  }
  function removeMessage(id){ if(!id) return; const c=findContainer(); if(!c) return; const n=c.querySelector(`.chat-message[data-id="${id}"]`); if(n) c.removeChild(n); }

  let renderCounters={ full:0, appended:0, updated:0, deleted:0 };
  function fullRender(list){ const c=findContainer(); if(!c) return; c.innerHTML=''; list.forEach(m=> c.appendChild(createMessageNode(m))); renderCounters.full++; log('debug','full render',{count:list.length, metrics:renderCounters}); }
  function scrollToBottom(){ if(window.ScrollCoordinator&&typeof window.ScrollCoordinator.scrollToEnd==='function') return window.ScrollCoordinator.scrollToEnd(true); const c=findContainer(); if(c) c.scrollTop=c.scrollHeight; }

  function attachRetryHandler(sender){ const c=findContainer(); if(!c) return; c.addEventListener('click',(e)=>{ const btn=e.target.closest('button.msg-retry-btn'); if(!btn) return; const tid=btn.getAttribute('data-retry'); if(tid && sender && sender.resendFailed){ sender.resendFailed(tid); }}); }

  function init(opts){
    const store=window.MessageStateStore; const bus=window.MessageEventBus; if(!store||!bus){ log('warn','缺少 StateStore 或 EventBus'); return null; }
    const sender=(opts&&opts.sender)||(window.messageModule && window.messageModule._sender);
    attachRetryHandler(sender);
    try { fullRender(store.getCurrentMessages()); } catch(_){ }

    bus.subscribe('conversation.selected', ({conversationId})=>{ fullRender(store.getMessages(conversationId)); scrollToBottom(); });
    // 新增: 批量加载事件（首屏/切换时可用）
    bus.subscribe('messages.bulkLoaded', ({conversationId, messages})=>{
      if (conversationId!==store.currentConversationId) return; 
      fullRender(messages||[]); 
      scrollToBottom(); 
      log('debug','bulkLoaded',{count:(messages||[]).length});
    });
    bus.subscribe('message.appended', ({message,conversationId})=>{ if(conversationId!==store.currentConversationId) return; replaceOrAppend(message); scrollToBottom(); renderCounters.appended++; log('debug','append',{temp:message.temp_id,id:message.id,metrics:renderCounters}); });
    bus.subscribe('message.updated', ({message,conversationId})=>{ if(conversationId!==store.currentConversationId) return; replaceOrAppend(message); renderCounters.updated++; log('debug','update',{temp:message.temp_id,id:message.id,metrics:renderCounters}); });
    bus.subscribe('message.deleted', ({id,conversationId})=>{ if(conversationId!==store.currentConversationId) return; removeMessage(id); renderCounters.deleted++; log('debug','delete',{id,metrics:renderCounters}); });
    bus.subscribe('send.failed', ({tempMessage})=>{ if(!tempMessage||tempMessage.conversation_id!==store.currentConversationId) return; replaceOrAppend(tempMessage); });
    log('info','MessageRenderAdapter 初始化');
    return { fullRender, metrics: ()=> ({...renderCounters}) };
  }

  window.MessageRenderAdapter = { init };
})();
