// 管理员面板/审核/用户信息模态与逻辑模块
// 依赖：showToast, getAuthToken, closeModal, 等工具函数

function showAdminPanel() {
    if (!window.userData || (window.userData.role !== 'super_admin' && window.userData.role !== 'administrator')) {
        showToast('只有超级管理员才能访问此功能', 'warning');
        return;
    }
    const modal = document.getElementById('adminPanelModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    showAdminTab('overview');
    loadSystemStats();
    loadShopOwnersStats();
}

async function loadSystemStats() {
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
            document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
            document.getElementById('totalShops').textContent = stats.totalShops || 0;
            document.getElementById('shopOwners').textContent = stats.usersByRole?.shop_owner || 0;
            document.getElementById('employees').textContent = stats.usersByRole?.employee || 0;
        } else {
            showToast('加载系统统计失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请稍后重试', 'error');
    }
}

async function loadShopOwnersStats(keyword = '') {
    try {
        const authToken = getAuthToken();
        const url = keyword ? `/api/admin/shop-owners-stats?keyword=${encodeURIComponent(keyword)}` : '/api/admin/shop-owners-stats';
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-Session-Id': authToken
            }
        });
        if (response.ok) {
            const data = await response.json();
            renderOwnersList(data.stats);
        } else {
            document.getElementById('ownersList').innerHTML = '<div class="error-message">加载店主数据失败</div>';
        }
    } catch (error) {
        document.getElementById('ownersList').innerHTML = '<div class="error-message">加载店主数据错误</div>';
    }
}

function renderOwnersList(owners) {
    const container = document.getElementById('ownersList');
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
                    <button class="btn btn-primary btn-small" onclick="viewOwnerDetails('${owner.user.id}')">📊 详情</button>
                    <button class="btn ${owner.user.status === 'suspended' ? 'btn-success' : 'btn-secondary'} btn-small" onclick="toggleOwnerStatus('${owner.user.id}', '${owner.user.status === 'suspended' ? 'active' : 'suspended'}')">${owner.user.status === 'suspended' ? '✅ 启用' : '⏸️ 禁用'}</button>
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
}

function searchShopOwners() {
    const keyword = document.getElementById('ownerSearch').value.trim();
    loadShopOwnersStats(keyword);
}

async function viewOwnerDetails(ownerId) {
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
            showOwnerDetailsModal(data);
        } else {
            showToast('获取店主详情失败', 'error');
        }
    } catch (error) {
        showToast('获取店主详情错误', 'error');
    }
}

function showOwnerDetailsModal(data) {
    showToast(`店主详情 - ${data.owner.username}\n邮箱: ${data.owner.email}\n店铺数: ${data.shopsCount}`, 'info');
}

async function toggleOwnerStatus(ownerId, newStatus) {
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
            loadShopOwnersStats();
        } else {
            const error = await response.json();
            showToast(`操作失败: ${error.error}`, 'error');
        }
    } catch (error) {
        showToast('操作失败，请重试', 'error');
    }
}

async function loadAllShopsMonitor() {
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
            renderShopsMonitor(data.shops);
        } else {
            document.getElementById('shopsMonitor').innerHTML = '<div class="error-message">加载店铺数据失败</div>';
        }
    } catch (error) {
        document.getElementById('shopsMonitor').innerHTML = '<div class="error-message">加载店铺数据错误</div>';
    }
}

function renderShopsMonitor(shops) {
    const container = document.getElementById('shopsMonitor');
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
}

// 导出到全局
try {
    window.showAdminPanel = showAdminPanel;
    window.loadSystemStats = loadSystemStats;
    window.loadShopOwnersStats = loadShopOwnersStats;
    window.renderOwnersList = renderOwnersList;
    window.searchShopOwners = searchShopOwners;
    window.viewOwnerDetails = viewOwnerDetails;
    window.showOwnerDetailsModal = showOwnerDetailsModal;
    window.toggleOwnerStatus = toggleOwnerStatus;
    window.loadAllShopsMonitor = loadAllShopsMonitor;
    window.renderShopsMonitor = renderShopsMonitor;
} catch (e) {}
