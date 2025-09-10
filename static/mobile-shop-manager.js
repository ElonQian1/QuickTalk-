/**
 * 手机端店铺管理模块
 * 负责店铺列表的加载、展示和管理功能
 */

class MobileShopManager {
    constructor() {
        this.shops = [];
        this.isLoading = false;
        this.currentUser = null;
    }

    /**
     * 初始化店铺管理器
     */
    async init() {
        this.bindEvents();
        await this.loadShops();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 下拉刷新
        const shopsList = document.getElementById('shopsList');
        if (shopsList) {
            let startY = 0;
            let currentY = 0;
            let isPulling = false;

            shopsList.addEventListener('touchstart', (e) => {
                if (shopsList.scrollTop === 0) {
                    startY = e.touches[0].pageY;
                    isPulling = true;
                }
            });

            shopsList.addEventListener('touchmove', (e) => {
                if (isPulling) {
                    currentY = e.touches[0].pageY;
                    if (currentY - startY > 100) {
                        this.showRefreshIndicator();
                    }
                }
            });

            shopsList.addEventListener('touchend', (e) => {
                if (isPulling && currentY - startY > 100) {
                    this.refreshShops();
                }
                isPulling = false;
                this.hideRefreshIndicator();
            });
        }

        // 搜索功能
        const searchInput = document.getElementById('shopSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterShops(e.target.value);
            });
        }
    }

    /**
     * 获取当前用户的session ID
     */
    getCurrentSessionId() {
        // 优先从URL参数获取sessionId
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        
        if (sessionId) {
            // 将sessionId存储到sessionStorage以供后续使用
            sessionStorage.setItem('currentSessionId', sessionId);
            return sessionId;
        }
        
        // 从sessionStorage获取
        const storedSessionId = sessionStorage.getItem('currentSessionId');
        if (storedSessionId) {
            return storedSessionId;
        }
        
        // 从localStorage获取（兼容旧版本）
        const adminToken = localStorage.getItem('adminToken');
        if (adminToken) {
            return adminToken;
        }
        
        return null;
    }

    /**
     * 加载店铺列表
     */
    async loadShops() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoadingState();

        try {
            const sessionId = this.getCurrentSessionId();
            if (!sessionId) {
                throw new Error('未找到有效的登录会话，请重新登录');
            }

            const response = await fetch('/api/admin/shops', {
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('登录已过期，请重新登录');
                } else if (response.status === 403) {
                    throw new Error('无权限访问店铺数据');
                }
                throw new Error(`请求失败: ${response.status}`);
            }

            this.shops = await response.json();
            await this.loadShopStats();
            this.renderShopsList();
            
        } catch (error) {
            console.error('加载店铺失败:', error);
            this.showErrorState(error.message);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * 加载店铺统计数据
     */
    async loadShopStats() {
        try {
            const sessionId = this.getCurrentSessionId();
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const stats = await response.json();
                // 更新每个店铺的统计数据
                this.shops.forEach(shop => {
                    shop.stats = stats.shopStats?.[shop.id] || {
                        unreadMessages: 0,
                        todayConversations: 0,
                        onlineAgents: 0
                    };
                });
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
        }
    }

    /**
     * 渲染店铺列表
     */
    renderShopsList() {
        const container = document.getElementById('shopsListContainer');
        if (!container) return;

        if (this.shops.length === 0) {
            container.innerHTML = this.getEmptyState();
            return;
        }

        const shopsHTML = this.shops.map(shop => this.renderShopCard(shop)).join('');
        container.innerHTML = `
            <div class="shops-list">
                ${shopsHTML}
            </div>
        `;

        // 更新总数显示
        this.updateShopsCount();
    }

    /**
     * 渲染单个店铺卡片
     */
    renderShopCard(shop) {
        const statusText = this.getStatusText(shop.approvalStatus);
        const statusClass = this.getStatusClass(shop.approvalStatus);
        const roleText = this.getRoleText(shop.userRole);
        
        return `
            <div class="shop-card" data-shop-id="${shop.id}">
                <div class="shop-header">
                    <div class="shop-avatar">
                        ${shop.name ? shop.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div class="shop-info">
                        <div class="shop-name">${shop.name || '未命名店铺'}</div>
                        <div class="shop-domain">${shop.domain || '未设置域名'}</div>
                        <div class="shop-role">${roleText}</div>
                    </div>
                    <div class="shop-status-badge ${statusClass}">
                        ${statusText}
                    </div>
                </div>
                
                <div class="shop-stats">
                    <div class="stat-item">
                        <div class="stat-number">${shop.stats?.unreadMessages || 0}</div>
                        <div class="stat-label">待回复</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${shop.stats?.todayConversations || 0}</div>
                        <div class="stat-label">今日对话</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${shop.stats?.onlineAgents || 0}</div>
                        <div class="stat-label">在线客服</div>
                    </div>
                </div>

                ${shop.description ? `
                    <div class="shop-description">
                        ${shop.description}
                    </div>
                ` : ''}

                <div class="shop-actions">
                    ${this.renderShopActions(shop)}
                </div>

                <div class="shop-meta">
                    <div class="shop-created">
                        创建时间: ${this.formatDate(shop.createdAt)}
                    </div>
                    ${shop.updatedAt ? `
                        <div class="shop-updated">
                            更新时间: ${this.formatDate(shop.updatedAt)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * 渲染店铺操作按钮
     */
    renderShopActions(shop) {
        const actions = [];

        if (shop.approvalStatus === 'pending') {
            actions.push(`
                <button class="action-btn btn-warning" onclick="mobileShopManager.editShop('${shop.id}')">
                    📝 编辑
                </button>
                <button class="action-btn btn-info" onclick="mobileShopManager.resubmitShop('${shop.id}')">
                    🔄 重新审核
                </button>
                <button class="action-btn btn-primary" onclick="mobileShopManager.activateShop('${shop.id}')">
                    💎 付费开通
                </button>
            `);
        } else if (shop.approvalStatus === 'approved') {
            actions.push(`
                <button class="action-btn btn-primary" onclick="mobileShopManager.viewMessages('${shop.id}')">
                    💬 查看消息
                </button>
                <button class="action-btn btn-secondary" onclick="mobileShopManager.manageShop('${shop.id}')">
                    ⚙️ 管理
                </button>
                <button class="action-btn btn-info" onclick="mobileShopManager.generateCode('${shop.id}')">
                    📋 生成代码
                </button>
                <button class="action-btn btn-success" onclick="mobileShopManager.renewShop('${shop.id}')">
                    💰 续费
                </button>
            `);
        } else {
            actions.push(`
                <button class="action-btn btn-secondary" onclick="mobileShopManager.viewMessages('${shop.id}')">
                    💬 查看消息
                </button>
                <button class="action-btn btn-warning" onclick="mobileShopManager.editShop('${shop.id}')">
                    📝 编辑店铺
                </button>
            `);
        }

        return actions.join('');
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const statusMap = {
            'pending': '审核中',
            'approved': '已通过',
            'rejected': '已拒绝',
            'suspended': '已暂停',
            'active': '运行中'
        };
        return statusMap[status] || '未知';
    }

    /**
     * 获取状态样式类
     */
    getStatusClass(status) {
        const classMap = {
            'pending': 'status-pending',
            'approved': 'status-approved', 
            'rejected': 'status-rejected',
            'suspended': 'status-suspended',
            'active': 'status-active'
        };
        return classMap[status] || 'status-unknown';
    }

    /**
     * 获取角色文本
     */
    getRoleText(role) {
        const roleMap = {
            'owner': '店主',
            'admin': '管理员',
            'agent': '客服',
            'super_admin': '超级管理员'
        };
        return roleMap[role] || '用户';
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * 显示加载状态
     */
    showLoadingState() {
        const container = document.getElementById('shopsListContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">正在加载店铺...</div>
                </div>
            `;
        }
    }

    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        // Loading state will be replaced by actual content
    }

    /**
     * 显示错误状态
     */
    showErrorState(message) {
        const container = document.getElementById('shopsListContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-message">${message}</div>
                    <button class="retry-btn" onclick="mobileShopManager.loadShops()">
                        重试
                    </button>
                </div>
            `;
        }
    }

    /**
     * 显示空状态
     */
    getEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">🏪</div>
                <div class="empty-message">暂无店铺</div>
                <div class="empty-description">您还没有创建任何店铺</div>
                <button class="create-shop-btn" onclick="mobileShopManager.createNewShop()">
                    创建第一个店铺
                </button>
            </div>
        `;
    }

    /**
     * 更新店铺总数显示
     */
    updateShopsCount() {
        const countElement = document.getElementById('totalShops');
        if (countElement) {
            countElement.textContent = this.shops.length;
        }
    }

    /**
     * 刷新店铺列表
     */
    async refreshShops() {
        await this.loadShops();
    }

    /**
     * 过滤店铺
     */
    filterShops(keyword) {
        const filteredShops = this.shops.filter(shop => 
            shop.name.toLowerCase().includes(keyword.toLowerCase()) ||
            shop.domain.toLowerCase().includes(keyword.toLowerCase())
        );

        this.renderFilteredShopsList(filteredShops);
    }

    /**
     * 渲染过滤后的店铺列表
     */
    renderFilteredShopsList(shops) {
        const container = document.getElementById('shopsListContainer');
        if (!container) return;

        if (shops.length === 0) {
            container.innerHTML = `
                <div class="no-results-state">
                    <div class="no-results-icon">🔍</div>
                    <div class="no-results-message">未找到匹配的店铺</div>
                </div>
            `;
            return;
        }

        const shopsHTML = shops.map(shop => this.renderShopCard(shop)).join('');
        container.innerHTML = `
            <div class="shops-list">
                ${shopsHTML}
            </div>
        `;
    }

    /**
     * 显示刷新指示器
     */
    showRefreshIndicator() {
        // 可以添加下拉刷新的视觉指示器
    }

    /**
     * 隐藏刷新指示器
     */
    hideRefreshIndicator() {
        // 隐藏下拉刷新指示器
    }

    // ============= 店铺操作方法 =============

    /**
     * 查看店铺消息
     */
    async viewMessages(shopId) {
        window.currentChatShop = shopId;
        window.switchPage('messages');
    }

    /**
     * 管理店铺
     */
    async manageShop(shopId) {
        // 可以打开店铺管理页面或模态框
        console.log('管理店铺:', shopId);
    }

    /**
     * 生成集成代码
     */
    async generateCode(shopId) {
        try {
            const sessionId = this.getCurrentSessionId();
            const response = await fetch(`/api/admin/shops/${shopId}/integration-code`, {
                headers: {
                    'X-Session-Id': sessionId
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showCodeModal(data.code, data.instructions);
            }
        } catch (error) {
            console.error('生成代码失败:', error);
            this.showToast('生成代码失败', 'error');
        }
    }

    /**
     * 编辑店铺
     */
    async editShop(shopId) {
        // 打开编辑店铺页面
        console.log('编辑店铺:', shopId);
    }

    /**
     * 激活店铺（付费开通）
     */
    async activateShop(shopId) {
        if (confirm('确定要付费开通此店铺吗？费用为¥2000/年')) {
            try {
                const sessionId = this.getCurrentSessionId();
                const response = await fetch(`/api/admin/shops/${shopId}/activate`, {
                    method: 'POST',
                    headers: {
                        'X-Session-Id': sessionId,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    this.showToast('店铺激活成功！', 'success');
                    await this.refreshShops();
                } else {
                    throw new Error('激活失败');
                }
            } catch (error) {
                console.error('激活店铺失败:', error);
                this.showToast('激活店铺失败', 'error');
            }
        }
    }

    /**
     * 续费店铺
     */
    async renewShop(shopId) {
        if (confirm('确定要为此店铺续费吗？费用为¥2000/年')) {
            try {
                const sessionId = this.getCurrentSessionId();
                const response = await fetch(`/api/admin/shops/${shopId}/renew`, {
                    method: 'POST',
                    headers: {
                        'X-Session-Id': sessionId,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    this.showToast('续费成功！', 'success');
                    await this.refreshShops();
                } else {
                    throw new Error('续费失败');
                }
            } catch (error) {
                console.error('续费失败:', error);
                this.showToast('续费失败', 'error');
            }
        }
    }

    /**
     * 重新提交审核
     */
    async resubmitShop(shopId) {
        try {
            const sessionId = this.getCurrentSessionId();
            const response = await fetch(`/api/admin/shops/${shopId}/resubmit`, {
                method: 'POST',
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showToast('已重新提交审核', 'success');
                await this.refreshShops();
            } else {
                throw new Error('提交失败');
            }
        } catch (error) {
            console.error('重新提交审核失败:', error);
            this.showToast('提交审核失败', 'error');
        }
    }

    /**
     * 创建新店铺
     */
    createNewShop() {
        // 跳转到创建店铺页面
        window.location.href = '/admin';
    }

    /**
     * 显示代码模态框
     */
    showCodeModal(code, instructions) {
        // 实现代码展示模态框
        console.log('显示集成代码:', code);
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
        // 创建toast提示
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// 创建全局实例
window.mobileShopManager = new MobileShopManager();
