"use strict";

/**
 * 店铺管理模态框功能
 * 提供店铺的详细管理操作：查看详情、编辑、删除、员工管理、集成代码等
 */

// 全局变量
let currentManagedShop = null;

/**
 * 打开店铺管理模态框
 */
function openShopManagement(shopId) {
    const shop = shopsData?.find(s => s.id === shopId);
    if (!shop) {
        showToast('店铺不存在', 'error');
        return;
    }
    
    currentManagedShop = shop;
    renderShopManagementModal(shop);
    openModal('shop-management-modal');
}

/**
 * 渲染店铺管理模态框内容
 */
function renderShopManagementModal(shop) {
    const modalBody = document.querySelector('#shop-management-modal .modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="shop-management-content">
            <!-- 店铺基本信息 -->
            <div class="shop-info-section">
                <div class="shop-info-header">
                    <h4>📋 店铺信息</h4>
                </div>
                <div class="shop-info-details">
                    <div class="info-item">
                        <span class="info-label">店铺名称:</span>
                        <span class="info-value">${shop.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">状态:</span>
                        <span class="info-value status-${getEffectiveStatus(shop)}">${getShopStatusText(getEffectiveStatus(shop))}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">域名:</span>
                        <span class="info-value">${shop.domain || '未设置'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">创建时间:</span>
                        <span class="info-value">${formatTime(shop.created_at)}</span>
                    </div>
                </div>
            </div>
            
            <!-- 快速操作 -->
            <div class="shop-actions-section">
                <div class="actions-header">
                    <h4>⚡ 快速操作</h4>
                </div>
                <div class="actions-grid">
                    ${renderShopActionButtons(shop)}
                </div>
            </div>
            
            <!-- 统计数据 -->
            <div class="shop-stats-section">
                <div class="stats-header">
                    <h4>📊 数据统计</h4>
                </div>
                <div class="stats-grid" id="shop-stats-${shop.id}">
                    <div class="loading-stats">正在加载统计数据...</div>
                </div>
            </div>
        </div>
    `;
    
    // 异步加载统计数据
    loadShopStatistics(shop.id);
}

/**
 * 渲染店铺操作按钮
 */
function renderShopActionButtons(shop) {
    const actions = [];
    const isAdmin = typeof window.isAdmin === 'function' ? window.isAdmin() : false;
    const status = getEffectiveStatus(shop);
    
    // 基础操作
    actions.push(`
        <button class="action-btn btn-primary" onclick="viewShopMessages('${shop.id}')">
            💬 查看消息
        </button>
    `);
    
    actions.push(`
        <button class="action-btn btn-secondary" onclick="editShopInfo('${shop.id}')">
            ✏️ 编辑信息
        </button>
    `);
    
    // 员工管理（店主和管理员）
    if (isAdmin || isShopOwner(shop.id)) {
        actions.push(`
            <button class="action-btn btn-info" onclick="openEmployeeManagement('${shop.id}')">
                👥 员工管理
            </button>
        `);
    }
    
    // 集成代码
    actions.push(`
        <button class="action-btn btn-success" onclick="viewIntegrationCode('${shop.id}')">
            📋 集成代码
        </button>
    `);
    
    // 管理员专有操作
    if (isAdmin) {
        if (status === 'pending') {
            actions.push(`
                <button class="action-btn btn-warning" onclick="approveShop('${shop.id}')">
                    ✅ 批准
                </button>
                <button class="action-btn btn-danger" onclick="rejectShop('${shop.id}')">
                    ❌ 拒绝
                </button>
            `);
        }
        
        if (status === 'approved') {
            actions.push(`
                <button class="action-btn btn-success" onclick="activateShop('${shop.id}')">
                    🚀 激活
                </button>
            `);
        }
        
        if (status === 'active') {
            actions.push(`
                <button class="action-btn btn-warning" onclick="deactivateShop('${shop.id}')">
                    ⏸️ 暂停
                </button>
            `);
        }
        
        actions.push(`
            <button class="action-btn btn-danger" onclick="deleteShop('${shop.id}')">
                🗑️ 删除
            </button>
        `);
    }
    
    return actions.join('');
}

/**
 * 加载店铺统计数据
 */
async function loadShopStatistics(shopId) {
    const statsContainer = document.getElementById(`shop-stats-${shopId}`);
    if (!statsContainer) return;
    
    try {
        // 这里可以调用API获取统计数据
        // 暂时使用模拟数据
        const stats = {
            totalConversations: 15,
            activeConversations: 3,
            totalMessages: 247,
            unreadMessages: 8,
            totalCustomers: 12,
            activeEmployees: 2
        };
        
        statsContainer.innerHTML = `
            <div class="stat-item">
                <div class="stat-number">${stats.totalConversations}</div>
                <div class="stat-label">总对话数</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.activeConversations}</div>
                <div class="stat-label">活跃对话</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.totalMessages}</div>
                <div class="stat-label">总消息数</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.unreadMessages}</div>
                <div class="stat-label">未读消息</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.totalCustomers}</div>
                <div class="stat-label">客户数量</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.activeEmployees}</div>
                <div class="stat-label">在线员工</div>
            </div>
        `;
    } catch (error) {
        statsContainer.innerHTML = '<div class="error-message">加载统计数据失败</div>';
        console.error('加载店铺统计数据失败:', error);
    }
}

/**
 * 店铺操作函数
 */

// 查看店铺消息
function viewShopMessages(shopId) {
    console.log('查看店铺消息:', shopId);
    closeModal('shop-management-modal');
    // 切换到消息页面并选择该店铺
    if (typeof selectShop === 'function') {
        selectShop(shopId);
    }
    if (typeof showPage === 'function') {
        showPage('messages');
    }
}

// 编辑店铺信息
function editShopInfo(shopId) {
    console.log('编辑店铺信息:', shopId);
    closeModal('shop-management-modal');
    // 打开编辑店铺模态框
    if (typeof openEditShop === 'function') {
        openEditShop(shopId);
    } else {
        showToast('编辑功能开发中...', 'info');
    }
}

// 查看集成代码
function viewIntegrationCode(shopId) {
    console.log('查看集成代码:', shopId);
    closeModal('shop-management-modal');
    // 打开集成代码模态框
    if (typeof openIntegrationCode === 'function') {
        openIntegrationCode(shopId);
    } else {
        showToast('集成代码功能开发中...', 'info');
    }
}

// 批准店铺
async function approveShop(shopId) {
    if (!confirm('确定要批准这个店铺吗？')) return;
    
    try {
        showLoading('正在批准店铺...');
        const response = await fetch(`/api/shops/${shopId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            showToast('店铺已批准', 'success');
            await refreshShopData();
            closeModal('shop-management-modal');
        } else {
            showToast('批准失败', 'error');
        }
    } catch (error) {
        console.error('批准店铺失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 拒绝店铺
async function rejectShop(shopId) {
    const reason = prompt('请输入拒绝原因:');
    if (!reason) return;
    
    try {
        showLoading('正在拒绝店铺...');
        const response = await fetch(`/api/shops/${shopId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ reason })
        });
        
        if (response.ok) {
            showToast('店铺已拒绝', 'success');
            await refreshShopData();
            closeModal('shop-management-modal');
        } else {
            showToast('拒绝失败', 'error');
        }
    } catch (error) {
        console.error('拒绝店铺失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 激活店铺
async function activateShop(shopId) {
    if (!confirm('确定要激活这个店铺吗？')) return;
    
    try {
        showLoading('正在激活店铺...');
        const response = await fetch(`/api/shops/${shopId}/activate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            showToast('店铺已激活', 'success');
            await refreshShopData();
            closeModal('shop-management-modal');
        } else {
            showToast('激活失败', 'error');
        }
    } catch (error) {
        console.error('激活店铺失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 暂停店铺
async function deactivateShop(shopId) {
    if (!confirm('确定要暂停这个店铺吗？')) return;
    
    try {
        showLoading('正在暂停店铺...');
        const response = await fetch(`/api/shops/${shopId}/deactivate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            showToast('店铺已暂停', 'success');
            await refreshShopData();
            closeModal('shop-management-modal');
        } else {
            showToast('暂停失败', 'error');
        }
    } catch (error) {
        console.error('暂停店铺失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

// 删除店铺
async function deleteShop(shopId) {
    const shopName = currentManagedShop?.name || '该店铺';
    if (!confirm(`确定要删除店铺"${shopName}"吗？此操作不可恢复！`)) return;
    
    const confirmation = prompt('请输入店铺名称确认删除:', '');
    if (confirmation !== shopName) {
        showToast('店铺名称不正确', 'error');
        return;
    }
    
    try {
        showLoading('正在删除店铺...');
        const response = await fetch(`/api/shops/${shopId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            showToast('店铺已删除', 'success');
            await refreshShopData();
            closeModal('shop-management-modal');
        } else {
            showToast('删除失败', 'error');
        }
    } catch (error) {
        console.error('删除店铺失败:', error);
        showToast('网络错误，请重试', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * 工具函数
 */

// 检查是否为店铺所有者
function isShopOwner(shopId) {
    // 这里需要根据实际的用户权限逻辑来判断
    // 暂时返回 true，实际应该检查用户与店铺的关系
    return true;
}

// 刷新店铺数据
async function refreshShopData() {
    if (typeof loadShops === 'function') {
        await loadShops();
    }
}

// 获取授权token
function getAuthToken() {
    // 这里应该从localStorage或其他地方获取token
    return localStorage.getItem('authToken') || '';
}
