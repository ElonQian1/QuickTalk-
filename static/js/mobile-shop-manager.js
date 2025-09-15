/**
 * 手机端店铺管理模块
 * 遵循高内聚、低耦合的设计原则
 * 负责店铺数据的获取、展示和管理
 */

class MobileShopManager {
    constructor() {
        this.shops = [];
        this.isLoading = false;
        this.currentUser = null;
        this.apiBaseUrl = '/api';
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // 绑定this到所有方法
        this.init = this.init.bind(this);
        this.loadShops = this.loadShops.bind(this);
        this.renderShops = this.renderShops.bind(this);
    }

    /**
     * 初始化模块
     */
    async init() {
        console.log('🏪 初始化手机端店铺管理模块');
        
        try {
            // 获取当前用户信息
            this.currentUser = await this.getCurrentUser();
            console.log('👤 当前用户:', this.currentUser);
            
            // 绑定事件监听器
            this.bindEvents();
            
            // 🔧 添加实时消息监听
            this.setupRealtimeUpdates();
            
            // 加载店铺数据
            await this.loadShops();
            
            console.log('✅ 店铺管理模块初始化完成');
        } catch (error) {
            console.error('❌ 店铺管理模块初始化失败:', error);
            this.showError('模块初始化失败: ' + error.message);
        }
    }

