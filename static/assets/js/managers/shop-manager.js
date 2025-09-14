/**
 * ShopManager - 店铺管理器
 * 负责店铺数据的加载、渲染和管理操作
 * 
 * 功能特性:
 * - 店铺列表加载和渲染
 * - 基于角色的权限控制
 * - 店铺状态管理和显示
 * - 用户角色判断和权限分配
 * - 响应式店铺操作界面
 */

export class ShopManager {
    constructor(dependencies = {}) {
        // 依赖注入
        this.apiClient = dependencies.apiClient || window.APIClient;
        this.eventBus = dependencies.eventBus || window.EventBus;
        this.config = dependencies.config || window.ConfigManager;
        this.utils = dependencies.utils || window.Utils;
        
        // 状态管理
        this.shops = [];
        this.currentUser = null;
        this.loadingStates = new Map();
        
        // 状态映射配置
        this.statusConfig = {
            classes: {
                'approved': 'active',
                'active': 'active',
                'pending': 'pending', 
                'expired': 'expired',
                'inactive': 'expired',
                'rejected': 'expired'
            },
            texts: {
                'approved': '✅ 已审核',
                'active': '✅ 正常',
                'pending': '⏳ 待审核',
                'expired': '❌ 已过期',
                'inactive': '⏸️ 未激活',
                'rejected': '❌ 已拒绝'
            }
        };
        
        // 角色配置
        this.roleConfig = {
            texts: {
                'owner': '店主',
                'manager': '经理', 
                'employee': '员工',
                'admin': '管理员',
                'member': '成员'
            },
            permissions: {
                'owner': ['manage', 'messages', 'integration', 'settings'],
                'admin': ['manage', 'messages', 'integration', 'settings'],
                'manager': ['messages', 'integration'],
                'employee': ['messages'],
                'member': ['messages']
            }
        };
        
        this.init();
    }
    
    /**
     * 初始化管理器
     */
    init() {
        this.bindEvents();
        this.logInfo('ShopManager 初始化完成');
    }
    
    /**
     * 绑定事件监听
     */
    bindEvents() {
        // 监听用户状态变化
        this.eventBus?.on('user:login', (userData) => {
            this.currentUser = userData;
            this.logInfo('用户登录，更新当前用户信息');
        });
        
        this.eventBus?.on('user:logout', () => {
            this.currentUser = null;
            this.shops = [];
            this.logInfo('用户登出，清理店铺数据');
        });
        
        // 监听店铺数据更新
        this.eventBus?.on('shop:updated', (shopData) => {
            this.updateShopData(shopData);
        });
        
        // 监听页面切换
        this.eventBus?.on('page:switched', (pageId) => {
            if (pageId === 'shops') {
                this.loadShops();
            }
        });
    }
    
    /**
     * 加载店铺列表
     * @param {boolean} forceReload - 是否强制重新加载
     * @returns {Promise<Array>} 店铺列表
     */
    async loadShops(forceReload = false) {
        const contentElement = document.getElementById('shopsContent');
        
        if (!contentElement) {
            this.logError('找不到店铺内容容器 #shopsContent');
            return [];
        }
        
        // 检查是否正在加载
        if (this.loadingStates.get('shops') && !forceReload) {
            this.logInfo('店铺正在加载中，跳过重复请求');
            return this.shops;
        }
        
        this.setLoadingState('shops', true);
        this.showLoadingState(contentElement);
        
        try {
            // 确定API端点
            const apiEndpoint = this.getShopsApiEndpoint();
            const sessionId = this.getSessionId();
            
            this.logInfo(`📡 开始加载店铺 - 端点: ${apiEndpoint}, 用户角色: ${this.currentUser?.role || '未知'}`);
            
            // 发起API请求
            const response = await this.apiClient.get(apiEndpoint, {
                headers: { 'X-Session-Id': sessionId }
            });
            
            // 处理响应数据
            const shops = this.normalizeShopsData(response);
            
            this.shops = shops;
            this.logInfo(`✅ 成功加载 ${shops.length} 个店铺`);
            
            // 渲染店铺列表
            this.renderShops(shops);
            
            // 触发事件
            this.eventBus?.emit('shops:loaded', {
                shops: shops,
                count: shops.length
            });
            
            return shops;
            
        } catch (error) {
            this.logError('加载店铺失败:', error);
            this.showErrorState(contentElement, error);
            
            // 触发错误事件
            this.eventBus?.emit('shops:loadError', {
                error: error,
                message: error.message
            });
            
            return [];
        } finally {
            this.setLoadingState('shops', false);
        }
    }
    
