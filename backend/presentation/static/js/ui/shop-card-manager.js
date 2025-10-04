/**
 * 店铺卡片管理器
 * 专门处理店铺卡片中 shop-status 按钮到未读红点的转换
 * 
 * @author GitHub Copilot
 * @version 1.1
 * @date 2025-10-03
 */

// 使用模块加载器防止重复声明
window.ModuleLoader = window.ModuleLoader || { defineClass: (name, fn) => fn() };

// 先定义类
class ShopCardManager {
    constructor() {
        this.badges = new Map(); // 存储每个店铺的红点组件
        this.dataSyncManager = null;
        this.ns = 'shopCard';
        // 兼容旧 isDebugMode 属性（与 QT_CONFIG 同步）
        Object.defineProperty(this, 'isDebugMode', {
            get: () => !!(window.QT_CONFIG && window.QT_CONFIG.debug && window.QT_CONFIG.debug.namespaces[this.ns]),
            set: (v) => { if (window.QT_LOG) window.QT_LOG.setDebug(this.ns, !!v); }
        });

        if (window.unifiedDataSyncManager) {
            this.dataSyncManager = window.unifiedDataSyncManager;
        } else if (window.dataSyncManager) {
            this.dataSyncManager = window.dataSyncManager;
        } else if (window.mobileDataSyncManager) {
            this.dataSyncManager = window.mobileDataSyncManager;
        }

        this.debug('店铺卡片管理器初始化完成');
    }

    /**
     * 开启调试模式
     */
    enableDebug() {
        if (window.QT_LOG) {
            window.QT_LOG.setDebug(this.ns, true);
        } else {
            // 回退到旧逻辑
            this.isDebugMode = true;
        }
        return this;
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (window.QT_LOG) {
            window.QT_LOG.debug(this.ns, ...args);
        } else if (this.isDebugMode) { // 极端早期加载回退
            console.log('🏪 ShopCardManager:', ...args);
        }
    }

    /**
     * 转换所有店铺卡片的状态按钮为红点
     * @param {string} containerSelector - 容器选择器
     * @returns {Promise<number>} 转换成功的数量
     */
    async convertAllShopCards(containerSelector = '.shop-card') {
        const shopCards = document.querySelectorAll(containerSelector);
        let convertedCount = 0;

        for (const shopCard of shopCards) {
            try {
                const shopId = shopCard.getAttribute('data-shop-id') || 
                              shopCard.querySelector('[data-shop-id]')?.getAttribute('data-shop-id');
                
                if (shopId) {
                    await this.convertShopCard(shopCard, shopId);
                    convertedCount++;
                } else {
                    this.debug('店铺卡片缺少 shop-id:', shopCard);
                }
            } catch (error) {
                console.warn('转换店铺卡片失败:', error, shopCard);
            }
        }

        this.debug(`成功转换 ${convertedCount} 个店铺卡片`);
        return convertedCount;
    }