    /**
     * 获取当前用户信息
     */
    async getCurrentUser() {
        const sessionId = this.getSessionId();
        if (!sessionId) {
            throw new Error('未找到登录会话');
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`获取用户信息失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取session ID
     */
    getSessionId() {
        // 优先从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('sessionId');
        
        if (sessionId) {
            localStorage.setItem('sessionId', sessionId);
            sessionStorage.setItem('currentSessionId', sessionId);
            return sessionId;
        }
        
        // 从localStorage获取（主存储位置）
        const localSessionId = localStorage.getItem('sessionId');
        if (localSessionId) {
            return localSessionId;
        }
        
        // 从sessionStorage获取（备用）
        const storedSessionId = sessionStorage.getItem('currentSessionId');
        if (storedSessionId) {
            return storedSessionId;
        }
        
        // 从全局变量获取（兼容现有代码）
        if (window.sessionId) {
            return window.sessionId;
        }
        
        return null;
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 页面可见性变化时刷新数据
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadShops();
            }
        });

        // 网络状态变化监听
        window.addEventListener('online', () => {
            this.showToast('网络已连接', 'success');
            this.loadShops();
        });

        window.addEventListener('offline', () => {
            this.showToast('网络连接断开', 'warning');
        });
    }

    /**
     * 🔧 设置实时更新监听
     */
    setupRealtimeUpdates() {
        // 1. 检查是否有全局WebSocket连接
        if (window.ws && window.ws.readyState === WebSocket.OPEN) {
            console.log('🔗 检测到WebSocket连接，添加消息监听');
            this.attachWebSocketListener(window.ws);
        }

        // 2. 检查是否有MobileMessageManager的WebSocket
        if (window.messageManager && window.messageManager.ws) {
            console.log('🔗 检测到MessageManager WebSocket，添加消息监听');
            this.attachWebSocketListener(window.messageManager.ws);
        }

        // 3. 如果没有WebSocket，使用轮询机制
        if (!this.hasWebSocketListener) {
            console.log('⏰ 启动轮询机制检测新消息');
            this.startPolling();
        }

        // 4. 监听页面中可能的WebSocket事件
        document.addEventListener('websocket-message', (event) => {
            this.handleRealtimeMessage(event.detail);
        });
    }

    /**
     * 添加WebSocket消息监听
     */
    attachWebSocketListener(ws) {
        const originalOnMessage = ws.onmessage;
        
        ws.onmessage = (event) => {
            // 先执行原有的消息处理
            if (originalOnMessage) {
                originalOnMessage.call(ws, event);
            }
            
            // 处理店铺管理相关的消息
            try {
                const data = JSON.parse(event.data);
                this.handleRealtimeMessage(data);
            } catch (e) {
                // 忽略解析错误
            }
        };
        
        this.hasWebSocketListener = true;
        console.log('✅ WebSocket消息监听已添加');
    }

    /**
     * 处理实时消息
     */
    handleRealtimeMessage(data) {
        if (!data || !data.type) return;

        // 处理可能触发店铺列表更新的消息类型
        const updateTriggers = [
            'new_message',
            'staff_message', 
            'multimedia_message',
            'new_multimedia_message',
            'message_sent'
        ];

        if (updateTriggers.includes(data.type)) {
            console.log('🔄 检测到新消息，刷新店铺列表:', data.type);
            // 延迟一点刷新，避免频繁更新
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = setTimeout(() => {
                this.loadShops(false); // 不显示加载动画
            }, 500);
        }
    }

    /**
     * 启动轮询机制
     */
    startPolling() {
        // 每30秒检查一次新消息
        this.pollingInterval = setInterval(() => {
            if (!document.hidden) { // 只在页面可见时轮询
                this.loadShops(false);
            }
        }, 30000);
        
        console.log('⏰ 轮询机制已启动 (30秒间隔)');
    }

    /**
     * 停止轮询
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏸️ 轮询机制已停止');
        }
    }

    /**
     * 加载店铺列表 - 核心功能
     */
    async loadShops(showLoading = true) {
        if (this.isLoading) {
            console.log('⏳ 正在加载中，跳过重复请求');
            return;
        }

        this.isLoading = true;
        
        if (showLoading) {
            this.showLoading();
        }

        try {
            console.log('🔄 开始加载店铺数据...');
            
            const sessionId = this.getSessionId();
            if (!sessionId) {
                throw new Error('登录会话已过期，请重新登录');
            }

            // 根据用户角色选择不同的API端点
            const endpoint = this.currentUser?.role === 'super_admin' ? 
                '/api/admin/shops' : '/api/shops';

            console.log(`📡 请求API: ${endpoint}`);
            
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'X-Session-Id': sessionId,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`📡 API响应状态: ${response.status}`);

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('登录已过期，请重新登录');
                } else if (response.status === 403) {
                    throw new Error('无权限访问店铺数据');
                }
                
                const errorText = await response.text();
                console.error('API错误响应:', errorText);
                throw new Error(`请求失败: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();
            console.log(`✅ 成功加载 ${responseData.shops ? responseData.shops.length : 0} 个店铺:`, responseData);

            // 🔧 修复：正确提取shops数组
            if (responseData.success && Array.isArray(responseData.shops)) {
                this.shops = responseData.shops;
            } else {
                console.warn('⚠️ API响应格式异常，shops不是数组:', responseData);
                this.shops = [];
            }

            // 渲染店铺列表
            await this.renderShops();
            
            // 重置重试计数
            this.retryCount = 0;
            
        } catch (error) {
            console.error('❌ 加载店铺失败:', error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * 处理加载错误
     */
    handleLoadError(error) {
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            console.log(`🔄 准备重试 (${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => this.loadShops(false), 2000);
            this.showToast(`加载失败，正在重试... (${this.retryCount}/${this.maxRetries})`, 'warning');
        } else {
            this.showError(error.message);
            this.retryCount = 0;
        }
    }

    /**
     * 渲染店铺列表 - UI组件
     */
    async renderShops() {
        console.log('🎨 开始渲染店铺列表');
        
        const container = document.getElementById('shopsContent');
        if (!container) {
            console.error('❌ 未找到店铺列表容器');
            return;
        }

        try {
            if (this.shops.length === 0) {
                this.renderEmptyState(container);
                return;
            }

            // 渲染店铺统计
            this.renderShopStats();

            // 渲染店铺卡片列表
            const shopsHTML = this.shops.map(shop => this.createShopCard(shop)).join('');
            
            container.innerHTML = `
                <div class="shops-list">
                    ${shopsHTML}
                </div>
            `;

            console.log('✅ 店铺列表渲染完成');
            
        } catch (error) {
            console.error('❌ 渲染店铺列表失败:', error);
            this.showError('渲染失败: ' + error.message);
        }
    }

    /**
     * 创建单个店铺卡片
     */
    createShopCard(shop) {
        const statusInfo = this.getShopStatusInfo(shop);
        const createdDate = new Date(shop.createdAt).toLocaleDateString('zh-CN');
        
        return `
            <div class="shop-card" data-shop-id="${shop.id}">
                <div class="shop-header">
                    <div class="shop-avatar">
                        ${shop.name ? shop.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div class="shop-info">
                        <div class="shop-name">${this.escapeHtml(shop.name || '未命名店铺')}</div>
                        <div class="shop-domain">${this.escapeHtml(shop.domain || '未设置域名')}</div>
                        <div class="shop-created">创建于: ${createdDate}</div>
                    </div>
                    <div class="shop-status ${statusInfo.class}">
                        ${statusInfo.text}
                    </div>
                </div>
                
                <div class="shop-description">
                    ${this.escapeHtml(shop.description || '暂无描述')}
                </div>

                <div class="shop-actions">
                    ${this.createShopActions(shop)}
                </div>
            </div>
        `;
    }

    /**
     * 创建店铺操作按钮
     */
    createShopActions(shop) {
        const actions = [];
        
        // 根据店铺状态显示不同操作
        switch (shop.approvalStatus) {
            case 'pending':
                actions.push(`
                    <button class="action-btn btn-info" onclick="mobileShopManager.resubmitShop('${shop.id}')">
                        🔄 重新提交
                    </button>
                `);
                break;
                
            case 'approved':
            case 'active':
                actions.push(`
                    <button class="action-btn btn-primary" onclick="mobileShopManager.viewMessages('${shop.id}')">
                        💬 查看消息
                    </button>
                    <button class="action-btn btn-success" onclick="mobileShopManager.generateCode('${shop.id}')">
                        📋 生成代码
                    </button>
                `);
                break;
                
            default:
                actions.push(`
                    <button class="action-btn btn-secondary" onclick="mobileShopManager.editShop('${shop.id}')">
                        ✏️ 编辑店铺
                    </button>
                `);
        }

        return actions.join('');
    }

    /**
     * 获取店铺状态信息
     */
    getShopStatusInfo(shop) {
        const statusMap = {
            'pending': { class: 'status-pending', text: '⏳ 审核中' },
            'approved': { class: 'status-approved', text: '✅ 已通过' },
            'rejected': { class: 'status-rejected', text: '❌ 已拒绝' },
            'active': { class: 'status-active', text: '🟢 运行中' },
            'suspended': { class: 'status-suspended', text: '⏸️ 已暂停' }
        };
        
        return statusMap[shop.approvalStatus] || { class: 'status-unknown', text: '❓ 未知' };
    }

    /**
     * 渲染店铺统计
     */
    renderShopStats() {
        const statsContainer = document.getElementById('shopStats');
        if (!statsContainer) return;

        const stats = this.calculateShopStats();
        
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.total}</div>
                <div class="stat-label">总店铺</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.active}</div>
                <div class="stat-label">运行中</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.pending}</div>
                <div class="stat-label">审核中</div>
            </div>
        `;
    }

    /**
     * 计算店铺统计
     */
    calculateShopStats() {
        return {
            total: this.shops.length,
            active: this.shops.filter(s => s.approvalStatus === 'active' || s.approvalStatus === 'approved').length,
            pending: this.shops.filter(s => s.approvalStatus === 'pending').length
        };
    }

    /**
     * 渲染空状态
     */
    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏪</div>
                <div class="empty-title">暂无店铺</div>
                <div class="empty-description">您还没有创建任何店铺</div>
                <button class="create-shop-btn" onclick="mobileShopManager.createShop()">
                    创建第一个店铺
                </button>
            </div>
        `;
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const container = document.getElementById('shopsContent');
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
    hideLoading() {
        // 加载状态会被实际内容替换
    }

    /**
     * 显示错误状态
     */
    showError(message) {
        const container = document.getElementById('shopsContent');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-message">${this.escapeHtml(message)}</div>
                    <button class="retry-btn" onclick="mobileShopManager.loadShops()">
                        🔄 重试
                    </button>
                </div>
            `;
        }
    }

    /**
     * 显示Toast提示
     */
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                ${this.escapeHtml(message)}
            </div>
        `;

        document.body.appendChild(toast);

        // 动画显示
        setTimeout(() => toast.classList.add('show'), 100);

        // 自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * HTML转义，防止XSS
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // ============ 店铺操作方法 ============

    /**
     * 查看店铺消息
     */
    async viewMessages(shopId) {
        console.log('💬 查看店铺消息:', shopId);
        // 这里可以跳转到消息页面或调用消息管理模块
        if (window.switchPage) {
            window.switchPage('messages');
        }
    }

    /**
     * 生成集成代码
     */
    async generateCode(shopId) {
        console.log('📋 生成集成代码:', shopId);
        try {
            const response = await fetch(`/api/shops/${shopId}/integration-code`, {
                headers: {
                    'X-Session-Id': this.getSessionId()
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showCodeModal(data.code);
            } else {
                throw new Error('生成代码失败');
            }
        } catch (error) {
            this.showToast('生成代码失败: ' + error.message, 'error');
        }
    }

    /**
     * 编辑店铺
     */
    async editShop(shopId) {
        console.log('✏️ 编辑店铺:', shopId);
        // 这里可以打开编辑模态框
        this.showToast('编辑功能开发中...', 'info');
    }

    /**
     * 重新提交审核
     */
    async resubmitShop(shopId) {
        console.log('🔄 重新提交审核:', shopId);
        try {
            const response = await fetch(`/api/shops/${shopId}/resubmit`, {
                method: 'POST',
                headers: {
                    'X-Session-Id': this.getSessionId(),
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showToast('已重新提交审核', 'success');
                await this.loadShops();
            } else {
                throw new Error('提交失败');
            }
        } catch (error) {
            this.showToast('提交审核失败: ' + error.message, 'error');
        }
    }

    /**
     * 创建店铺
     */
    createShop() {
        console.log('➕ 创建新店铺');
        // 这里可以打开创建店铺的模态框
        if (window.showCreateShopModal) {
            window.showCreateShopModal();
        } else {
            this.showToast('创建功能开发中...', 'info');
        }
    }

    /**
     * 显示代码模态框
     */
    showCodeModal(code) {
        // 创建代码显示模态框
        const modal = document.createElement('div');
        modal.className = 'code-modal';
        modal.innerHTML = `
            <div class="code-modal-content">
                <div class="code-modal-header">
                    <h3>集成代码</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                </div>
                <div class="code-modal-body">
                    <textarea readonly class="code-textarea">${this.escapeHtml(code)}</textarea>
                    <button class="copy-btn" onclick="mobileShopManager.copyCode(this)">复制代码</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * 复制代码
     */
    copyCode(button) {
        const textarea = button.parentElement.querySelector('.code-textarea');
        textarea.select();
        document.execCommand('copy');
        this.showToast('代码已复制到剪贴板', 'success');
    }

    /**
     * 刷新店铺列表
     */
    async refresh() {
        console.log('🔄 手动刷新店铺列表');
        await this.loadShops();
        this.showToast('刷新完成', 'success');
    }

    /**
     * 销毁模块，清理资源
     */
    destroy() {
        console.log('🗑️ 销毁店铺管理模块');
        
        // 🔧 清理实时更新相关资源
        this.stopPolling();
        
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        
        this.shops = [];
        this.currentUser = null;
        this.isLoading = false;
        this.hasWebSocketListener = false;
    }
}

// 全局暴露实例
window.MobileShopManager = MobileShopManager;

// 创建全局实例
window.mobileShopManager = new MobileShopManager();

// 🔧 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.mobileShopManager) {
        window.mobileShopManager.destroy();
    }
});

console.log('📦 手机端店铺管理模块已加载');
