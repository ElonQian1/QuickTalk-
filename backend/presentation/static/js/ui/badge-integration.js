/**
 * 红点组件集成扩展
 * 为现有的 DataSyncManager 添加红点组件支持
 * 
 * @author GitHub Copilot
 * @version 1.1
 * @date 2025-10-03
 */

/**
 * 扩展 DataSyncManager 的函数
 */
function enhanceDataSyncManager() {
    // 检查新的数据同步管理器是否可用
    if (!window.unifiedDataSyncManager && !window.DataSyncManager) {
        console.warn('⚠️ DataSyncManager 尚未加载，等待...');
        if (window.ModuleLoader) {
            window.ModuleLoader.waitForModules(['data-sync-manager']).then(() => {
                enhanceDataSyncManager();
            });
        }
        return;
    }
    
    if (!window.DataSyncManager || typeof window.DataSyncManager !== 'function') {
        console.warn('⚠️ DataSyncManager 不存在，等待加载...');
        return false;
    }
    
    // 保存原始方法
    const originalUpdateShopStatusUnreadBadge = DataSyncManager.prototype.updateShopStatusUnreadBadge;
    const originalUpdateShopDOM = DataSyncManager.prototype.updateShopDOM || function() {};
    
    // 增强 updateShopStatusUnreadBadge 方法以支持新的红点组件
    DataSyncManager.prototype.updateShopStatusUnreadBadge = function(shopId, unreadCount) {
        // 调用原始方法
        if (originalUpdateShopStatusUnreadBadge) {
            originalUpdateShopStatusUnreadBadge.call(this, shopId, unreadCount);
        }
        
        // 更新新的红点组件
        if (window.shopCardManager && typeof window.shopCardManager.updateShopBadge === 'function') {
            window.shopCardManager.updateShopBadge(shopId, unreadCount).catch(error => {
                console.warn(`红点组件更新失败 (店铺 ${shopId}):`, error);
            });
        }
        
        this.debug && this.debug(`红点组件集成更新完成: 店铺 ${shopId}, 数量 ${unreadCount}`);
    };

    // 重写 updateShopDOM 方法以支持红点组件
    DataSyncManager.prototype.updateShopDOM = function(shopId, stats) {
        this.debug && this.debug(`更新店铺 ${shopId} DOM显示:`, stats);

        // 查找旧式的shop-stat元素
        const shopStatElements = document.querySelectorAll(`.shop-stat[data-shop-id="${shopId}"]`);
        this.debug && this.debug(`找到 ${shopStatElements.length} 个shop-stat元素`);
        
        // 如果找到旧式元素，使用原始逻辑
        if (shopStatElements.length > 0) {
            return originalUpdateShopDOM.call(this, shopId, stats);
        }

        // 查找新式的红点组件容器
        const badgeContainers = document.querySelectorAll(`.shop-badge-container[data-shop-id="${shopId}"]`);
        this.debug && this.debug(`找到 ${badgeContainers.length} 个红点容器`);

        // 更新红点组件
        if (badgeContainers.length > 0 && window.shopCardManager) {
            const unreadCount = stats ? (stats.unread_count || 0) : 0;
            window.shopCardManager.updateShopBadge(shopId, unreadCount).catch(error => {
                console.warn(`更新红点组件失败 (店铺 ${shopId}):`, error);
            });
            this.debug && this.debug(`红点组件更新: 店铺 ${shopId}, 未读数 ${unreadCount}`);
        }

        // 触发红点更新事件
        this.updateShopStatusUnreadBadge && this.updateShopStatusUnreadBadge(shopId, stats ? (stats.unread_count || 0) : 0);
    };

    // 添加新的方法：批量更新所有红点组件
    DataSyncManager.prototype.updateAllShopBadges = async function() {
        if (!window.shopCardManager || typeof window.shopCardManager.updateAllBadges !== 'function') {
            this.debug && this.debug('红点组件管理器不可用');
            return 0;
        }

        try {
            const count = await window.shopCardManager.updateAllBadges();
            this.debug && this.debug(`批量更新红点组件完成: ${count} 个`);
            return count;
        } catch (error) {
            console.warn('批量更新红点组件失败:', error);
            return 0;
        }
    };

    // 添加新的方法：强制刷新红点组件
    DataSyncManager.prototype.forceRefreshShopBadges = async function() {
        if (!window.shopCardManager) {
            this.debug && this.debug('红点组件管理器不存在');
            return;
        }

        // 获取所有店铺卡片
        const shopCards = document.querySelectorAll('.shop-card[data-shop-id]');
        const refreshPromises = [];

        shopCards.forEach(card => {
            const shopId = card.getAttribute('data-shop-id');
            if (shopId && !this.isTempId(shopId)) {
                const promise = this.forceRefreshShopStats(shopId)
                    .then(stats => {
                        if (stats && window.shopCardManager) {
                            return window.shopCardManager.updateShopBadge(shopId, stats.unread_count || 0);
                        }
                    })
                    .catch(error => {
                        console.warn(`刷新店铺 ${shopId} 红点失败:`, error);
                    });
                refreshPromises.push(promise);
            }
        });

        await Promise.all(refreshPromises);
        this.debug && this.debug('强制刷新所有红点组件完成');
    };

    console.log('✅ DataSyncManager 红点组件集成扩展加载完成');
    return true;
}

// 尝试立即扩展（如果 DataSyncManager 已经存在）
if (!enhanceDataSyncManager()) {
    // 如果失败，等待 DataSyncManager 加载
    let retryCount = 0;
    const maxRetries = 50;
    
    const checkInterval = setInterval(() => {
        retryCount++;
        if (enhanceDataSyncManager()) {
            clearInterval(checkInterval);
            console.log('✅ DataSyncManager 延迟扩展成功');
        } else if (retryCount >= maxRetries) {
            clearInterval(checkInterval);
            console.error('❌ DataSyncManager 扩展失败，超出重试次数');
        }
    }, 100);
}