    /**
     * 转换单个店铺卡片
     * @param {HTMLElement} shopCard - 店铺卡片元素
     * @param {string} shopId - 店铺ID
     * @returns {Promise<UnreadBadgeComponent>} 红点组件
     */
    async convertShopCard(shopCard, shopId) {
        // 查找 / 兜底创建 shop-status 元素
        let statusElement = shopCard.querySelector('.shop-status');
        if (!statusElement) {
            // 新增：自动补充占位，避免抛错导致控制台刷屏
            statusElement = document.createElement('div');
            statusElement.className = 'shop-status placeholder';
            statusElement.setAttribute('data-auto-created', 'true');
            shopCard.appendChild(statusElement);
            this.debug(`店铺 ${shopId} 缺少 .shop-status，已自动补充占位元素`);
        }

        // 检查是否已经转换过
        if (this.badges.has(shopId)) {
            this.debug(`店铺 ${shopId} 已经转换过，更新现有红点`);
            return this.updateShopBadge(shopId);
        }

        // 获取当前状态信息
        const currentStatus = this._extractStatusInfo(statusElement);
        this.debug(`店铺 ${shopId} 当前状态:`, currentStatus);

        // 创建容器div来替换原始的status元素
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'shop-badge-container';
        badgeContainer.setAttribute('data-shop-id', shopId);
        badgeContainer.setAttribute('data-original-status', currentStatus.text);

        // 创建状态文本（如果需要保留）
        if (currentStatus.text && currentStatus.text !== '有对话' && currentStatus.text !== '等待中') {
            const statusText = document.createElement('span');
            statusText.className = 'shop-status-text';
            statusText.textContent = currentStatus.text;
            badgeContainer.appendChild(statusText);
        }

        // 替换原有元素（若是 auto-created placeholder 也同样替换）
        if (statusElement.parentNode) {
            statusElement.parentNode.replaceChild(badgeContainer, statusElement);
        } else {
            // 极端情况：父节点不存在（已被其他脚本移除），直接 append
            shopCard.appendChild(badgeContainer);
        }

        // 创建红点组件
        const badge = new UnreadBadgeComponent({
            size: 'medium',
            position: 'inline',
            animation: true,
            maxCount: 99,
            autoHide: false,
            clickable: true
        });

        // 设置点击事件
        badge.onClick((count, element) => {
            this.debug(`店铺 ${shopId} 红点被点击，未读数: ${count}`);
            this._handleBadgeClick(shopId, count);
        });

        // 创建红点
        badge.create(badgeContainer);
        this.badges.set(shopId, badge);

        // 获取并设置初始未读数量
        const unreadCount = await this._getShopUnreadCount(shopId);
        badge.updateCount(unreadCount);

        // 通知适配器保持一致
        try {
            if (window.ShopStatusBadgeAdapter && typeof window.ShopStatusBadgeAdapter.update === 'function') {
                window.ShopStatusBadgeAdapter.update(shopId, unreadCount);
            }
        } catch (e) {
            this.debug('通知 ShopStatusBadgeAdapter 失败（初始化阶段可忽略）:', e);
        }

        this.debug(`店铺 ${shopId} 转换完成，未读数: ${unreadCount}`);
        return badge;
    }

    /**
     * 更新店铺红点数量
     * @param {string} shopId - 店铺ID
     * @param {number} count - 未读数量（可选，自动获取）
     * @returns {Promise<boolean>} 更新是否成功
     */
    async updateShopBadge(shopId, count = null) {
        const badge = this.badges.get(shopId);
        if (!badge) {
            this.debug(`店铺 ${shopId} 红点组件不存在`);
            return false;
        }

        try {
            const unreadCount = count !== null ? count : await this._getShopUnreadCount(shopId);
            badge.updateCount(unreadCount);
            this.debug(`店铺 ${shopId} 红点更新成功: ${unreadCount}`);
            // 同步适配器
            try {
                if (window.ShopStatusBadgeAdapter && typeof window.ShopStatusBadgeAdapter.update === 'function') {
                    window.ShopStatusBadgeAdapter.update(shopId, unreadCount);
                }
            } catch (e) {
                this.debug('同步 ShopStatusBadgeAdapter 失败（可忽略）:', e);
            }
            return true;
        } catch (error) {
            console.warn(`更新店铺 ${shopId} 红点失败:`, error);
            return false;
        }
    }

    /**
     * 更新所有店铺红点
     * @returns {Promise<number>} 成功更新的数量
     */
    async updateAllBadges() {
        let successCount = 0;
        const promises = Array.from(this.badges.keys()).map(async (shopId) => {
            const success = await this.updateShopBadge(shopId);
            if (success) successCount++;
        });

        await Promise.all(promises);
        this.debug(`批量更新完成，成功: ${successCount}/${this.badges.size}`);
        return successCount;
    }

    /**
     * 移除店铺红点
     * @param {string} shopId - 店铺ID
     * @returns {boolean} 移除是否成功
     */
    removeBadge(shopId) {
        const badge = this.badges.get(shopId);
        if (badge) {
            badge.destroy();
            this.badges.delete(shopId);
            this.debug(`店铺 ${shopId} 红点已移除`);
            return true;
        }
        return false;
    }

