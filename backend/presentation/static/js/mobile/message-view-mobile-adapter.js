/**
 * mobile/message-view-mobile-adapter.js
 * 移动端消息视图适配器：负责在小屏下对聊天窗口布局、输入区、工具条、未读提示等进行增强。
 * 目标：纯前端增强，不侵入 MessageModule 内部逻辑；可独立移除；幂等；渐进增强。
 */
(function(){
  'use strict';
  if (window.MobileMessageViewAdapter) return; // 幂等

  const LOG_PREFIX = '[MobileMessageViewAdapter]';
  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(_){ } }
  function warn(){ try { console.warn(LOG_PREFIX, ...arguments); } catch(_){ } }

  const state = {
    inited: false,
    observing: false,
    lastConversationId: null,
    unreadFloatingBtn: null,
    inputEnhancerApplied: false,
    stickyAtBottom: true,
    scrollEl: null,
    lastStickCheckTs: 0
  };

  function isMobile(){
    if (window.MobileBootstrap && typeof MobileBootstrap.isMobile==='function'){
      try { return !!MobileBootstrap.isMobile(); } catch(_){ return false; }
    }
    return window.innerWidth <= 820; // fallback 判定
  }

  function init(){
    if (state.inited) return;
    if (!isMobile()){ log('非移动端，不初始化'); return; }
    state.inited = true;
    ensureStyles();
    ensureHooks();
    buildUnreadFloatingButton();
    enhanceInputBar();
    bindGlobalEvents();
    setupScrollHandling();
    log('初始化完成');
  }

  function ensureStyles(){
    if (document.getElementById('mobile-message-view-adapter-styles')) return;
    const style = document.createElement('style');
    style.id = 'mobile-message-view-adapter-styles';
    style.textContent = `
      /* 容器与布局 */
      .mobile-chat-root { display:flex; flex-direction:column; height:100%; max-height:100vh; }
      .mobile-chat-messages-wrap { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:8px 10px 16px; }
      .mobile-chat-input-bar { border-top:1px solid var(--qt-border,#e5e6eb); background:var(--qt-bg,#fff); padding:6px 8px 6px; display:flex; flex-direction:column; gap:4px; }
      .mobile-chat-tools { display:flex; align-items:center; gap:8px; }
      .mobile-chat-tools button { background:#f5f6f7; border:1px solid #d0d3d8; border-radius:8px; padding:6px 10px; font-size:13px; line-height:1; }
      .mobile-chat-text-row { display:flex; align-items:flex-end; gap:6px; }
      .mobile-chat-text-row textarea { flex:1; resize:none; min-height:40px; max-height:120px; padding:8px 10px; border:1px solid #d0d3d8; border-radius:10px; font-size:14px; line-height:1.4; }
      .mobile-chat-send-btn { background:#3478f6; color:#fff; border:none; padding:8px 14px; border-radius:10px; font-size:14px; font-weight:600; }
      .mobile-chat-send-btn:active { opacity:0.85; }
      /* 未读浮窗按钮 */
      .mobile-unread-float { position:absolute; right:10px; bottom:80px; z-index:40; background:#3478f6; color:#fff; padding:6px 10px; border-radius:16px; box-shadow:0 2px 6px rgba(0,0,0,0.15); font-size:12px; cursor:pointer; display:none; }
      .mobile-unread-float.show { display:flex; align-items:center; gap:4px; animation:fadeIn .25s ease; }
      @keyframes fadeIn { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:translateY(0);} }
      /* 消息气泡微调 */
      .chat-message { font-size:14px; line-height:1.45; }
      .chat-message .time { font-size:11px; opacity:.55; }
      /* 暗色模式 */
      @media (prefers-color-scheme:dark){
        .mobile-chat-input-bar { background:#1f1f22; border-color:#2d2f33; }
        .mobile-chat-tools button { background:#2d2f33; border-color:#3a3d42; color:#ccc; }
        .mobile-chat-text-row textarea { background:#2a2b2f; border-color:#3a3d42; color:#ddd; }
        .mobile-chat-send-btn { background:#3d6fdc; }
        .mobile-unread-float { background:#3d6fdc; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureHooks(){
    // 包裹消息列表容器
    const messages = document.getElementById('chatMessages');
    if (!messages){ warn('未找到 #chatMessages, 延迟重试'); setTimeout(ensureHooks, 300); return; }
    if (!messages.parentElement.classList.contains('mobile-chat-messages-wrap')){
      const wrap = document.createElement('div');
      wrap.className = 'mobile-chat-messages-wrap';
      messages.parentElement.insertBefore(wrap, messages);
      wrap.appendChild(messages);
    }
    // 根容器标记
    const chatView = document.getElementById('chatView');
    if (chatView && !chatView.classList.contains('mobile-chat-root')){
      chatView.classList.add('mobile-chat-root');
    }
  }

  function enhanceInputBar(){
    if (state.inputEnhancerApplied) return;
    const input = document.getElementById('chatInput');
    if (!input){ setTimeout(enhanceInputBar, 300); return; }
    // 将 input 转为 textarea (若是 input)
    if (input.tagName === 'INPUT'){
      const ta = document.createElement('textarea');
      ta.id = input.id; ta.placeholder = input.placeholder || '输入消息';
      ta.value = input.value || '';
      input.parentElement.replaceChild(ta, input);
    }
    const taEl = document.getElementById('chatInput');
    const originalContainer = taEl.closest('.chat-input-container') || taEl.parentElement;
    if (!originalContainer){ return; }

    // 构造新布局
    const bar = document.createElement('div');
    bar.className = 'mobile-chat-input-bar';
    const tools = document.createElement('div');
    tools.className = 'mobile-chat-tools';
    tools.innerHTML = `
      <button type="button" data-act="media">媒体</button>
      <button type="button" data-act="emoji">表情</button>
      <button type="button" data-act="more">更多</button>
    `;
    const textRow = document.createElement('div');
    textRow.className = 'mobile-chat-text-row';
    taEl.classList.add('mobile-chat-textarea');
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'mobile-chat-send-btn';
    sendBtn.textContent = '发送';

    textRow.appendChild(taEl);
    textRow.appendChild(sendBtn);
    bar.appendChild(tools);
    bar.appendChild(textRow);
    originalContainer.parentElement.insertBefore(bar, originalContainer);
    originalContainer.style.display = 'none';

    autoGrowTextarea(taEl);

    sendBtn.addEventListener('click', ()=> triggerSend());
    taEl.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        triggerSend();
      }
    });
    tools.addEventListener('click', handleToolClick);

    state.inputEnhancerApplied = true;
  }

  function handleToolClick(e){
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'media') return openMediaPicker();
    if (act === 'emoji') return openEmojiPanel();
    if (act === 'more') return openMoreSheet();
  }

  function openMediaPicker(){
    try { if (window.MediaPicker && MediaPicker.open){ MediaPicker.open(); return; } } catch(_){ }
    warn('未实现媒体选择器 (占位)');
  }
  function openEmojiPanel(){ warn('未实现表情面板 (占位)'); }
  function openMoreSheet(){ warn('未实现更多操作面板 (占位)'); }

  function triggerSend(){
    const ta = document.getElementById('chatInput');
    if (!ta) return;
    const val = ta.value.trim();
    if (!val) return;
    const mm = window.MessageModuleInstance || window.messageModule;
    if (!mm || !mm.sendMessage){ warn('发送入口缺失'); return; }
    mm.sendMessage();
    // sendMessage 内部会清空 input，但此处是 textarea 替换，要手动清空
    ta.value='';
    autoGrowTextarea(ta);
  }

  function autoGrowTextarea(el){
    const resize = ()=>{
      el.style.height = 'auto';
      const h = Math.min(120, el.scrollHeight);
      el.style.height = h + 'px';
    };
    el.addEventListener('input', resize);
    resize();
  }

  function buildUnreadFloatingButton(){
    let btn = document.querySelector('.mobile-unread-float');
    if (!btn){
      btn = document.createElement('div');
      btn.className = 'mobile-unread-float';
      btn.innerHTML = '<span class="label">回到底部</span>';
      document.body.appendChild(btn);
      btn.addEventListener('click', ()=> scrollToBottom(true));
    }
    state.unreadFloatingBtn = btn;
  }

  function setupScrollHandling(){
    const container = document.querySelector('.mobile-chat-messages-wrap');
    if (!container){ setTimeout(setupScrollHandling, 300); return; }
    state.scrollEl = container;
    container.addEventListener('scroll', handleScroll, { passive:true });
    observeNewMessages();
  }

  function handleScroll(){
    if (!state.scrollEl) return;
    const atBottom = isAtBottom();
    state.stickyAtBottom = atBottom;
    if (atBottom){ hideUnreadBtn(); } else { showUnreadBtn(); }
  }

  function isAtBottom(){
    const el = state.scrollEl; if (!el) return true;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 40; // 允许 40px 缓冲
  }

  function scrollToBottom(force){
    const el = state.scrollEl; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: force? 'auto':'smooth' });
    hideUnreadBtn();
  }

  function observeNewMessages(){
    if (state.observing) return;
    const container = document.getElementById('chatMessages');
    if (!container){ setTimeout(observeNewMessages, 400); return; }
    const obs = new MutationObserver(()=>{
      if (state.stickyAtBottom){ scrollToBottom(); }
    });
    obs.observe(container, { childList:true, subtree:false });
    state.observing = true;
  }

  function showUnreadBtn(){ if (state.unreadFloatingBtn) state.unreadFloatingBtn.classList.add('show'); }
  function hideUnreadBtn(){ if (state.unreadFloatingBtn) state.unreadFloatingBtn.classList.remove('show'); }

  function bindGlobalEvents(){
    document.addEventListener('ws:domain.event.message_appended', (e)=>{
      // 如果不是当前会话的消息，交由其他逻辑处理；当前会话且用户滚动离底部 -> 仅显示按钮
      const msg = e.detail && e.detail.message; if (!msg) return;
      const mm = window.MessageModuleInstance || window.messageModule;
      if (!mm) return;
      if (String(msg.conversation_id) !== String(mm.currentConversationId)) return;
      if (!state.stickyAtBottom){ showUnreadBtn(); }
    });
    document.addEventListener('conversation:selected', ()=>{
      // 会话切换自动滚动到底
      setTimeout(()=> scrollToBottom(true), 30);
    });
  }

  // 对外暴露
  window.MobileMessageViewAdapter = { init, scrollToBottom };

  // 自动初始化
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(init, 50);
  } else {
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(init, 50));
  }
  document.addEventListener('mobile:bootstrap:ready', ()=> init());

})();
