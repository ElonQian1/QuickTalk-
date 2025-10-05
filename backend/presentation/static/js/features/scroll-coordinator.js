(function(){
  'use strict';
  // ScrollCoordinator - 统一滚动协调器 (初始实现 v0.1)
  // 目标: 统一消息区滚动行为, 提供粘底/未读计数/锚点差值/媒体高度补偿接口
  // 设计原则: 可缺席(不破坏旧逻辑), 幂等 init, 外部只依赖公开 API

  const DEFAULTS = {
    getContainer: ()=> document.getElementById('chatMessages'),
    autoStick: true,
    stickThreshold: 80,          // 离底部 <=该距离 认为用户在底部
    unreadBadgeSelector: '#unreadMessagesBadge',
    newMessagePulseMs: 1600,
    mediaMutationDebounce: 120,  // 媒体高度变化合并节流
  };

  const state = {
    inited: false,
    opts: null,
    container: null,
    userScrolledAway: false,
    unreadCount: 0,
    lastScrollHeight: 0,
    pendingMediaAdjust: null,
    ignoreNextScroll: false,
  };

  function log(){ if (window.Logger) { Logger.for('ScrollCoordinator').debug.apply(null, arguments); } }
  function warn(){ if (window.Logger) { Logger.for('ScrollCoordinator').warn.apply(null, arguments); } }

  function isNearBottom(){
    if (!state.container) return true;
    const { scrollTop, scrollHeight, clientHeight } = state.container;
    return (scrollHeight - (scrollTop + clientHeight)) <= state.opts.stickThreshold;
  }

  function stickToEnd(forceSmooth=false){
    if (!state.container) return;
    try {
      state.ignoreNextScroll = true;
      if (forceSmooth) {
        state.container.scrollTo({ top: state.container.scrollHeight, behavior: 'smooth' });
      } else {
        state.container.scrollTop = state.container.scrollHeight;
      }
      state.userScrolledAway = false;
      resetUnread();
    } catch(e){ warn('stickToEnd error', e); }
  }

  function resetUnread(){
    state.unreadCount = 0;
    updateUnreadBadge();
  }

  function incUnread(){
    state.unreadCount += 1;
    updateUnreadBadge();
  }

  function updateUnreadBadge(){
    try {
      const sel = state.opts.unreadBadgeSelector;
      const badge = typeof sel === 'string'? document.querySelector(sel) : sel();
      if (!badge) return;
      if (state.unreadCount > 0){
        badge.textContent = state.unreadCount > 99 ? '99+' : String(state.unreadCount);
        badge.style.display = 'inline-flex';
        badge.classList.add('pulse-new-message');
        setTimeout(()=> badge.classList.remove('pulse-new-message'), state.opts.newMessagePulseMs);
      } else {
        badge.style.display = 'none';
      }
    } catch(e){ warn('updateUnreadBadge error', e); }
  }

  function handleScroll(){
    if (state.ignoreNextScroll){
      state.ignoreNextScroll = false;
      return;
    }
    if (!state.container) return;
    const nearBottom = isNearBottom();
    if (nearBottom){
      state.userScrolledAway = false;
      resetUnread();
    } else {
      state.userScrolledAway = true;
    }
  }

  function capturePrependAnchor(){
    if (!state.container) return null;
    const before = { scrollHeight: state.container.scrollHeight, scrollTop: state.container.scrollTop };
    return before;
  }

  function restorePrependAnchor(anchor){
    if (!state.container || !anchor) return;
    const delta = state.container.scrollHeight - anchor.scrollHeight;
    if (delta > 0){
      state.container.scrollTop = anchor.scrollTop + delta;
    }
  }

  function notifyNewMessage(){
    if (!state.inited){ return; }
    if (!state.container) state.container = state.opts.getContainer();
    if (!state.container) return;
    if (state.opts.autoStick && !state.userScrolledAway){
      stickToEnd(false);
    } else if (state.userScrolledAway){
      incUnread();
    }
  }

  // 媒体高度补偿: 当图片/视频加载后高度变化引起跳动
  function scheduleMediaAdjustment(){
    if (!state.container) return;
    if (!state.userScrolledAway) return; // 仅在用户上滚浏览历史时保持视窗稳定
    if (state.pendingMediaAdjust) return;
    state.pendingMediaAdjust = setTimeout(()=>{
      try {
        // 以当前 scrollHeight 与上次记录对比, 调整 scrollTop 维持相对位置
        const current = state.container.scrollHeight;
        const delta = current - state.lastScrollHeight;
        if (delta !== 0){
          state.ignoreNextScroll = true;
          state.container.scrollTop += delta;
        }
        state.lastScrollHeight = state.container.scrollHeight;
      } catch(e){ warn('media adjust error', e); }
      finally { state.pendingMediaAdjust = null; }
    }, state.opts.mediaMutationDebounce);
  }

  function observeMedia(){
    try {
      if (!window.MutationObserver || !state.container) return;
      const mo = new MutationObserver((muts)=>{
        let need = false;
        for (const m of muts){
          if (m.type === 'childList'){ need = true; break; }
          if (m.type === 'attributes'){ need = true; break; }
        }
        if (need) scheduleMediaAdjustment();
      });
      mo.observe(state.container, { subtree: true, childList: true, attributes: true });
    } catch(e){ warn('observeMedia error', e); }
  }

  function init(options){
    if (state.inited){ return window.ScrollCoordinator; }
    state.opts = Object.assign({}, DEFAULTS, options||{});
    state.container = state.opts.getContainer();
    if (!state.container){ warn('init: container 不存在, 延迟等待'); }
    state.lastScrollHeight = state.container? state.container.scrollHeight : 0;

    // 绑定滚动事件
    if (state.container){
      state.container.addEventListener('scroll', handleScroll, { passive: true });
    }

    // 初次粘底
    if (state.opts.autoStick) setTimeout(()=> stickToEnd(false), 0);

    observeMedia();

    state.inited = true;
    log('ScrollCoordinator inited');
    return window.ScrollCoordinator;
  }

  // 公共 API
  const api = {
    init,
    notifyNewMessage,
    scrollToEnd: (smooth)=> stickToEnd(!!smooth),
    forceToEnd: ()=> stickToEnd(false),
    capturePrependAnchor,
    restorePrependAnchor,
    isNearBottom,
    getUnread: ()=> state.unreadCount,
    resetUnread,
  };

  window.ScrollCoordinator = api;
})();