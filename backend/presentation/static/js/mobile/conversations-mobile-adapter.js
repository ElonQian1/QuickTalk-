/**
 * mobile/conversations-mobile-adapter.js
 * 移动端阶段：会话列表适配器 (首版)
 * 职责：加载并渲染当前选中店铺的会话列表，支持空态/错误态/刷新/未读动态更新
 * 设计原则：
 *  - 幂等：init 多次调用不重复绑定或创建结构
 *  - 复用：优先使用 messageModule.conversationsManager 与已有数据，回退到 API fetch
 *  - 低耦合：不直接写入业务状态，仅调用官方入口 (selectConversation)
 *  - 防御：缺失依赖时降级为提示，不抛异常
 *  - 轻量：控制 < 250 行，核心函数粒度清晰
 */
(function(){
  'use strict';
  if (window.MobileConversationsAdapter) return; // 幂等

  const LOG_PREFIX = '[MobileConversationsAdapter]';
  function log(){ try { console.log(LOG_PREFIX, ...arguments); } catch(_){} }
  function warn(){ try { console.warn(LOG_PREFIX, ...arguments); } catch(_){} }

  const STATE = {
    inited: false,
    lastLoadTs: 0,
    conversations: [],
    lastShopId: null,
    inlineWarnedNoShop: false
  };

  const LIST_HOST_ID = 'conv-mobile-list-host';

  function isMobile(){
    if (!window.MobileBootstrap || !MobileBootstrap.isMobile) return false;
    try { return MobileBootstrap.isMobile(); } catch(_) { return false; }
  }

  /**
   * 初始化入口
   */
  function init(){
    if (STATE.inited){ return; }
    if (!isMobile()){ log('非移动端，跳过会话适配器'); return; }
    STATE.inited = true;
    ensureContainer();
    bindGlobalEvents();
    // 若当前 tab 已是 messages 直接加载
    if (currentPageIsMessages()){ safeLoad(); }
  }

  function currentPageIsMessages(){
    const navActive = document.querySelector('.bottom-nav .nav-item.active');
    if (navActive && navActive.getAttribute('data-page') === 'messages') return true;
    // 或者直接判断显示状态
    const v = document.getElementById('conversationsListView');
    return !!(v && v.style.display !== 'none');
  }

  /**
   * 外部可触发强制刷新
   */
  async function reload(){ await safeLoad(true); }

  async function safeLoad(force){
    const mm = window.messageModule;
    const shopId = mm ? mm.currentShopId : null;
    if (!shopId){
      showNoShopSelected();
      return;
    }
    const now = Date.now();
    if (!force && shopId === STATE.lastShopId && (now - STATE.lastLoadTs) < 5000){
      log('跳过刷新: 5s 内重复 & shop 未变化');
      return;
    }
    STATE.lastShopId = shopId;
    STATE.lastLoadTs = now;
    await loadAndRender(shopId, force);
  }

  async function loadAndRender(shopId, force){
    const host = ensureListHost();
    clearStatus(host);
    showLoading(host, '加载会话...');
    let conversations = [];
    try {
      conversations = await resolveDataSource(shopId, force);
    } catch(err){
      warn('加载失败', err);
      showError(host, '会话加载失败', ()=> safeLoad(true));
      return;
    }
    STATE.conversations = Array.isArray(conversations) ? conversations.slice() : [];
    if (STATE.conversations.length === 0){
      showEmpty(host, '暂无会话');
      return;
    }
    renderList(host, STATE.conversations);
  }

  async function resolveDataSource(shopId, force){
    const mm = window.messageModule;
    // 1) 优先使用 conversationsManager
    if (mm && mm.conversationsManager){
      if (force || !mm.conversations || mm.conversations.length === 0 || mm.currentShopId !== STATE.lastShopId){
        try { await mm.conversationsManager.loadConversationsForShop(shopId); } catch(e){ warn('manager 加载失败', e); }
      }
      return (mm.conversations || []).slice();
    }
    // 2) 有 messageModule 但无 manager -> 走兼容方法
    if (mm && typeof mm.loadConversationsForShop === 'function'){
      try { await mm.loadConversationsForShop(shopId); } catch(e){ warn('兼容加载失败', e); }
      return (mm.conversations || []).slice();
    }
    // 3) Fallback fetch
    const fetcher = (window.AuthFetch && window.AuthFetch.safeJsonFetch) ?
      (url)=> AuthFetch.safeJsonFetch(url).then(r=> r.ok ? r.data : []) :
      (url)=> fetch(url).then(r=> r.json()).then(j=> Array.isArray(j)? j : (j.data||[]));
    try {
      const arr = await fetcher(`/api/conversations?shop_id=${shopId}`);
      return arr;
    } catch(err){ warn('fallback fetch 失败', err); return []; }
  }

  function ensureContainer(){
    let view = document.getElementById('conversationsListView');
    if (!view){
      view = document.createElement('div');
      view.id = 'conversationsListView';
      view.className = 'mobile-section auto-created';
      document.body.appendChild(view);
    }
    ensureHeader(view);
    ensureListHost();
  }

  function ensureHeader(container){
    if (container.querySelector('.conv-mobile-header')) return;
    const header = document.createElement('div');
    header.className = 'conv-mobile-header';
    header.innerHTML = `
      <div class="left"><h2 class="title">会话</h2></div>
      <div class="right">
        <button type="button" class="btn-refresh">刷新</button>
      </div>`;
    container.prepend(header);
    header.querySelector('.btn-refresh').addEventListener('click', ()=> safeLoad(true));
  }

  function ensureListHost(){
    const container = document.getElementById('conversationsListView');
    let host = container.querySelector('#'+LIST_HOST_ID);
    if (!host){
      host = document.createElement('div');
      host.id = LIST_HOST_ID;
      host.className = 'conv-mobile-list';
      container.appendChild(host);
    }
    return host;
  }

  function renderList(host, list){
    host.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(conv => frag.appendChild(buildItem(conv)) );
    host.appendChild(frag);
  }

  function buildItem(conv){
    const item = document.createElement('div');
    item.className = 'conv-item';
    item.setAttribute('data-conv-id', conv.id);
    const customerName = conv.customer_name || generateCustomerName(conv.customer_id);
    const preview = formatPreview(conv.last_message_content || conv.last_message_preview || conv.last_message || '');
    const unread = conv.unread_count || 0;
    const timeStr = shortTime(conv.updated_at || conv.last_message_at || conv.created_at);
    item.innerHTML = [
      '<div class="line1">',
        '<span class="customer">'+escapeHtml(customerName)+'</span>',
        '<span class="time">'+escapeHtml(timeStr)+'</span>',
      '</div>',
      '<div class="line2">',
        '<span class="preview">'+escapeHtml(preview)+'</span>',
        '<span class="unread-badge '+(unread>0?'':'hidden')+'">'+unread+'</span>',
      '</div>'
    ].join('');
    item.addEventListener('click', ()=> enterConversation(conv));
    return item;
  }

  function generateCustomerName(id){
    try { if (window.CustomerNumbering && CustomerNumbering.generateCustomerNumber){ return CustomerNumbering.generateCustomerNumber(id); } } catch(_){ }
    return '客户'+ String(id||'').slice(-4);
  }

  function shortTime(ts){
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const h = d.getHours().toString().padStart(2,'0');
      const m = d.getMinutes().toString().padStart(2,'0');
      return h+':'+m;
    } catch(_){ return ''; }
  }

  function formatPreview(content){
    if (!content) return '';
    const c = String(content).replace(/\s+/g,' ').trim();
    if (c.length <= 30) return c;
    return c.slice(0,30)+'…';
  }

  function enterConversation(conv){
    const mm = window.messageModule;
    if (!mm){ warn('messageModule 不存在，无法进入会话'); return; }
    try { mm.selectConversation(conv); } catch(e){ warn('selectConversation 异常', e); }
  }

  // 事件绑定：页面切换 & 领域事件
  function bindGlobalEvents(){
    document.addEventListener('pageChange', (e)=>{
      if (e.detail && e.detail.page === 'messages'){
        safeLoad();
      }
    });
    // 未读动态更新：监听领域事件广播
    document.addEventListener('ws:domain.event.message_appended', (e)=>{
      try { handleDomainMessageAppended(e.detail && e.detail.message); } catch(err){ warn('未读更新失败', err); }
    });
  }

  function handleDomainMessageAppended(message){
    if (!message || !message.conversation_id) return;
    const mm = window.messageModule;
    // 当前就在该会话 -> 不增加未读
    if (mm && String(mm.currentConversationId) === String(message.conversation_id)) return;
    // 在 STATE 中自增
    const conv = STATE.conversations.find(c => String(c.id) === String(message.conversation_id));
    if (!conv){ return; }
    conv.unread_count = (conv.unread_count||0) + 1;
    // 局部 DOM 更新
    const host = ensureListHost();
    const node = host.querySelector('.conv-item[data-conv-id="'+CSS.escape(String(conv.id))+'"] .unread-badge');
    if (node){
      node.textContent = conv.unread_count;
      node.classList.remove('hidden');
    }
  }

  // 状态/视图辅助
  function clearStatus(host){ if (window.StatusView){ try { StatusView.clear(host); } catch(_){ } } }
  function showLoading(host,msg){ if (window.StatusView){ try { StatusView.loading(host,msg); return; } catch(_){ } } host.innerHTML = '<div class="loading">'+escapeHtml(msg)+'</div>'; }
  function showEmpty(host,msg){ if (window.StatusView){ try { StatusView.empty(host,msg); return; } catch(_){ } } host.innerHTML = '<div class="empty">'+escapeHtml(msg)+'</div>'; }
  function showError(host,msg,retry){ if (window.StatusView){ try { StatusView.error(host,msg,{ retry }); return; } catch(_){ } } host.innerHTML = '<div class="error">'+escapeHtml(msg)+' <button type="button" class="retry-btn">重试</button></div>'; const b=host.querySelector('.retry-btn'); if(b) b.addEventListener('click', retry); }
  function showNoShopSelected(){
    const host = ensureListHost();
    clearStatus(host);
    showEmpty(host, '请选择一个店铺以查看会话');
  }

  // 工具
  function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[s]||s)); }

  // 暴露
  window.MobileConversationsAdapter = { init, reload };

  // 启动时机：等待 mobile bootstrap；兜底 DOMContentLoaded
  document.addEventListener('mobile:bootstrap:ready', ()=> init());
  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(init, 50);
  } else {
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(init, 50));
  }

  // 可选内联样式（极小补丁）
  injectStyles();
  function injectStyles(){
    if (document.getElementById('conv-mobile-adapter-styles')) return;
    const style = document.createElement('style');
    style.id = 'conv-mobile-adapter-styles';
    style.textContent = `
      .conv-mobile-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e5e6eb;}
      .conv-mobile-header .title{margin:0;font-size:16px;font-weight:600;}
      .conv-mobile-header .btn-refresh{background:#f5f6f7;border:1px solid #d0d3d8;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;}
      .conv-mobile-list{display:flex;flex-direction:column;}
      .conv-item{padding:10px 14px;border-bottom:1px solid #f0f1f3;display:flex;flex-direction:column;gap:2px;cursor:pointer;}
      .conv-item:active{background:#f5f7f9;}
      .conv-item .line1{display:flex;justify-content:space-between;align-items:center;font-size:14px;}
      .conv-item .customer{font-weight:600;color:#222;}
      .conv-item .time{font-size:12px;color:#888;}
      .conv-item .line2{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#555;}
      .conv-item .preview{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .conv-item .unread-badge{background:#ff4d4f;color:#fff;border-radius:12px;padding:0 6px;font-size:11px;line-height:18px;min-width:18px;text-align:center;margin-left:8px;}
      .conv-item .unread-badge.hidden{display:none;}
      @media (prefers-color-scheme:dark){
        .conv-mobile-header{border-color:#2c2d30;}
        .conv-item{border-color:#2c2d30;}
        .conv-item .customer{color:#ddd;}
        .conv-item .preview{color:#aaa;}
        .conv-item .time{color:#666;}
        .conv-mobile-header .btn-refresh{background:#2d2f34;border-color:#3a3d42;color:#ccc;}
      }
    `;
    document.head.appendChild(style);
  }

  log('模块定义完成');
})();
