/**
 * mobile/mobile-bootstrap.js
 * 移动端骨架恢复阶段1：容器/导航/基础样式/核心增强幂等初始化
 * 设计原则：
 *  - 幂等: 多次 init() 不产生重复节点或事件
 *  - 零侵入: 不删除既有 DOM，只补齐缺失结构
 *  - 降级安全: 缺模块时记录 console.warn，不抛异常
 *  - 最小假设: 不依赖打包器、无构建
 */
(function(){
  'use strict';

  if (window.MobileBootstrap && window.MobileBootstrap.__v) {
    console.log('ℹ️ MobileBootstrap 已存在，跳过重新定义');
    return;
  }

  const VERSION = '1.0.0';
  const state = { inited: false, steps: [], startTs: 0 };

  function log(){ try { console.log('[MobileBootstrap]', ...arguments); } catch(_){} }
  function warn(){ try { console.warn('[MobileBootstrap]', ...arguments); } catch(_){} }

  function isMobile(){
    const w = window.innerWidth || document.documentElement.clientWidth;
    const narrow = w <= 768; // 简单断点
    const ua = navigator.userAgent.toLowerCase();
    const touchUA = /(iphone|android|mobile|ipad|ipod)/.test(ua);
    return narrow || touchUA;
  }

  function ensureMeta(){
    if (document.querySelector('meta[name="viewport"]')) return;
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';
    document.head.appendChild(meta);
    state.steps.push('meta');
  }

  function ensureContainers(){
    const ids = ['shopsListView','conversationsListView','chatView'];
    ids.forEach(id => {
      if (!document.getElementById(id)){
        const div = document.createElement('div');
        div.id = id;
        div.className = 'mobile-section auto-created';
        // 初始隐藏除 shopsListView 外
        if (id !== 'shopsListView') div.style.display='none';
        document.body.appendChild(div);
        state.steps.push('container:'+id);
      }
    });
  }

  function ensureBottomNav(){
    if (document.querySelector('.bottom-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'bottom-nav qt-visible';
    nav.innerHTML = [
      '<div class="nav-item" data-page="shops"><span class="icon">🏪</span><span class="label">店铺</span><span class="nav-badge hidden"></span></div>',
      '<div class="nav-item" data-page="messages"><span class="icon">💬</span><span class="label">消息</span><span class="nav-badge hidden"></span></div>',
      '<div class="nav-item" data-page="profile"><span class="icon">👤</span><span class="label">我的</span><span class="nav-badge hidden"></span></div>'
    ].join('');
    document.body.appendChild(nav);
    state.steps.push('bottom-nav');
    // 绑定切换 (最小实现)
    nav.addEventListener('click', (e)=>{
      const item = e.target.closest('.nav-item'); if (!item) return;
      const page = item.getAttribute('data-page');
      routeBasic(page);
      document.dispatchEvent(new CustomEvent('pageChange',{ detail:{ page } }));
    });
    if (window.BottomNavUI && BottomNavUI.show) BottomNavUI.show();
  }

  function routeBasic(page){
    const m = {
      shops: 'shopsListView',
      messages: 'conversationsListView', // 先到会话页，再进入具体聊天
      profile: 'profileView' // 可能不存在，保持安全
    };
    Object.values(m).forEach(id=>{ if (!id) return; const el = document.getElementById(id); if (el) el.style.display='none'; });
    const target = document.getElementById(m[page]);
    if (target) target.style.display='block';
  }

  function ensureKeyboardSafeArea(){
    if (window.KeyboardSafeArea && typeof window.KeyboardSafeArea.init === 'function') {
      try { window.KeyboardSafeArea.init(); state.steps.push('keyboard-safe'); } catch(e){ warn('KeyboardSafeArea.init 失败', e); }
    }
  }

  function ensureScrollCoordinator(){
    if (window.ScrollCoordinator && typeof window.ScrollCoordinator.init === 'function') {
      try {
        ScrollCoordinator.init({
          getContainer: ()=> document.getElementById('chatMessages'),
          autoStick: true,
          stickThreshold: 60
        });
        state.steps.push('scroll-coordinator');
      } catch(e){ warn('ScrollCoordinator.init 失败', e); }
    }
  }

  function ensureStatusViewClear(){
    if (window.StatusView) {
      ['conversationsListView','chatMessages','shopsListView'].forEach(id=>{
        const el = document.getElementById(id); if (el) { try { StatusView.clear(el); } catch(_){ } }
      });
    }
  }

  function ensureNavBadge(){
    if (!window.NavBadgeManager) return;
    if (!window.__navBadgeManagerInstance) {
      try { window.__navBadgeManagerInstance = window.NavBadgeManager.quickInit({ debug:false }); state.steps.push('nav-badge'); } catch(e){ warn('NavBadgeManager.init 失败', e); }
    }
  }

  function ensureConnectionIndicator(){
    if (window.ConnectionIndicator && typeof window.ConnectionIndicator.init === 'function') {
      try { ConnectionIndicator.init(); state.steps.push('connection-indicator'); } catch(e){ warn('ConnectionIndicator.init 失败', e); }
    }
  }

  function ensureComposerToolbar(){
    if (window.ComposerToolbar && typeof window.ComposerToolbar.init === 'function') {
      try { ComposerToolbar.init(); state.steps.push('composer-toolbar'); } catch(e){ warn('ComposerToolbar.init 失败', e); }
    }
  }

  function ensureQuickReplies(){
    if (window.QuickReplies && typeof window.QuickReplies.init === 'function') {
      try { QuickReplies.init(); state.steps.push('quick-replies'); } catch(e){ warn('QuickReplies.init 失败', e); }
    }
  }

  function ensureTypingIndicator(){
    if (window.ChatTypingIndicator && typeof window.ChatTypingIndicator.ensure === 'function') {
      try { ChatTypingIndicator.ensure(); state.steps.push('typing-indicator'); } catch(e){ warn('TypingIndicator.ensure 失败', e); }
    }
  }

  function ensureFeedback(){
    // Feedback 模块是幂等的, 这里只触发一次 show 测试可见性 (可选)
    if (window.Feedback && typeof window.Feedback.show === 'function') {
      state.steps.push('feedback-ready');
    }
  }

  function ensureLightbox(){
    if (window.ImageLightbox && typeof window.ImageLightbox.init === 'function') {
      try { ImageLightbox.init(); state.steps.push('image-lightbox'); } catch(e){ warn('ImageLightbox.init 失败', e); }
    }
  }

  function init(){
    if (state.inited) { log('已初始化，跳过'); return; }
    state.startTs = Date.now();
    if (!isMobile()) { log('检测为非移动端（或宽屏），跳过移动骨架初始化'); state.inited = true; return; }
    log('开始移动端骨架初始化...');
    try { ensureMeta(); } catch(e){ warn('meta 处理失败', e); }
    try { ensureContainers(); } catch(e){ warn('容器补齐失败', e); }
    try { ensureBottomNav(); } catch(e){ warn('底部导航失败', e); }
    try { ensureKeyboardSafeArea(); } catch(e){ }
    try { ensureScrollCoordinator(); } catch(e){ }
    try { ensureNavBadge(); } catch(e){ }
    try { ensureConnectionIndicator(); } catch(e){ }
    try { ensureComposerToolbar(); } catch(e){ }
    try { ensureQuickReplies(); } catch(e){ }
    try { ensureTypingIndicator(); } catch(e){ }
    try { ensureFeedback(); } catch(e){ }
    try { ensureLightbox(); } catch(e){ }
    try { ensureStatusViewClear(); } catch(e){ }
    state.inited = true;
    const cost = Date.now() - state.startTs;
    log('移动端骨架初始化完成，用时', cost+'ms', 'steps=', state.steps.join(','));
    document.dispatchEvent(new CustomEvent('mobile:bootstrap:ready', { detail:{ version: VERSION, cost, steps: state.steps.slice() } }));
  }

  window.MobileBootstrap = { init, __v: VERSION, steps: state.steps, isMobile };

  // 可选自动初始化条件：页面上声明 data-auto-mobile 或 全局标志
  if (document.documentElement.getAttribute('data-auto-mobile') === 'true' || window.autoInitMobile === true){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }

  console.log('✅ MobileBootstrap 模块已加载 (阶段1)');
})();