    /**
     * 获取店铺API端点
     * @returns {string} API端点URL
     */
    getShopsApiEndpoint() {
        // 根据用户角色选择正确的API端点
        const isSuperAdmin = this.currentUser?.role === 'super_admin';
        return isSuperAdmin ? '/api/admin/shops' : '/api/shops';
    }
    
    /**
     * 获取会话ID
     * @returns {string} 会话ID
     */
    getSessionId() {
        return this.config?.get('sessionId') || 
               window.sessionId || 
               localStorage.getItem('sessionId') || '';
    }
    
    /**
     * 标准化店铺数据格式
     * @param {*} responseData - API响应数据
     * @returns {Array} 标准化后的店铺数组
     */
    normalizeShopsData(responseData) {
        this.logInfo('📦 API返回的原始数据类型:', typeof responseData);
        
        let shops;
        
        if (Array.isArray(responseData)) {
            // 直接是数组格式 (来自 /api/shops)
            shops = responseData;
            this.logInfo('📦 检测到数组格式响应');
        } else if (responseData?.shops && Array.isArray(responseData.shops)) {
            // 包装对象格式 (来自 /api/auth/me 或其他端点)
            shops = responseData.shops;
            this.logInfo('📦 检测到对象包装格式响应，提取 shops 数组');
        } else {
            this.logError('❌ 无法识别的响应格式:', responseData);
            throw new Error(`API返回数据格式错误: 期望数组或包含shops的对象，实际收到 ${typeof responseData}`);
        }
        
        // 确保数据是数组格式
        if (!Array.isArray(shops)) {
            this.logError('❌ 处理后的数据仍不是数组格式:', shops);
            throw new Error('店铺数据格式错误：不是数组类型');
        }
        
        return shops;
    }
    
    /**
     * 渲染店铺列表
     * @param {Array} shops - 店铺数据数组
     */
    renderShops(shops) {
        const contentElement = document.getElementById('shopsContent');
        if (!contentElement) {
            this.logError('找不到店铺内容容器');
            return;
        }
        
        this.logInfo(`开始渲染店铺列表，店铺数量: ${shops.length}`);
        
        if (shops.length === 0) {
            this.renderEmptyState(contentElement);
            return;
        }
        
        const shopsHTML = shops.map((shop, index) => {
            if (index < 3) {
                this.logInfo(`店铺${index}:`, shop.name, shop.domain, shop.approvalStatus);
            }
            return this.renderShopItem(shop);
        }).join('');
        
        contentElement.innerHTML = `<div class="shop-list">${shopsHTML}</div>`;
        
        // 触发渲染完成事件
        this.eventBus?.emit('shops:rendered', {
            count: shops.length
        });
    }
    