    /**
     * 清理所有红点
     */
    clearAllBadges() {
        this.badges.forEach((badge, shopId) => {
            badge.destroy();
            this.debug(`清理店铺 ${shopId} 红点`);
        });
        this.badges.clear();
    }

    /**
     * 启动自动更新机制
     * @param {number} interval - 更新间隔（毫秒）
     * @returns {number} 定时器ID
     */
    startAutoUpdate(interval = 30000) {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(() => {
            this.debug('自动更新店铺红点...');
            this.updateAllBadges();
        }, interval);

        this.debug(`自动更新已启动，间隔: ${interval}ms`);
        return this.updateTimer;
    }

    /**
     * 停止自动更新
     */
    stopAutoUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            this.debug('自动更新已停止');
        }
    }

    /**
     * 提取状态信息
     * @private
     */
    _extractStatusInfo(statusElement) {
        return {
            text: statusElement.textContent?.trim() || '',
            classes: Array.from(statusElement.classList),
            hasConversations: statusElement.classList.contains('status-active')
        };
    }

    /**
     * 获取店铺未读数量
     * @private
     */
    async _getShopUnreadCount(shopId) {
        // 优先使用数据同步管理器
        if (this.dataSyncManager && typeof this.dataSyncManager.forceRefreshShopStats === 'function') {
            try {
                const stats = await this.dataSyncManager.forceRefreshShopStats(shopId);
                return stats?.unread_count || 0;
            } catch (error) {
                this.debug(`从数据同步管理器获取店铺 ${shopId} 统计失败:`, error);
            }
        }

        // 回退到 API 直接请求
        try {
            const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                headers: {
                    'Authorization': `Bearer ${this._getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status}`);
            }

            const data = await response.json();
            if (data.success && Array.isArray(data.data)) {
                const unreadCount = data.data.reduce((sum, conv) => {
                    return sum + (parseInt(conv.unread_count) || 0);
                }, 0);
                return unreadCount;
            }
        } catch (error) {
            this.debug(`API获取店铺 ${shopId} 未读数量失败:`, error);
        }

        return 0;
    }

    /**
     * 获取认证token
     * @private
     */
    _getAuthToken() {
        return window.getAuthToken ? window.getAuthToken() : 
               localStorage.getItem('auth_token') || 
               localStorage.getItem('sessionId') || '';
    }

    /**
     * 处理红点点击事件
     * @private
     */
    _handleBadgeClick(shopId, count) {
        // 触发自定义事件
        const event = new CustomEvent('shopBadgeClick', {
            detail: { shopId, unreadCount: count }
        });
        document.dispatchEvent(event);

        // 如果存在全局的店铺点击处理函数，调用它
        if (typeof window.handleShopClick === 'function') {
            window.handleShopClick(shopId, event);
        } else if (typeof window.selectShop === 'function') {
            window.selectShop({ id: shopId });
        }
    }

    /**
     * 静态方法：快速初始化
     * @param {object} options - 配置选项
     * @returns {Promise<ShopCardManager>} 管理器实例
     */
    static async quickInit(options = {}) {
        const manager = new ShopCardManager();

        // 默认不启用 debug，除非明确传入或全局开启
        if (options.debug || (window.QT_CONFIG && window.QT_CONFIG.debug.global)) {
            manager.enableDebug();
        }

        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // 延迟执行转换，确保动态内容加载完成
        setTimeout(async () => {
            await manager.convertAllShopCards(options.selector);
            
            if (options.autoUpdate !== false) {
                const interval = options.updateInterval || (window.QT_CONFIG && window.QT_CONFIG.intervals && window.QT_CONFIG.intervals.shopCardAutoUpdate) || 30000;
                manager.startAutoUpdate(interval);
            }
        }, options.delay || 2000);

        return manager;
    }
}

// 使用旧模块系统注册
window.ModuleLoader.defineClass('ShopCardManager', function() {
    return ShopCardManager;
});

// 注册到新的模块系统
if (window.registerModule) {
    window.registerModule('ShopCardManager', ShopCardManager, ['UnifiedDataSyncManager']);
}

// 向后兼容
window.ShopCardManager = ShopCardManager;
console.log('🏠 店铺卡片管理器已加载');