// 页面级别的红点更新协调器
class BadgeUpdateCoordinator {
    constructor() {
        this.isEnabled = true;
        this.updateQueue = [];
        this.isProcessing = false;
        this.navBadgeManager = null;
        this._bindUnreadAggregator();
        
        // 监听自定义事件
        this.setupEventListeners();
        
        // 初始化导航红点管理器
        this.initNavBadgeManager();
    }

    initNavBadgeManager() {
            // 等待NavBadgeManager加载
            if (window.NavBadgeManager) {
                // 复用全局实例，避免重复实例化
                if (window.navBadgeManager instanceof window.NavBadgeManager) {
                    this.navBadgeManager = window.navBadgeManager;
                } else {
                    this.navBadgeManager = new NavBadgeManager().enableDebug();
                    // 若上层尚未挂全局实例，这里补挂，供其他模块复用
                    if (!window.navBadgeManager) window.navBadgeManager = this.navBadgeManager;
                }
                console.log('✅ 导航红点管理器已集成');
            } else {
                // 延迟重试
                setTimeout(() => this.initNavBadgeManager(), 100);
            }
    }

    setupEventListeners() {
        // 监听店铺红点点击事件
        document.addEventListener('shopBadgeClick', (event) => {
            const { shopId, unreadCount } = event.detail;
            console.log(`🔴 店铺红点被点击: ${shopId}, 未读数: ${unreadCount}`);
            
            // 可以在这里添加额外的逻辑，比如清零未读数
            if (unreadCount > 0) {
                this.clearShopUnread(shopId);
            }
        });

        // 监听红点清除事件（从导航红点管理器）
        document.addEventListener('badgeCleared', (event) => {
            const { conversationId, shopId, clearedBy } = event.detail;
            console.log(`🧹 红点被清除: 对话 ${conversationId}, 店铺 ${shopId}, 触发方式: ${clearedBy}`);
            
            // 同步更新相关的红点状态
            this.syncBadgeStates(conversationId, shopId);
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('🔄 页面重新可见，刷新红点...');
                this.refreshAllBadges();
            }
        });

        // 监听窗口焦点变化
        window.addEventListener('focus', () => {
            console.log('🔄 窗口获得焦点，刷新红点...');
            setTimeout(() => this.refreshAllBadges(), 1000);
        });
    }

    /**
     * 同步红点状态
     */
    syncBadgeStates(conversationId, shopId) {
        // 更新导航红点
        if (this.navBadgeManager) {
            // 计算新的消息红点数量
            this.calculateTotalUnreadCount().then(totalUnread => {
                this.navBadgeManager.updateNavBadge('messages', totalUnread);
            });
        }
    }

    /**
     * 计算总未读数量
     */
    async calculateTotalUnreadCount() {
        if (window.unreadBadgeAggregator) {
            return window.unreadBadgeAggregator.getTotals().total;
        }
        // 回退旧逻辑 (仅在 aggregator 不存在时)
        let total = 0;
        if (window.shopCardManager) {
            window.shopCardManager.badges.forEach(b => { total += (b.count||0); });
        }
        return total;
    }

    /**
     * 检查是否为临时ID
     */
    isTempId(id) {
        return id && (id.startsWith('temp-') || id.includes('temp'));
    }

    async clearShopUnread(shopId) {
        try {
            if (window.shopCardManager) {
                await window.shopCardManager.updateShopBadge(shopId, 0);
                console.log(`✅ 店铺 ${shopId} 未读数已清零`);
            }
        } catch (error) {
            console.warn(`清零店铺 ${shopId} 未读数失败:`, error);
        }
    }

    async refreshAllBadges() {
        if (!this.isEnabled || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        try {
            // 使用数据同步管理器刷新
            if (window.dataSyncManager && typeof window.dataSyncManager.forceRefreshShopBadges === 'function') {
                await window.dataSyncManager.forceRefreshShopBadges();
            } else if (window.mobileDataSyncManager && typeof window.mobileDataSyncManager.forceRefreshShopBadges === 'function') {
                await window.mobileDataSyncManager.forceRefreshShopBadges();
            }

            // 直接使用红点管理器刷新
            if (window.shopCardManager && typeof window.shopCardManager.updateAllBadges === 'function') {
                await window.shopCardManager.updateAllBadges();
            }

            console.log('🔄 所有红点刷新完成');
        } catch (error) {
            console.warn('红点批量刷新失败:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    enable() {
        this.isEnabled = true;
        console.log('✅ 红点更新协调器已启用');
    }

    disable() {
        this.isEnabled = false;
        console.log('⏸️ 红点更新协调器已禁用');
    }
}

BadgeUpdateCoordinator.prototype._bindUnreadAggregator = function(){
    document.addEventListener('unread:update', (e)=>{
        const detail = e.detail || {};
        if (this.navBadgeManager) {
            this.navBadgeManager.updateNavBadge('messages', detail.total || 0);
        }
    });
};

// 自动初始化协调器
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.badgeUpdateCoordinator = new BadgeUpdateCoordinator();
    });
} else {
    window.badgeUpdateCoordinator = new BadgeUpdateCoordinator();
}

// 标记模块已加载（使用兼容性桥接）
if (window.ModuleLoader && window.ModuleLoader.markLoaded) {
    window.ModuleLoader.markLoaded('badge-integration');
}
console.log('🔗 红点组件集成扩展模块加载完成');