(function(){
  'use strict';
  // MessageRenderer v0.1
  // 职责: 仅负责消息列表的 DOM 渲染 (无业务/滚动/状态修改)
  // 依赖: 上层 Orchestrator (context) + MessageStateStore (可选) + ScrollCoordinator (不直接调用)
  // 可缺席: 若未加载, Orchestrator 保持降级逻辑

  function logger(){
    if (window.Logger) return Logger.for('MessageRenderer');
    return ['debug','info','warn','error'].reduce((acc,l)=>{ acc[l]=function(){}; return acc; },{});
  }
  const log = logger();

  const DEFAULT_OPTIONS = {
    containerSelector: '#chatMessages',
    maxMessages: 500,           // 简单上限 (未来可接虚拟滚动)
    bubbleClassMap: {
      agent: 'msg-agent',
      customer: 'msg-customer',
      system: 'msg-system',
      unknown: 'msg-unknown'
    }
  };

  function createRenderer(context, options){
    const opts = Object.assign({}, DEFAULT_OPTIONS, options||{});
    let container = null;

    function ensureContainer(){
      if (!container) container = document.querySelector(opts.containerSelector);
      return container;
    }

    function getMessages(){
      try {
        if (context && context.messages) return context.messages; // Proxy to StateStore
      } catch(_){}
      return [];
    }

    function renderMessages(){
      const list = getMessages();
      const el = ensureContainer();
      if (!el) return;
      el.innerHTML = '';
      for (let i=0;i<list.length;i++){
        renderMessage(list[i], true); // silent append
      }
      log.debug('renderMessages done count=', list.length);
    }

    function renderMessage(message, silent){
      if (!message) return;
      // 只渲染当前会话消息 (若存在会话上下文)
      try {
        if (context.currentConversationId && String(message.conversation_id) !== String(context.currentConversationId)) {
          return; // 忽略其他会话
        }
      } catch(_){}
      const el = ensureContainer();
      if (!el) return;

      // 上限控制 (简单策略: 超出时移除最早节点)
      if (el.children.length >= opts.maxMessages){
        el.removeChild(el.firstChild);
      }

      const bubble = buildMessageBubble(message);
      el.appendChild(bubble);
      if (!silent) log.debug('renderMessage appended id=', message.id || message.temp_id);
      return bubble;
    }

    function buildMessageBubble(msg){
      const div = document.createElement('div');
      const senderType = normalizeSender(msg);
      div.className = 'chat-message ' + (opts.bubbleClassMap[senderType] || opts.bubbleClassMap.unknown);
      if (msg.id) div.setAttribute('data-id', msg.id);
      if (msg.temp_id) div.setAttribute('data-temp-id', msg.temp_id);

      // 发送状态 (后续可添加 retry 按钮)
      if (msg.temp_id && !msg.id){
        div.classList.add('pending');
      }

      // 基本文本 (未来可扩展富文本 / markdown / 超链接识别)
      const content = (msg.content || '').trim();
      div.textContent = content.slice(0, 400);

      // 附件/文件占位 (未来):
      // if (msg.file_url) { ... }

      return div;
    }

    function normalizeSender(msg){
      const s = (msg.sender_type || msg.sender || '').toLowerCase();
      if (s.includes('agent') || s === 'admin') return 'agent';
      if (s.includes('customer') || s === 'user') return 'customer';
      if (s === 'system') return 'system';
      return 'unknown';
    }

    return {
      renderMessages,
      renderMessage,
      buildMessageBubble,
      getMessages
    };
  }

  window.MessageRenderer = {
    init(context, options){
      try {
        const r = createRenderer(context, options);
        log.info('MessageRenderer initialized');
        return r;
      } catch(e){ log.error('MessageRenderer init failed', e); }
      return null;
    }
  };
})();