    /**
     * 渲染单个店铺项
     * @param {Object} shop - 店铺数据
     * @returns {string} 店铺HTML
     */
    renderShopItem(shop) {
        const statusClass = this.getStatusClass(shop.approvalStatus || shop.status);
        const statusText = this.getStatusText(shop.approvalStatus || shop.status);
        const userRole = this.getUserRoleInShop(shop);
        const roleText = this.getRoleText(userRole);
        const actions = this.renderShopActions(shop, userRole);
        
        return `
            <div class="shop-item" data-shop-id="${shop.id}">
                <div class="shop-avatar-container">
                    <div class="shop-avatar">${this.utils?.escapeHtml(shop.name.charAt(0)) || shop.name.charAt(0)}</div>
                    <div class="shop-role">${roleText}</div>
                </div>
                <div class="shop-content">
                    <div class="shop-info">
                        <div class="shop-name">${this.utils?.escapeHtml(shop.name) || shop.name}</div>
                        <div class="shop-domain">${this.utils?.escapeHtml(shop.domain) || shop.domain}</div>
                        <div class="shop-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="shop-actions">
                        ${actions}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 渲染店铺操作按钮
     * @param {Object} shop - 店铺数据
     * @param {string} userRole - 用户角色
     * @returns {string} 操作按钮HTML
     */
    renderShopActions(shop, userRole) {
        const approvalStatus = shop.approval_status || shop.approvalStatus;
        const permissions = this.roleConfig.permissions[userRole] || [];
        
        if (approvalStatus === 'approved') {
            const buttons = [];
            
            // 根据权限添加按钮
            if (permissions.includes('manage')) {
                buttons.push(`<button class="shop-btn primary" onclick="window.ShopManager?.manageShop('${shop.id}') || ShopManager.manageShop('${shop.id}')">管理</button>`);
            }
            
            if (permissions.includes('messages')) {
                buttons.push(`<button class="shop-btn success" onclick="window.MessageManager?.viewShopConversations('${shop.id}') || MessageManager.viewShopConversations('${shop.id}')">💬 消息</button>`);
            }
            
            if (permissions.includes('integration')) {
                buttons.push(`<button class="shop-btn info" onclick="showIntegrationCode('${shop.id}', '${shop.name}')">📋 代码</button>`);
            }
            
            return buttons.join('');
            
        } else if (approvalStatus === 'pending') {
            return `<button class="shop-btn warning" disabled>等待审核</button>`;
        } else if (approvalStatus === 'rejected') {
            return `<button class="shop-btn danger" disabled>已拒绝</button>`;
        } else {
            return `<button class="shop-btn secondary" onclick="window.ShopManager?.manageShop('${shop.id}') || ShopManager.manageShop('${shop.id}')">查看</button>`;
        }
    }
    
    /**
     * 渲染空状态
     * @param {HTMLElement} container - 容器元素
     */
    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏪</div>
                <div>暂无店铺</div>
                <small>点击创建按钮添加第一个店铺</small>
            </div>
        `;
    }
    
    /**
     * 显示加载状态
     * @param {HTMLElement} container - 容器元素
     */
    showLoadingState(container) {
        container.innerHTML = '<div class="loading">正在加载店铺...</div>';
    }
    
