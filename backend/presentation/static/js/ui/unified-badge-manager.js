/**
 * 统一红点管理系统
 * 整合并替代多个重复的badge相关模块
 * 
 * 替代的模块:
 * - badge-integration.js (DataSyncManager集成)
 * - nav-badge-manager.js (导航红点管理)
 * - unread-badge-aggregator.js (未读数聚合)
 * 
 * 依赖:
 * - UnreadBadgeComponent (保留，作为基础UI组件)
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-06
 */

class UnifiedBadgeManager extends UIBase {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 聚合配置
            pollInterval: 30000, // 轮询间隔
            enableWebSocket: true, // 是否启用WebSocket更新
            enableFallback: true, // 是否启用DOM回退
            
            // 显示配置
            maxDisplayCount: 99, // 最大显示数量
            hideZero: true, // 是否隐藏0值
            
            ...options
        };

        // 数据管理
        this.unreadCounts = new Map(); // shopId -> count
        this.badgeComponents = new Map(); // elementId -> UnreadBadgeComponent
        this.totalUnread = 0;
        
        // 事件管理
        this.listeners = new Map();
        this.eventBus = window.eventBus || window.unifiedEventBus;
        
        // 定时器
        this.pollTimer = null;
        
        this.init();
    }

    init() {
        this.log('info', '统一红点管理系统初始化');
        
        // 绑定事件监听
        this.bindEvents();
        
        // 启动数据轮询
        if (this.options.pollInterval > 0) {
            this.startPolling();
        }
        
        // 初始化现有红点
        this.scanExistingBadges();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // WebSocket消息事件
        if (this.eventBus && this.options.enableWebSocket) {
            this.addEventListener(this.eventBus, 'message:new', (e) => {
                this.handleNewMessage(e.detail);
            });
            
            this.addEventListener(this.eventBus, 'message:read', (e) => {
                this.handleMessageRead(e.detail);
            });
        }

        // DataSync事件
        if (window.unifiedDataSyncManager) {
            const syncManager = window.unifiedDataSyncManager;
            this.addEventListener(syncManager.eventBus || syncManager, 'shop:stats:updated', (e) => {
                this.handleShopStatsUpdate(e.detail);
            });
        }

        // 对话项点击事件（清除红点）
        this.addEventListener(document, 'click', (e) => {
            const conversationItem = e.target.closest('.conversation-item');
            if (conversationItem) {
                this.handleConversationClick(conversationItem);
            }
        });
    }

    /**
     * 创建或获取红点组件
     */
    createBadge(containerId, options = {}) {
        if (this.badgeComponents.has(containerId)) {
            return this.badgeComponents.get(containerId);
        }

        if (!window.UnreadBadgeComponent) {
            this.log('error', 'UnreadBadgeComponent未加载');
            return null;
        }

        const container = document.getElementById(containerId) || document.querySelector(containerId);
        if (!container) {
            this.log('warn', '容器不存在:', containerId);
            return null;
        }

        const badge = new window.UnreadBadgeComponent({
            size: 'medium',
            position: 'top-right',
            animation: true,
            maxCount: this.options.maxDisplayCount,
            autoHide: this.options.hideZero,
            ...options
        });

        const element = badge.render(container);
        if (element) {
            this.badgeComponents.set(containerId, badge);
            this.log('info', '创建红点组件:', containerId);
        }

        return badge;
    }

    /**
     * 更新店铺未读数
     */
    updateShopUnread(shopId, count) {
        const oldCount = this.unreadCounts.get(shopId) || 0;
        this.unreadCounts.set(shopId, count);
        
        // 更新总数
        this.updateTotalUnread();
        
        // 更新相关红点显示
        this.updateBadgeDisplay(shopId, count);
        
        // 触发事件
        this.dispatchUnreadUpdateEvent(shopId, count, oldCount);
        
        this.log('debug', `店铺${shopId}未读数更新: ${oldCount} -> ${count}`);
    }

    /**
     * 更新红点显示
     */
    updateBadgeDisplay(shopId, count) {
        // 更新店铺相关的红点
        const shopSelectors = [
            `shop-${shopId}`,
            `[data-shop-id="${shopId}"]`,
            `.shop-card[data-shop-id="${shopId}"]`
        ];

        shopSelectors.forEach(selector => {
            const badge = this.badgeComponents.get(selector);
            if (badge) {
                badge.updateCount(count);
            }
        });

        // 更新导航栏总数红点
        const navBadge = this.badgeComponents.get('nav-conversations') || 
                        this.badgeComponents.get('bottom-nav-conversations');
        if (navBadge) {
            navBadge.updateCount(this.totalUnread);
        }
    }

    /**
     * 更新总未读数
     */
    updateTotalUnread() {
        this.totalUnread = Array.from(this.unreadCounts.values()).reduce((sum, count) => sum + count, 0);
    }

    /**
     * 处理新消息
     */
    handleNewMessage(messageData) {
        const { shop_id, conversation_id } = messageData;
        if (shop_id) {
            const currentCount = this.unreadCounts.get(shop_id) || 0;
            this.updateShopUnread(shop_id, currentCount + 1);
        }
    }

    /**
     * 处理消息已读
     */
    handleMessageRead(readData) {
        const { shop_id, conversation_id } = readData;
        if (shop_id) {
            // 可能需要重新获取准确的未读数
            this.refreshShopUnread(shop_id);
        }
    }

    /**
     * 处理对话点击（清除红点）
     */
    handleConversationClick(conversationItem) {
        const shopId = conversationItem.dataset.shopId;
        const conversationId = conversationItem.dataset.conversationId;
        
        if (shopId) {
            // 标记该对话为已读
            this.markConversationRead(shopId, conversationId);
        }
    }

    /**
     * 处理店铺统计更新
     */
    handleShopStatsUpdate(statsData) {
        const { shopId, stats } = statsData;
        if (stats && typeof stats.unread_count === 'number') {
            this.updateShopUnread(shopId, stats.unread_count);
        }
    }

    /**
     * 标记对话为已读
     */
    markConversationRead(shopId, conversationId) {
        // 发送已读请求
        if (window.unifiedApiManager) {
            window.unifiedApiManager.post(`/api/conversations/${conversationId}/read`, {})
                .then(() => {
                    this.refreshShopUnread(shopId);
                })
                .catch(err => {
                    this.log('error', '标记已读失败:', err);
                });
        }
    }

    /**
     * 刷新店铺未读数
     */
    async refreshShopUnread(shopId) {
        if (!window.unifiedApiManager) return;
        
        try {
            const stats = await window.unifiedApiManager.get(`/api/shops/${shopId}/stats`);
            if (stats && typeof stats.unread_count === 'number') {
                this.updateShopUnread(shopId, stats.unread_count);
            }
        } catch (error) {
            this.log('error', '刷新未读数失败:', error);
        }
    }

    /**
     * 启动轮询
     */
    startPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }

        this.pollTimer = setInterval(() => {
            this.pollAllUnreadCounts();
        }, this.options.pollInterval);

        this.log('info', '启动未读数轮询，间隔:', this.options.pollInterval);
    }

    /**
     * 轮询所有未读数
     */
    async pollAllUnreadCounts() {
        if (!window.unifiedApiManager) return;

        try {
            const shops = await window.unifiedApiManager.get('/api/shops');
            if (Array.isArray(shops)) {
                shops.forEach(shop => {
                    if (shop.id && typeof shop.unread_count === 'number') {
                        this.updateShopUnread(shop.id, shop.unread_count);
                    }
                });
            }
        } catch (error) {
            this.log('error', '轮询未读数失败:', error);
        }
    }

    /**
     * 扫描现有红点
     */
    scanExistingBadges() {
        // 扫描现有的红点元素并注册
        const existingBadges = document.querySelectorAll('.unread-badge-component');
        existingBadges.forEach(badge => {
            const container = badge.parentElement;
            if (container && container.id) {
                this.log('info', '发现现有红点:', container.id);
                // 这里可以添加注册逻辑
            }
        });
    }

    /**
     * 派发未读更新事件
     */
    dispatchUnreadUpdateEvent(shopId, newCount, oldCount) {
        const event = new CustomEvent('unread:update', {
            detail: {
                shopId,
                newCount,
                oldCount,
                totalUnread: this.totalUnread,
                timestamp: Date.now()
            }
        });

        document.dispatchEvent(event);

        if (this.eventBus) {
            this.eventBus.emit('badge:unread:update', {
                shopId,
                newCount,
                oldCount,
                totalUnread: this.totalUnread
            });
        }
    }

    /**
     * 获取店铺未读数
     */
    getShopUnread(shopId) {
        return this.unreadCounts.get(shopId) || 0;
    }

    /**
     * 获取总未读数
     */
    getTotalUnread() {
        return this.totalUnread;
    }

    /**
     * 获取所有未读数据
     */
    getAllUnreadData() {
        return {
            total: this.totalUnread,
            perShop: Object.fromEntries(this.unreadCounts),
            timestamp: Date.now()
        };
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 清理定时器
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        // 销毁所有红点组件
        this.badgeComponents.forEach(badge => {
            if (badge.destroy) {
                badge.destroy();
            }
        });
        this.badgeComponents.clear();

        // 清理事件监听器
        super.destroy();

        this.log('info', '统一红点管理系统已销毁');
    }
}

// 全局单例
window.UnifiedBadgeManager = UnifiedBadgeManager;

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedBadgeManager = new UnifiedBadgeManager();
    });
} else {
    window.unifiedBadgeManager = new UnifiedBadgeManager();
}

console.log('✅ 统一红点管理系统已加载 (UnifiedBadgeManager)');