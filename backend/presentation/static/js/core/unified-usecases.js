/*
 * 统一用例聚合模块 (unified-usecases.js)
 * - 提供一个安全的门面，统一访问常用用例功能
 * - 渐进式重构：不重写旧模块，先聚合与标准化调用入口
 * - 幂等且惰性解析，避免重复声明错误
 */
(function(){
  'use strict';

  function safeCall(name, fn, args){
    try { return typeof fn === 'function' ? fn.apply(null, args||[]) : undefined; }
    catch(e){ console.error('Usecase call failed:', name, e); }
  }

  // ========== 内置实现：工作台 ========== //
  async function loadWorkbenchSummaryImpl(){
    const container = document.getElementById('workbenchContent');
    if (!container) return;

    container.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">正在加载工作台数据...</div>
      </div>
    `;

    try {
      const params = new URLSearchParams();
      if (window.currentShopId) params.set('shop_id', window.currentShopId);
      params.set('days', '7');
      
      // 使用统一认证系统
      const headers = window.AuthHelper ? window.AuthHelper.getHeaders() :
        (typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : 
        {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${typeof window.getAuthToken === 'function' ? window.getAuthToken() : ''}`,
            'X-Session-Id': typeof window.getAuthToken === 'function' ? window.getAuthToken() : ''
        });
      
      console.log('🔄 加载工作台数据...', { hasToken: !!headers.Authorization });
      
      const res = await fetch(`/api/workbench/summary?${params.toString()}`, { headers });
      
      if (res.status === 401) {
        console.warn('⚠️ 工作台数据加载：收到401未授权错误');
        // 尝试重新检查登录状态
        if (typeof window.checkLoginStatus === 'function') {
          setTimeout(() => window.checkLoginStatus(), 1000);
        }
        throw new Error('登录已过期，请重新登录');
      }
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('📊 工作台数据加载成功:', data);
      
      if (!data.success) {
        throw new Error(data.error || '加载失败');
      }
      
      renderWorkbenchImpl(data.data);
    } catch(err){
      console.error('❌ 加载工作台失败:', err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">加载失败</div>
          <div class="empty-desc">${err.message || '无法加载工作台数据，请稍后重试'}</div>
          <button onclick="window.UnifiedUsecases?.loadPageData('workbench')" style="margin-top: 12px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">重试</button>
        </div>
      `;
      
      // 如果是认证错误，显示友好提示
      if (err.message.includes('登录') || err.message.includes('401')) {
        if (typeof showToast === 'function') {
          showToast('登录已过期，请重新登录', 'warning');
        }
      }
    }
  }

  function renderWorkbenchImpl(summary){
    const container = document.getElementById('workbenchContent');
    if (!container) return;
    const t = summary.totals || {};
    const byDay = Array.isArray(summary.by_day) ? summary.by_day : [];
    const maxVal = Math.max(1, ...byDay.map(d => Math.max(d.messages || 0, d.conversations_started || 0)));
    const trendHtml = byDay.map(d => {
      const msgPct = Math.round((d.messages || 0) * 100 / maxVal);
      const convPct = Math.round((d.conversations_started || 0) * 100 / maxVal);
      return `
        <div class="trend-row">
          <div class="trend-date">${d.date}</div>
          <div class="trend-bars">
            <div class="bar bar-msg" style="width:${msgPct}%" title="消息: ${d.messages}"></div>
            <div class="bar bar-conv" style="width:${convPct}%" title="新会话: ${d.conversations_started}"></div>
          </div>
          <div class="trend-nums">📨 ${d.messages}｜🗣️ ${d.conversations_started}</div>
        </div>
      `;
    }).join('');
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${t.conversations || 0}</div><div class="stat-label">总会话</div></div>
        <div class="stat-card"><div class="stat-value">${t.active_conversations || 0}</div><div class="stat-label">活跃会话</div></div>
        <div class="stat-card"><div class="stat-value">${t.waiting_customers || 0}</div><div class="stat-label">待回复</div></div>
        <div class="stat-card"><div class="stat-value">${t.overdue_conversations || 0}</div><div class="stat-label">超时未回</div></div>
        <div class="stat-card"><div class="stat-value">${t.messages_today || 0}</div><div class="stat-label">今日消息</div></div>
        <div class="stat-card"><div class="stat-value">${t.messages_7d || 0}</div><div class="stat-label">7日消息</div></div>
      </div>
      <div class="section" style="margin-top: 16px;">
        <h3 class="actions-title">近7天趋势</h3>
        <div class="trend-list">
          ${trendHtml || '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">暂无数据</div><div class="empty-desc">最近7天没有消息或会话</div></div>'}
        </div>
        <div class="hint" style="margin-top:8px;color:#6c757d;font-size:12px;">蓝条=消息，紫条=新会话</div>
      </div>
      <style>
        .trend-list { display:flex; flex-direction:column; gap:8px; }
        .trend-row { display:flex; align-items:center; gap:8px; }
        .trend-date { width: 90px; color:#6c757d; font-size:12px; }
        .trend-bars { flex:1; display:flex; gap:4px; align-items:center; }
        .bar { height:10px; border-radius:4px; background:#e9ecef; }
        .bar-msg { background:#4dabf7; }
        .bar-conv { background:#845ef7; }
        .trend-nums { width: 120px; text-align:right; color:#495057; font-size:12px; }
      </style>
    `;
  }

  function viewAnalyticsImpl(){
    if (typeof window.switchPage === 'function') {
      window.switchPage('workbench');
    }
  }

  // ========== 内置实现：页面导航(部分) ========== //
  function switchPageImpl(pageName){
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => {
      page.classList.remove('active');
      page.style.visibility = 'hidden';
      page.style.zIndex = '-1';
      page.style.display = 'none';
      page.style.pointerEvents = 'none';
    });
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
      targetPage.classList.add('active');
      targetPage.style.visibility = 'visible';
      targetPage.style.zIndex = '10';
      targetPage.style.display = 'block';
      targetPage.style.pointerEvents = 'all';
    }
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const nav = document.querySelector(`[data-page="${pageName}"]`);
    if (nav) nav.classList.add('active');
    window.currentPage = pageName;
    if (typeof window.loadPageData === 'function') window.loadPageData(pageName);
  }

  function initializePageStatesImpl(){
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => {
      page.classList.remove('active');
      page.style.visibility = 'hidden';
      page.style.zIndex = '-1';
      page.style.display = 'none';
      page.style.pointerEvents = 'none';
    });
    const home = document.getElementById('homePage');
    if (home) {
      home.classList.add('active');
      home.style.visibility = 'visible';
      home.style.zIndex = '10';
      home.style.display = 'block';
      home.style.pointerEvents = 'all';
    }
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-page="home"]')?.classList.add('active');
    window.currentPage = 'home';
  }

  // ========== 内置实现：根据页面加载数据 ========== //
  async function loadPageDataImpl(pageName){
    const loadDashboardData = typeof window.loadDashboardData === 'function' ? window.loadDashboardData : null;
    const loadConversations = typeof window.loadConversations === 'function' ? window.loadConversations : null;
    const loadShops = typeof window.loadShops === 'function' ? window.loadShops : null;
    const initializeProfilePage = typeof window.initializeProfilePage === 'function' ? window.initializeProfilePage : null;

    switch (pageName) {
      case 'home':
        if (loadDashboardData) await loadDashboardData();
        break;
      case 'messages':
        if (loadConversations) await loadConversations();
        break;
      case 'shops':
        if (loadShops) await loadShops();
        break;
      case 'workbench':
        await loadWorkbenchSummaryImpl();
        break;
      case 'profile':
        if (initializeProfilePage) initializeProfilePage();
        break;
    }
  }

  // ========== 内置实现：用户配置/资料 ========== //
  function initializeProfilePageImpl(){
    const userData = typeof window.userData !== 'undefined' ? window.userData : null;
    if (!userData) return;
    const adminOnlySettings = document.getElementById('adminOnlySettings');
    if (adminOnlySettings) {
      if (userData.role === 'super_admin' || userData.role === 'administrator') {
        adminOnlySettings.style.display = 'block';
      } else {
        adminOnlySettings.style.display = 'none';
      }
    }
  }

  async function showUserInfoImpl(){
    const getUserData = typeof window.getUserData === 'function' ? window.getUserData : () => ({});
    const getAuthToken = window.AuthHelper ? () => window.AuthHelper.getToken() :
                        (typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '');
    const getAuthHeaders = () => window.AuthHelper ? window.AuthHelper.getHeaders() :
                               { 'Authorization': `Bearer ${getAuthToken()}`, 'X-Session-Id': getAuthToken() };
    const showModal = typeof window.showModal === 'function' ? window.showModal : null;
    const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

    if (!showModal) { showToast('模态框功能未加载', 'error'); return; }

    const u = getUserData() || {};
    let email = '-';
    try {
      const headers = getAuthHeaders();
      let res = await fetch('/api/admin/me', { headers });
      if (res.status === 404) {
        res = await fetch('/api/auth/me', { headers });
      }
      if (res.ok) {
        try {
          const data = await res.json();
          if (data && data.success && data.data) email = data.data.email || '-';
        } catch(_){}
      } else if (u.id) {
        const res2 = await fetch(`/api/users/${u.id}`, { headers });
        if (res2.ok) {
          try { const d2 = await res2.json(); if (d2 && d2.success && d2.data) email = d2.data.email || '-'; } catch(_){}
        }
      }
    } catch(_){}

    const content = `
      <style>
        .user-info-modal { display: flex; flex-direction: column; gap: 12px; }
        .user-info-modal .detail-item { margin: 0; }
        .user-info-modal .detail-item label { display: block; color: #6c757d; font-size: 12px; margin-bottom: 4px; }
        .user-info-modal .detail-item .value { display: block; color: #212529; font-size: 14px; word-break: break-all; }
        .user-info-modal .email-actions { display:flex; gap:8px; align-items:center; }
        .user-info-modal input[type="email"] { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #dee2e6; border-radius: 8px; }
        .user-info-modal .btn { padding: 8px 12px; border-radius: 8px; border: none; background: #0d6efd; color: #fff; }
        .user-info-modal .btn.secondary { background: #6c757d; }
      </style>
      <div class="user-info-modal">
        <div class="detail-item">
          <label>用户名</label>
          <div class="value">${u.username || '-'}</div>
        </div>
        <div class="detail-item">
          <label>邮箱</label>
          <div class="value" id="user-email-value">${email}</div>
          ${(!email || email === '-') ? `
          <div class="email-actions">
            <input type="email" id="email-input" placeholder="填写邮箱用于找回/通知" />
            <button class="btn" id="save-email-btn">保存</button>
          </div>
          ` : ''}
        </div>
        <div class="detail-item">
          <label>用户ID</label>
          <div class="value">${u.id || '-'}</div>
        </div>
      </div>
    `;
    showModal('用户信息', content);

    const saveBtn = document.getElementById('save-email-btn');
    if (saveBtn) {
      saveBtn.onclick = async function(){
        const input = document.getElementById('email-input');
        const v = (input?.value || '').trim();
        if (!v) { showToast('请输入邮箱', 'error'); return; }
        if (!v.includes('@')) { showToast('邮箱格式不正确', 'error'); return; }
        try {
          const token = getAuthToken();
          const res = await fetch('/api/admin/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) },
            body: JSON.stringify({ email: v })
          });
          let data = { success: false };
          try { data = await res.json(); } catch(_){}
          if (data.success) {
            const holder = document.getElementById('user-email-value');
            if (holder) holder.textContent = v;
            showToast('邮箱已保存', 'success');
            if (input && input.parentElement) input.parentElement.style.display = 'none';
          } else {
            showToast(data.message || '保存失败', 'error');
          }
        } catch(e) {
          console.error('保存邮箱失败:', e);
          showToast('网络错误，请稍后重试', 'error');
        }
      };
    }
  }

  async function changePasswordImpl(){
    const getAuthToken = window.AuthHelper ? () => window.AuthHelper.getToken() :
                        (typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '');
    const getAuthHeaders = () => window.AuthHelper ? window.AuthHelper.getHeaders() :
                               { 'Authorization': `Bearer ${getAuthToken()}`, 'X-Session-Id': getAuthToken() };
    const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
    const closeModal = typeof window.closeModal === 'function' ? window.closeModal : () => {};

    const modalId = 'temp-modal-' + Date.now();
    const html = `
      <div id="${modalId}" class="modal" style="display:flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>修改密码</h3>
            <button class="modal-close" onclick="closeModal('${modalId}')">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label style="display:flex;justify-content:space-between;align-items:center;">
                当前密码
                <a href="#" style="font-size:12px;color:#6c757d;"
                   onclick="(function(el){var i=document.getElementById('cp-old'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
              </label>
              <input type="password" id="cp-old" placeholder="输入当前密码" autocomplete="off">
            </div>
            <div class="form-group">
              <label style="display:flex;justify-content:space-between;align-items:center;">
                新密码
                <a href="#" style="font-size:12px;color:#6c757d;"
                   onclick="(function(el){var i=document.getElementById('cp-new'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
              </label>
              <input type="password" id="cp-new" placeholder="至少6位" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label style="display:flex;justify-content:space-between;align-items:center;">
                确认新密码
                <a href="#" style="font-size:12px;color:#6c757d;"
                   onclick="(function(el){var i=document.getElementById('cp-confirm'); if(i){i.type=i.type==='password'?'text':'password'; el.textContent=i.type==='password'?'显示':'隐藏';} return false;})(this)">显示</a>
              </label>
              <input type="password" id="cp-confirm" placeholder="再次输入新密码" autocomplete="new-password">
            </div>
            <div class="form-buttons" style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
              <button onclick="closeModal('${modalId}')">取消</button>
              <button id="cp-submit" class="btn primary">确定</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById(modalId);
    if (overlay && modal) { overlay.style.display = 'flex'; modal.classList.add('show'); document.body.style.overflow = 'hidden'; }
    ['cp-old','cp-new','cp-confirm'].forEach(function(id){ var el = document.getElementById(id); if (el) { el.value=''; el.type='password'; } });
    var first = document.getElementById('cp-old'); if (first) first.focus();

    document.getElementById('cp-submit').onclick = async () => {
      const oldP = (document.getElementById('cp-old').value || '');
      const np = (document.getElementById('cp-new').value || '').trim();
      const cp = (document.getElementById('cp-confirm').value || '').trim();
      if (!oldP || !np || !cp) { showToast('请完整填写', 'error'); return; }
      if (np.length < 6) { showToast('新密码至少6位', 'error'); return; }
      if (np !== cp) { showToast('两次输入的新密码不一致', 'error'); return; }
      try {
        const token = getAuthToken();
        if (token) {
          try {
            const who = await fetch('/api/system/whoami', { headers: { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } });
            if (who.status === 401) {
              showToast('登录已过期，请重新登录', 'error');
              closeModal(modalId);
              ['quicktalk_user','admin_token','qt_admin_user','qt_admin_token'].forEach(k => localStorage.removeItem(k));
              setTimeout(() => { window.location.href = '/mobile/login'; }, 600);
              return;
            }
          } catch(_){}
        }
        let res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) },
          body: JSON.stringify({ old_password: oldP, new_password: np })
        });
        if (res.status === 404) {
          res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}`, 'X-Session-Id': token } : {}) },
            body: JSON.stringify({ old_password: oldP, new_password: np })
          });
        }
        let data = { success: false };
        try { data = await res.json(); } catch(_){}
        if (data.success) {
          showToast('密码已更新，请重新登录', 'success');
          closeModal(modalId);
          localStorage.removeItem('quicktalk_user');
          localStorage.removeItem('qt_admin_user');
          localStorage.removeItem('admin_token');
          setTimeout(() => { window.location.href = '/mobile/login'; }, 800);
        } else {
          const msg = data.message || data.error || (res.ok ? '修改失败' : `修改失败 (${res.status})`);
          showToast(msg, 'error');
        }
      } catch(e){
        console.error('修改密码失败:', e);
        showToast('网络错误，请稍后重试', 'error');
      }
    };
  }

  function notificationSettingsImpl(){
    const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
    const enabled = confirm('是否启用消息通知？\n\n• 新消息提醒\n• 系统通知\n• 邮件通知');
    if (enabled) showToast('消息通知已启用', 'success'); else showToast('消息通知已关闭', 'info');
    localStorage.setItem('notification_enabled', enabled);
  }

  function systemSettingsImpl(){
    const settings = [
      '• 当前版本: QuickTalk v1.0.0',
      '• 服务器状态: 运行中',
      '• 数据库: SQLite',
      '• 架构: 纯Rust + WebSocket',
      '• 端口: 3030'
    ];
    alert('系统信息:\n\n' + settings.join('\n'));
  }

  function aboutAppImpl(){
    const aboutInfo = [
      'QuickTalk 专业客服系统 v1.0.0',
      '',
      '• 纯Rust后端架构',
      '• 实时WebSocket通信',
      '• 移动端优先设计',
      '• 多店铺管理支持',
      '• 完整的权限控制',
      '',
      '© 2025 QuickTalk Team'
    ];
    alert(aboutInfo.join('\n'));
  }

  // ========== 内置实现：超级管理员功能 ========== //
  function getToken(){ 
    return window.AuthHelper ? window.AuthHelper.getToken() :
           (typeof window.getAuthToken === 'function' ? window.getAuthToken() : ''); 
  }
  function getHeaders(){ 
    return window.AuthHelper ? window.AuthHelper.getHeaders() :
           { 'Authorization': `Bearer ${getToken()}`, 'X-Session-Id': getToken() }; 
  }
  function toast(msg, type){ return (typeof window.showToast === 'function') ? window.showToast(msg, type) : alert(msg); }

  function showAdminPanelImpl(){
    const userData = typeof window.userData !== 'undefined' ? window.userData : null;
    if (!userData || (userData.role !== 'super_admin' && userData.role !== 'administrator')) {
      toast('只有超级管理员才能访问此功能', 'warning');
      return;
    }
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    if (typeof window.showAdminTab === 'function') {
      window.showAdminTab('overview');
    }
    loadSystemStatsImpl();
    loadShopOwnersStatsImpl('');
  }

  async function loadSystemStatsImpl(){
    try {
      const authToken = getToken();
      const res = await fetch('/api/admin/system-stats', { headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {} });
      if (!res.ok) { toast('加载系统统计失败', 'error'); return; }
      const data = await res.json();
      const stats = data.stats || {};
      const totalUsersEl = document.getElementById('totalUsers');
      const totalShopsEl = document.getElementById('totalShops');
      const shopOwnersEl = document.getElementById('shopOwners');
      const employeesEl = document.getElementById('employees');
      if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
      if (totalShopsEl) totalShopsEl.textContent = stats.totalShops || 0;
      if (shopOwnersEl) shopOwnersEl.textContent = (stats.usersByRole && stats.usersByRole.shop_owner) || 0;
      if (employeesEl) employeesEl.textContent = (stats.usersByRole && stats.usersByRole.employee) || 0;
    } catch(e){ console.error('加载系统统计错误:', e); toast('网络错误，请稍后重试', 'error'); }
  }

  async function loadShopOwnersStatsImpl(keyword){
    try {
      const authToken = getToken();
      const url = keyword ? `/api/admin/shop-owners-stats?keyword=${encodeURIComponent(keyword)}` : '/api/admin/shop-owners-stats';
      const res = await fetch(url, { headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {} });
      if (!res.ok) {
        const container = document.getElementById('ownersList');
        if (container) container.innerHTML = '<div class="error-message">加载店主数据失败</div>';
        return;
      }
      const data = await res.json();
      renderOwnersListImpl(data.stats || []);
    } catch(e){
      console.error('加载店主统计错误:', e);
      const container = document.getElementById('ownersList');
      if (container) container.innerHTML = '<div class="error-message">加载店主数据错误</div>';
    }
  }

  function renderOwnersListImpl(owners){
    const container = document.getElementById('ownersList');
    if (!container) return;
    if (!Array.isArray(owners) || owners.length === 0) {
      container.innerHTML = '<div class="empty-state">没有找到店主数据</div>';
      return;
    }
    container.innerHTML = owners.map(owner => `
      <div class="owner-item">
        <div class="owner-header">
          <div class="owner-info">
            <h6>${owner.user.username}</h6>
            <p>📧 ${owner.user.email || '-'}</p>
            <p>🏪 管理 ${owner.shopsCount} 个店铺 | 👥 总员工 ${owner.totalMembers} 人</p>
            <p>🕒 注册时间: ${owner.user.createdAt ? new Date(owner.user.createdAt).toLocaleDateString() : '-'}</p>
            ${owner.user.lastLoginAt ? `<p>🔐 最后登录: ${new Date(owner.user.lastLoginAt).toLocaleDateString()}</p>` : ''}
          </div>
          <div class="owner-actions">
            <button class="btn btn-primary btn-small" onclick="viewOwnerDetails('${owner.user.id}')">📊 详情</button>
            <button class="btn ${owner.user.status === 'suspended' ? 'btn-success' : 'btn-secondary'} btn-small"
              onclick="toggleOwnerStatus('${owner.user.id}', '${owner.user.status === 'suspended' ? 'active' : 'suspended'}')">
              ${owner.user.status === 'suspended' ? '✅ 启用' : '⏸️ 禁用'}
            </button>
          </div>
        </div>
        ${owner.shops && owner.shops.length > 0 ? `
          <div class="owner-shops">
            <h6>管理的店铺:</h6>
            <div class="shops-list">
              ${owner.shops.map(shop => `
                <span class="shop-tag">
                  ${shop.name}
                  <span class="shop-status status-${shop.status}">${shop.status}</span>
                  (${shop.memberCount}人)
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  function searchShopOwnersImpl(){
    const input = document.getElementById('ownerSearch');
    const keyword = input ? (input.value || '').trim() : '';
    return loadShopOwnersStatsImpl(keyword);
  }

  async function viewOwnerDetailsImpl(ownerId){
    try {
      const authToken = getToken();
      const res = await fetch(`/api/admin/shop-owner/${ownerId}`, { headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {} });
      if (!res.ok) { toast('获取店主详情失败', 'error'); return; }
      const data = await res.json();
      showOwnerDetailsModalImpl(data);
    } catch(e){ console.error('获取店主详情错误:', e); toast('获取店主详情错误', 'error'); }
  }

  function showOwnerDetailsModalImpl(data){
    toast(`店主详情 - ${data.owner && data.owner.username || ''}\n邮箱: ${(data.owner && data.owner.email) || '-'}\n店铺数: ${data.shopsCount || 0}`, 'info');
  }

  async function toggleOwnerStatusImpl(ownerId, newStatus){
    const action = newStatus === 'active' ? '启用' : '禁用';
    if (!confirm(`确定要${action}该店主账号吗？这将同时影响其管理的所有店铺。`)) return;
    try {
      const authToken = getToken();
      const res = await fetch(`/api/admin/shop-owner/${ownerId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {}) },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) { const err = await res.json().catch(()=>({error:'失败'})); toast(`操作失败: ${err.error || res.status}`, 'error'); return; }
      const data = await res.json().catch(()=>({message:'已更新'}));
      toast(data.message || '状态已更新', 'success');
      loadShopOwnersStatsImpl('');
    } catch(e){ console.error('切换店主状态错误:', e); toast('操作失败，请重试', 'error'); }
  }

  async function loadAllShopsMonitorImpl(){
    try {
      const authToken = getToken();
      const res = await fetch('/api/admin/shops', { headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {} });
      if (!res.ok) { const c = document.getElementById('shopsMonitor'); if (c) c.innerHTML = '<div class="error-message">加载店铺数据失败</div>'; return; }
      const data = await res.json();
      renderShopsMonitorImpl(data.shops || []);
    } catch(e){ const c = document.getElementById('shopsMonitor'); if (c) c.innerHTML = '<div class="error-message">加载店铺数据错误</div>'; }
  }

  function renderShopsMonitorImpl(shops){
    const container = document.getElementById('shopsMonitor');
    if (!container) return;
    if (!Array.isArray(shops) || shops.length === 0) { container.innerHTML = '<div class="empty-state">暂无店铺数据</div>'; return; }
    container.innerHTML = shops.map(shop => `
      <div class="shop-monitor-item">
        <div class="shop-monitor-info">
          <h6>${shop.name}</h6>
          <p>🌐 ${shop.domain || '-'}</p>
          <p>👤 店主ID: ${shop.ownerId || '-'}</p>
          <p>🕒 创建时间: ${shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : '-'}</p>
        </div>
        <div class="shop-monitor-actions">
          <span class="shop-status status-${shop.status}">${shop.status}</span>
        </div>
      </div>
    `).join('');
  }

  async function loadPendingShopsImpl(){
    try {
      const authToken = getToken();
      const res = await fetch('/api/admin/pending-shops', { headers: authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {} });
      if (!res.ok) { const c = document.getElementById('pendingShopsContainer'); if (c) c.innerHTML = '<div class="error-message">加载待审核店铺失败</div>'; return; }
      const data = await res.json();
      renderPendingShopsImpl(data.shops || []);
    } catch(e){ const c = document.getElementById('pendingShopsContainer'); if (c) c.innerHTML = '<div class="error-message">加载待审核店铺错误</div>'; }
  }

  function renderPendingShopsImpl(shops){
    const container = document.getElementById('pendingShopsContainer');
    if (!container) return;
    if (!Array.isArray(shops) || shops.length === 0) {
      container.innerHTML = `
        <div class="empty-pending">
          <i>📋</i>
          <h4>暂无待审核店铺</h4>
          <p>所有店铺申请都已处理完毕</p>
        </div>`; return;
    }
    container.innerHTML = shops.map(shop => `
      <div class="pending-shop-item">
        <div class="pending-shop-header">
          <div class="pending-shop-info">
            <h5>${shop.name}</h5>
            <div class="domain">🌐 ${shop.domain || '-'}</div>
            <div class="description">${shop.description || '暂无描述'}</div>
          </div>
        </div>
        <div class="pending-shop-meta">
          <span>👤 店主ID: ${shop.ownerId || '-'}</span>
          <span>🕒 创建时间: ${shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : '-'}</span>
        </div>
        <div class="pending-shop-actions">
          <button class="review-btn review-approve" onclick="reviewApprove('${shop.id}')">✅ 通过</button>
          <button class="review-btn review-reject" onclick="reviewReject('${shop.id}')">❌ 拒绝</button>
        </div>
      </div>
    `).join('');
  }

  async function reviewApproveImpl(shopId){
    if (!confirm('确定要通过这个店铺的审核吗？')) return;
    try {
      const authToken = getToken();
      const res = await fetch(`/api/shops/${shopId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {}) },
        body: JSON.stringify({ note: '审核通过，欢迎使用我们的客服系统！' })
      });
      if (!res.ok) { const e = await res.json().catch(()=>({error:'失败'})); toast(`审核失败: ${e.error || res.status}`, 'error'); return; }
      toast('店铺审核通过！', 'success');
      loadPendingShopsImpl();
    } catch(e){ console.error('审核店铺错误:', e); toast('网络错误，请稍后重试', 'error'); }
  }

  async function reviewRejectImpl(shopId){
    const reason = prompt('请输入拒绝原因：'); if (!reason) return;
    try {
      const authToken = getToken();
      const res = await fetch(`/api/shops/${shopId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}`, 'X-Session-Id': authToken } : {}) },
        body: JSON.stringify({ note: reason })
      });
      if (!res.ok) { const e = await res.json().catch(()=>({error:'失败'})); toast(`拒绝失败: ${e.error || res.status}`, 'error'); return; }
      toast('店铺申请已拒绝', 'success');
      loadPendingShopsImpl();
    } catch(e){ console.error('拒绝店铺错误:', e); toast('网络错误，请稍后重试', 'error'); }
  }

  function refreshPendingShopsImpl(){ loadPendingShopsImpl(); toast('列表已刷新', 'success'); }

  const Usecases = {
    // 工作台/报表（直接内置，避免与代理递归）
    viewAnalytics: () => viewAnalyticsImpl(),
    loadWorkbenchSummary: () => loadWorkbenchSummaryImpl(),
    renderWorkbench: (s) => renderWorkbenchImpl(s),

    // 用户配置（内置）
    showUserInfo: () => showUserInfoImpl(),
    changePassword: () => changePasswordImpl(),
    notificationSettings: () => notificationSettingsImpl(),
    systemSettings: () => systemSettingsImpl(),
    aboutApp: () => aboutAppImpl(),
    initializeProfilePage: () => initializeProfilePageImpl(),

    // 超级管理员（暂保持透传到旧实现，后续再迁移）
  showAdminPanel: () => showAdminPanelImpl(),
  loadSystemStats: () => loadSystemStatsImpl(),
  loadShopOwnersStats: (k) => loadShopOwnersStatsImpl(k),
  renderOwnersList: (o) => renderOwnersListImpl(o),
  searchShopOwners: () => searchShopOwnersImpl(),
  viewOwnerDetails: (id) => viewOwnerDetailsImpl(id),
  showOwnerDetailsModal: (d) => showOwnerDetailsModalImpl(d),
  toggleOwnerStatus: (id, st) => toggleOwnerStatusImpl(id, st),
  loadAllShopsMonitor: () => loadAllShopsMonitorImpl(),
  renderShopsMonitor: (s) => renderShopsMonitorImpl(s),
  loadPendingShops: () => loadPendingShopsImpl(),
  renderPendingShops: (s) => renderPendingShopsImpl(s),
  reviewApprove: (id) => reviewApproveImpl(id),
  reviewReject: (id) => reviewRejectImpl(id),
  refreshPendingShops: () => refreshPendingShopsImpl(),

    // 页面导航（内置，避免递归）
    switchPage: (p) => switchPageImpl(p),
    loadPageData: (p) => loadPageDataImpl(p),
    initializePageStates: () => initializePageStatesImpl(),
  };

  // 对外暴露统一入口
  window.UnifiedUsecases = Usecases;

  // 模块系统注册（可选）
  if (window.ModuleRegistry) {
    window.ModuleRegistry.register('UnifiedUsecases', function(){ return Usecases; }, []);
  }
  if (window.ModuleLoader && window.ModuleLoader.defineClass) {
    window.ModuleLoader.defineClass('UnifiedUsecases', function(){ return Usecases; });
  }

  console.log('✅ 统一用例聚合模块已加载 (unified-usecases.js)');
})();