    /**
     * 显示错误状态
     * @param {HTMLElement} container - 容器元素
     * @param {Error} error - 错误对象
     */
    showErrorState(container, error) {
        const isNetworkError = error.message.includes('网络') || error.message.includes('fetch');
        const errorMessage = isNetworkError ? '网络错误' : `加载失败: ${error.message}`;
        
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <div>${errorMessage}</div>
                <button class="shop-btn primary" onclick="window.ShopManager?.loadShops(true) || ShopManager.loadShops()">重试</button>
            </div>
        `;
    }
    
    /**
     * 获取状态样式类
     * @param {string} status - 状态值
     * @returns {string} CSS类名
     */
    getStatusClass(status) {
        return this.statusConfig.classes[status] || 'pending';
    }
    
    /**
     * 获取状态显示文本
     * @param {string} status - 状态值
     * @returns {string} 显示文本
     */
    getStatusText(status) {
        return this.statusConfig.texts[status] || '未知状态';
    }
    
    /**
     * 获取用户在店铺中的角色
     * @param {Object} shop - 店铺数据
     * @returns {string} 用户角色
     */
    getUserRoleInShop(shop) {
        // 如果店铺数据中已有userRole属性，直接使用
        if (shop.userRole) {
            return shop.userRole;
        }
        
        // 如果当前用户是超级管理员
        if (this.currentUser?.role === 'super_admin') {
            return 'admin';
        }
        
        // 如果当前用户是店主
        if (this.currentUser?.role === 'shop_owner') {
            return 'owner';
        }
        
        // 检查是否是员工
        if (this.currentUser?.role === 'employee' || this.currentUser?.role === 'agent') {
            return 'employee';
        }
        
        // 默认返回
        return 'member';
    }
    
    /**
     * 获取角色显示文本
     * @param {string} role - 角色值
     * @returns {string} 显示文本
     */
    getRoleText(role) {
        return this.roleConfig.texts[role] || '未知';
    }
    
    /**
     * 管理店铺（打开管理界面）
     * @param {string} shopId - 店铺ID
     */
    manageShop(shopId) {
        this.logInfo('🏪 打开店铺管理:', shopId);
        
        // 触发事件
        this.eventBus?.emit('shop:manage', {
            shopId: shopId,
            shop: this.getShopById(shopId)
        });
        
        // 调用传统方法（向后兼容）
        if (typeof openShopManageModal === 'function') {
            openShopManageModal(shopId);
        } else {
            this.logError('openShopManageModal 函数不存在');
        }
    }
    
    /**
     * 根据ID获取店铺数据
     * @param {string} shopId - 店铺ID
     * @returns {Object|null} 店铺数据
     */
    getShopById(shopId) {
        return this.shops.find(shop => shop.id === shopId) || null;
    }
    
    /**
     * 更新店铺数据
     * @param {Object} shopData - 更新的店铺数据
     */
    updateShopData(shopData) {
        const index = this.shops.findIndex(shop => shop.id === shopData.id);
        if (index !== -1) {
            this.shops[index] = { ...this.shops[index], ...shopData };
            this.logInfo('更新店铺数据:', shopData.id);
            
            // 重新渲染受影响的店铺项
            this.rerenderShopItem(shopData.id);
        }
    }
    
    /**
     * 重新渲染单个店铺项
     * @param {string} shopId - 店铺ID
     */
    rerenderShopItem(shopId) {
        const shop = this.getShopById(shopId);
        if (!shop) return;
        
        const shopElement = document.querySelector(`[data-shop-id="${shopId}"]`);
        if (shopElement) {
            const userRole = this.getUserRoleInShop(shop);
            shopElement.outerHTML = this.renderShopItem(shop);
        }
    }
    
    /**
     * 设置加载状态
     * @param {string} operation - 操作名称
     * @param {boolean} loading - 是否正在加载
     */
    setLoadingState(operation, loading) {
        this.loadingStates.set(operation, loading);
    }
    
    /**
     * 检查是否正在加载
     * @param {string} operation - 操作名称
     * @returns {boolean} 是否正在加载
     */
    isLoading(operation) {
        return this.loadingStates.get(operation) || false;
    }
    
    /**
     * 刷新店铺列表
     * @returns {Promise<Array>} 店铺列表
     */
    async refresh() {
        return this.loadShops(true);
    }
    
    /**
     * 记录信息日志
     * @param {...any} args - 日志参数
     */
    logInfo(...args) {
        console.log('[ShopManager]', ...args);
    }
    
    /**
     * 记录错误日志
     * @param {...any} args - 日志参数
     */
    logError(...args) {
        console.error('[ShopManager]', ...args);
    }
    
    /**
     * 销毁管理器
     */
    destroy() {
        this.eventBus?.off('user:login');
        this.eventBus?.off('user:logout');
        this.eventBus?.off('shop:updated');
        this.eventBus?.off('page:switched');
        
        this.shops = [];
        this.currentUser = null;
        this.loadingStates.clear();
        
        this.logInfo('ShopManager 已销毁');
    }
}

// 全局注册（向后兼容）
if (typeof window !== 'undefined') {
    window.ShopManager = ShopManager;
    
    // 实例化管理器
    if (!window.shopManagerInstance) {
        window.shopManagerInstance = new ShopManager();
        
        // 绑定静态方法（向后兼容）
        ShopManager.loadShops = (...args) => window.shopManagerInstance.loadShops(...args);
        ShopManager.renderShops = (...args) => window.shopManagerInstance.renderShops(...args);
        ShopManager.manageShop = (...args) => window.shopManagerInstance.manageShop(...args);
        ShopManager.getUserRoleInShop = (...args) => window.shopManagerInstance.getUserRoleInShop(...args);
        ShopManager.getRoleText = (...args) => window.shopManagerInstance.getRoleText(...args);
        ShopManager.getStatusClass = (...args) => window.shopManagerInstance.getStatusClass(...args);
        ShopManager.getStatusText = (...args) => window.shopManagerInstance.getStatusText(...args);
    }
}

export default ShopManager;