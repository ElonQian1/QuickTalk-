/**
 * 超级管理员功能模块
 * 提供店主管理、店铺监控、审核管理等高级功能
 * 仅限 super_admin 和 administrator 角色访问
 */
(function() {
    'use strict';

    // ============ 管理面板入口 ============

    // 显示超级管理员面板
    window.showAdminPanel = function() {
        const userData = typeof window.userData !== 'undefined' ? window.userData : null;
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        if (!userData || (userData.role !== 'super_admin' && userData.role !== 'administrator')) {
            showToast('只有超级管理员才能访问此功能', 'warning');
            return;
        }
        
        const modal = document.getElementById('adminPanelModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
        
        // 默认显示系统概览
        if (typeof window.showAdminTab === 'function') {
            window.showAdminTab('overview');
        }
        
        // 加载初始数据
        window.loadSystemStats();
        window.loadShopOwnersStats();
    };

    // ============ 系统统计 ============

    // 加载系统统计数据
    window.loadSystemStats = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        try {
            const authToken = getAuthToken();
            const response = await fetch('/api/admin/system-stats', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                const stats = data.stats;
                
                const totalUsersEl = document.getElementById('totalUsers');
                const totalShopsEl = document.getElementById('totalShops');
                const shopOwnersEl = document.getElementById('shopOwners');
                const employeesEl = document.getElementById('employees');

                if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
                if (totalShopsEl) totalShopsEl.textContent = stats.totalShops || 0;
                if (shopOwnersEl) shopOwnersEl.textContent = stats.usersByRole?.shop_owner || 0;
                if (employeesEl) employeesEl.textContent = stats.usersByRole?.employee || 0;
            } else {
                console.error('加载系统统计失败');
                showToast('加载系统统计失败', 'error');
            }
        } catch (error) {
            console.error('加载系统统计错误:', error);
            showToast('网络错误，请稍后重试', 'error');
        }
    };

    // ============ 店主管理 ============

    // 加载店主统计数据
    window.loadShopOwnersStats = async function(keyword = '') {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';

        try {
            const authToken = getAuthToken();
            const url = keyword ? 
                `/api/admin/shop-owners-stats?keyword=${encodeURIComponent(keyword)}` : 
                '/api/admin/shop-owners-stats';

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                window.renderOwnersList(data.stats);
            } else {
                const container = document.getElementById('ownersList');
                if (container) {
                    container.innerHTML = '<div class="error-message">加载店主数据失败</div>';
                }
            }
        } catch (error) {
            console.error('加载店主统计错误:', error);
            const container = document.getElementById('ownersList');
            if (container) {
                container.innerHTML = '<div class="error-message">加载店主数据错误</div>';
            }
        }
    };

    // 渲染店主列表
    window.renderOwnersList = function(owners) {
        const container = document.getElementById('ownersList');
        if (!container) return;
        
        if (owners.length === 0) {
            container.innerHTML = '<div class="empty-state">没有找到店主数据</div>';
            return;
        }
        
        container.innerHTML = owners.map(owner => `
            <div class="owner-item">
                <div class="owner-header">
                    <div class="owner-info">
                        <h6>${owner.user.username}</h6>
                        <p>📧 ${owner.user.email}</p>
                        <p>🏪 管理 ${owner.shopsCount} 个店铺 | 👥 总员工 ${owner.totalMembers} 人</p>
                        <p>🕒 注册时间: ${new Date(owner.user.createdAt).toLocaleDateString()}</p>
                        ${owner.user.lastLoginAt ? `<p>🔐 最后登录: ${new Date(owner.user.lastLoginAt).toLocaleDateString()}</p>` : ''}
                    </div>
                    <div class="owner-actions">
                        <button class="btn btn-primary btn-small" onclick="viewOwnerDetails('${owner.user.id}')">
                            📊 详情
                        </button>
                        <button class="btn ${owner.user.status === 'suspended' ? 'btn-success' : 'btn-secondary'} btn-small" 
                                onclick="toggleOwnerStatus('${owner.user.id}', '${owner.user.status === 'suspended' ? 'active' : 'suspended'}')">
                            ${owner.user.status === 'suspended' ? '✅ 启用' : '⏸️ 禁用'}
                        </button>
                    </div>
                </div>
                ${owner.shops.length > 0 ? `
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
    };

    // 搜索店主
    window.searchShopOwners = function() {
        const input = document.getElementById('ownerSearch');
        const keyword = input ? input.value.trim() : '';
        window.loadShopOwnersStats(keyword);
    };

    // 查看店主详情
    window.viewOwnerDetails = async function(ownerId) {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        try {
            const authToken = getAuthToken();
            const response = await fetch(`/api/admin/shop-owner/${ownerId}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                window.showOwnerDetailsModal(data);
            } else {
                showToast('获取店主详情失败', 'error');
            }
        } catch (error) {
            console.error('获取店主详情错误:', error);
            showToast('获取店主详情错误', 'error');
        }
    };

    // 显示店主详情模态框
    window.showOwnerDetailsModal = function(data) {
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        // 创建临时模态框显示详情
        showToast(`店主详情 - ${data.owner.username}\\n邮箱: ${data.owner.email}\\n店铺数: ${data.shopsCount}`, 'info');
    };

    // 切换店主状态
    window.toggleOwnerStatus = async function(ownerId, newStatus) {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        const action = newStatus === 'active' ? '启用' : '禁用';
        
        if (!confirm(`确定要${action}该店主账号吗？这将同时影响其管理的所有店铺。`)) {
            return;
        }

        try {
            const authToken = getAuthToken();
            const response = await fetch(`/api/admin/shop-owner/${ownerId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                const data = await response.json();
                showToast(data.message, 'success');
                window.loadShopOwnersStats(); // 刷新列表
            } else {
                const error = await response.json();
                showToast(`操作失败: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('切换店主状态错误:', error);
            showToast('操作失败，请重试', 'error');
        }
    };

    // ============ 店铺监控 ============

    // 加载所有店铺监控
    window.loadAllShopsMonitor = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';

        try {
            const authToken = getAuthToken();
            const response = await fetch('/api/admin/shops', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                window.renderShopsMonitor(data.shops);
            } else {
                const container = document.getElementById('shopsMonitor');
                if (container) {
                    container.innerHTML = '<div class="error-message">加载店铺数据失败</div>';
                }
            }
        } catch (error) {
            console.error('加载店铺监控错误:', error);
            const container = document.getElementById('shopsMonitor');
            if (container) {
                container.innerHTML = '<div class="error-message">加载店铺数据错误</div>';
            }
        }
    };

    // 渲染店铺监控列表
    window.renderShopsMonitor = function(shops) {
        const container = document.getElementById('shopsMonitor');
        if (!container) return;
        
        if (shops.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无店铺数据</div>';
            return;
        }
        
        container.innerHTML = shops.map(shop => `
            <div class="shop-monitor-item">
                <div class="shop-monitor-info">
                    <h6>${shop.name}</h6>
                    <p>🌐 ${shop.domain}</p>
                    <p>👤 店主ID: ${shop.ownerId}</p>
                    <p>🕒 创建时间: ${new Date(shop.createdAt).toLocaleDateString()}</p>
                </div>
                <div class="shop-monitor-actions">
                    <span class="shop-status status-${shop.status}">${shop.status}</span>
                </div>
            </div>
        `).join('');
    };

    // ============ 审核管理 ============

    // 加载待审核店铺
    window.loadPendingShops = async function() {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';

        try {
            const authToken = getAuthToken();
            const response = await fetch('/api/admin/pending-shops', {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                window.renderPendingShops(data.shops);
            } else {
                const container = document.getElementById('pendingShopsContainer');
                if (container) {
                    container.innerHTML = '<div class="error-message">加载待审核店铺失败</div>';
                }
            }
        } catch (error) {
            console.error('加载待审核店铺错误:', error);
            const container = document.getElementById('pendingShopsContainer');
            if (container) {
                container.innerHTML = '<div class="error-message">加载待审核店铺错误</div>';
            }
        }
    };

    // 渲染待审核店铺列表
    window.renderPendingShops = function(shops) {
        const container = document.getElementById('pendingShopsContainer');
        if (!container) return;
        
        if (shops.length === 0) {
            container.innerHTML = `
                <div class="empty-pending">
                    <i>📋</i>
                    <h4>暂无待审核店铺</h4>
                    <p>所有店铺申请都已处理完毕</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = shops.map(shop => `
            <div class="pending-shop-item">
                <div class="pending-shop-header">
                    <div class="pending-shop-info">
                        <h5>${shop.name}</h5>
                        <div class="domain">🌐 ${shop.domain}</div>
                        <div class="description">${shop.description || '暂无描述'}</div>
                    </div>
                </div>
                <div class="pending-shop-meta">
                    <span>👤 店主ID: ${shop.ownerId}</span>
                    <span>🕒 创建时间: ${new Date(shop.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="pending-shop-actions">
                    <button class="review-btn review-approve" onclick="reviewApprove('${shop.id}')">
                        ✅ 通过
                    </button>
                    <button class="review-btn review-reject" onclick="reviewReject('${shop.id}')">
                        ❌ 拒绝
                    </button>
                </div>
            </div>
        `).join('');
    };

    // 审核通过
    window.reviewApprove = async function(shopId) {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        if (!confirm('确定要通过这个店铺的审核吗？')) {
            return;
        }

        try {
            const authToken = getAuthToken();
            const response = await fetch(`/api/shops/${shopId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                },
                body: JSON.stringify({ 
                    note: '审核通过，欢迎使用我们的客服系统！' 
                })
            });

            if (response.ok) {
                showToast('✅ 店铺审核通过！', 'success');
                window.loadPendingShops(); // 刷新列表
            } else {
                const error = await response.json();
                showToast(`审核失败: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('审核店铺错误:', error);
            showToast('网络错误，请稍后重试', 'error');
        }
    };

    // 审核拒绝
    window.reviewReject = async function(shopId) {
        const getAuthToken = typeof window.getAuthToken === 'function' ? window.getAuthToken : () => '';
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);

        const reason = prompt('请输入拒绝原因：');
        if (!reason) return;

        try {
            const authToken = getAuthToken();
            const response = await fetch(`/api/shops/${shopId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Session-Id': authToken
                },
                body: JSON.stringify({ 
                    note: reason 
                })
            });

            if (response.ok) {
                showToast('❌ 店铺申请已拒绝', 'success');
                window.loadPendingShops(); // 刷新列表
            } else {
                const error = await response.json();
                showToast(`拒绝失败: ${error.error}`, 'error');
            }
        } catch (error) {
            console.error('拒绝店铺错误:', error);
            showToast('网络错误，请稍后重试', 'error');
        }
    };

    // 刷新待审核店铺列表
    window.refreshPendingShops = function() {
        const showToast = typeof window.showToast === 'function' ? window.showToast : (msg) => alert(msg);
        window.loadPendingShops();
        showToast('列表已刷新', 'success');
    };

    console.log('✅ 超级管理员模块已加载 (super-admin.js)');
})();
