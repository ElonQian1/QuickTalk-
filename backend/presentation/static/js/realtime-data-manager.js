/**
 * 实时数据更新管理器
 * 专门处理shop-stat、message-time、last-message的实时更新
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-09-29
 */

class RealtimeDataManager {
    constructor() {
        this.updateIntervals = new Map(); // 存储定时更新任务
        this.conversationCache = new Map(); // 对话数据缓存
        this.shopStatsCache = new Map(); // 店铺统计缓存
        this.isDebugMode = false;
    }

    // 识别临时占位ID，防止对 temp-shop-* 发请求
    isTempId(id) {
        return typeof id === 'string' && id.startsWith('temp-shop-');
    }

    /**
     * 开启调试模式
     */
    enableDebugMode() {
        this.isDebugMode = true;
        console.log('🔍 RealtimeDataManager: 调试模式已开启');
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.isDebugMode) {
            console.log('🔍 RealtimeDataManager:', ...args);
        }
    }

    /**
     * 初始化实时更新系统
     */
    initialize() {
        this.debug('初始化实时更新系统');
        
        // 监听WebSocket消息
        if (window.addEventListener) {
            window.addEventListener('websocket-message', (event) => {
                this.handleWebSocketMessage(event.detail);
            });
        }

        // 设置定期刷新
        this.startPeriodicUpdate();
        
        return this;
    }

    /**
     * 开始定期更新
     */
    startPeriodicUpdate() {
        // 每30秒刷新一次统计数据
        const statsInterval = setInterval(() => {
            this.refreshAllShopStats();
        }, 30000);
        
        // 每10秒刷新一次对话时间
        const timeInterval = setInterval(() => {
            this.updateAllMessageTimes();
        }, 10000);

        this.updateIntervals.set('stats', statsInterval);
        this.updateIntervals.set('time', timeInterval);
        
        this.debug('定期更新已启动');
    }

    /**
     * 停止定期更新
     */
    stopPeriodicUpdate() {
        this.updateIntervals.forEach((interval) => {
            clearInterval(interval);
        });
        this.updateIntervals.clear();
        this.debug('定期更新已停止');
    }

    /**
     * 处理WebSocket消息
     */
    handleWebSocketMessage(message) {
        this.debug('收到WebSocket消息:', message);
        
        if (message.type === 'new_message') {
            this.updateConversationWithNewMessage(message.data);
        } else if (message.type === 'conversation_update') {
            this.updateConversationData(message.data);
        } else if (message.type === 'shop_stats_update') {
            this.updateShopStats(message.data);
        }
    }

    /**
     * 更新对话的新消息
     */
    updateConversationWithNewMessage(messageData) {
        const { conversation_id, content, created_at, shop_id } = messageData;
        
        this.debug('更新对话新消息:', { conversation_id, shop_id });
        
        // 更新对话缓存
        const conversation = this.conversationCache.get(conversation_id) || {};
        conversation.last_message = content;
        conversation.last_message_time = created_at;
        conversation.unread_count = (conversation.unread_count || 0) + 1;
        conversation.shop_id = shop_id;
        
        this.conversationCache.set(conversation_id, conversation);
        
        // 更新DOM显示
        this.updateConversationDOM(conversation_id, conversation);
        
        // 更新店铺统计
        this.updateShopStatsForNewMessage(shop_id);
        // 委托 DataSyncManager 进行统一刷新（含API回退与更鲁棒选择器）
        if (window.DataSyncManager && window.DataSyncManager.queueUpdate) {
            window.DataSyncManager.queueUpdate('shop', shop_id);
        }
    }

    /**
     * 更新对话DOM显示
     */
    updateConversationDOM(conversationId, conversationData) {
        // 更新last-message
        const lastMessageElements = document.querySelectorAll(
            `[data-conversation-id="${conversationId}"] .last-message`
        );
        lastMessageElements.forEach(element => {
            element.textContent = conversationData.last_message || '等待客户消息...';
            this.debug('更新last-message:', element.textContent);
        });

        // 更新message-time
        const messageTimeElements = document.querySelectorAll(
            `[data-conversation-id="${conversationId}"] .message-time`
        );
        messageTimeElements.forEach(element => {
            const timeText = conversationData.last_message_time ? 
                new Date(conversationData.last_message_time).toLocaleString() : '暂无消息';
            element.textContent = timeText;
            this.debug('更新message-time:', timeText);
        });

        // 更新未读数量徽章
        const unreadBadges = document.querySelectorAll(
            `[data-conversation-id="${conversationId}"] .unread-badge`
        );
        unreadBadges.forEach(badge => {
            const count = conversationData.unread_count || 0;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
            this.debug('更新unread-badge:', count);
        });
    }

    /**
     * 处理店铺统计更新（来自 WebSocket）
     */
    updateShopStats(data) {
        const { shop_id, unread_count, conversation_count } = data || {};
        if (!shop_id) return;
        const prev = this.shopStatsCache.get(shop_id) || {};
        const stats = {
            unread_count: typeof unread_count === 'number' ? unread_count : (prev.unread_count || 0),
            conversation_count: typeof conversation_count === 'number' ? conversation_count : (prev.conversation_count || 0)
        };
        this.shopStatsCache.set(shop_id, stats);
        if (window.DataSyncManager && window.DataSyncManager.updateShopStatsDOM) {
            window.DataSyncManager.updateShopStatsDOM(shop_id, stats);
        } else {
            this.updateShopStatsDOM(shop_id, stats);
        }
    }

    /**
     * 更新店铺统计（新消息触发）
     */
    updateShopStatsForNewMessage(shopId) {
        if (this.isTempId(shopId)) return;
        // 增加未读数量
        const shopStats = this.shopStatsCache.get(shopId) || { unread_count: 0, conversation_count: 0 };
        shopStats.unread_count = (shopStats.unread_count || 0) + 1;
        
        this.shopStatsCache.set(shopId, shopStats);
        this.updateShopStatsDOM(shopId, shopStats);
    }

    /**
     * 更新店铺统计DOM显示
     */
    updateShopStatsDOM(shopId, statsData) {
        // 优先委托 DataSyncManager，统一选择器与回退逻辑
        if (window.DataSyncManager && window.DataSyncManager.updateShopStatsDOM) {
            window.DataSyncManager.updateShopStatsDOM(shopId, statsData);
            return;
        }
        // UI 已无 .shop-stats；仅更新状态与未读徽章
        const shopStatusElements = document.querySelectorAll(
            `[data-shop-id="${shopId}"] .shop-status`
        );
        shopStatusElements.forEach(element => {
            const hasConversations = (statsData.conversation_count || 0) > 0;
            element.className = `shop-status ${hasConversations ? 'status-active' : 'status-inactive'}`;
            // 保留文案，处理徽章
            let badge = element.querySelector('.shop-unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'shop-unread-badge';
                badge.setAttribute('data-shop-id', shopId);
                element.appendChild(badge);
            }
            const count = statsData.unread_count || 0;
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
                badge.style.position = 'static';
                badge.style.marginLeft = '8px';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    /**
     * 刷新所有店铺统计
     */
    async refreshAllShopStats() {
        this.debug('开始刷新所有店铺统计');
        
        const shopElements = document.querySelectorAll('[data-shop-id]');
        for (const element of shopElements) {
            const shopId = element.getAttribute('data-shop-id');
            if (shopId && !this.isTempId(shopId)) {
                await this.refreshShopStats(shopId);
            }
        }
    }

    /**
     * 刷新单个店铺统计
     */
    async refreshShopStats(shopId) {
        if (this.isTempId(shopId)) {
            this.debug('跳过临时店铺ID刷新:', shopId);
            return;
        }
        // 优先委托 DataSyncManager（其内含更鲁棒的选择器和回退）
        if (window.DataSyncManager && window.DataSyncManager.forceRefreshShopStats) {
            try {
                await window.DataSyncManager.forceRefreshShopStats(shopId);
                return;
            } catch (e) {
                this.debug('委托 DataSyncManager 刷新失败，回退到本地刷新逻辑:', e);
            }
        }
        try {
            const token = window.getAuthToken ? window.getAuthToken() : '';
            const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    const conversations = data.data;
                    const conversationCount = conversations.length;
                    const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                    
                    const stats = {
                        conversation_count: conversationCount,
                        unread_count: unreadCount
                    };
                    
                    this.shopStatsCache.set(shopId, stats);
                    this.updateShopStatsDOM(shopId, stats);
                    
                    // 同时更新对话缓存
                    conversations.forEach(conv => {
                        this.conversationCache.set(conv.id, conv);
                    });
                }
            }
        } catch (error) {
            this.debug('刷新店铺统计失败:', error);
        }
    }

    /**
     * 更新所有消息时间显示
     */
    updateAllMessageTimes() {
        this.debug('更新所有消息时间显示');
        
        const messageTimeElements = document.querySelectorAll('.message-time');
        messageTimeElements.forEach(element => {
            const conversationElement = element.closest('[data-conversation-id]');
            if (conversationElement) {
                const conversationId = conversationElement.getAttribute('data-conversation-id');
                const conversation = this.conversationCache.get(conversationId);
                
                if (conversation && conversation.last_message_time) {
                    const timeText = new Date(conversation.last_message_time).toLocaleString();
                    element.textContent = timeText;
                }
            }
        });
    }

    /**
     * 手动更新对话数据
     */
    updateConversationData(conversationData) {
        this.conversationCache.set(conversationData.id, conversationData);
        this.updateConversationDOM(conversationData.id, conversationData);
    }

    /**
     * 获取调试信息
     */
    getDebugInfo() {
        return {
            conversationCacheSize: this.conversationCache.size,
            shopStatsCacheSize: this.shopStatsCache.size,
            activeIntervals: Array.from(this.updateIntervals.keys()),
            isDebugMode: this.isDebugMode
        };
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.conversationCache.clear();
        this.shopStatsCache.clear();
        this.debug('缓存已清除');
    }
}

// 创建全局实例
window.RealtimeDataManager = new RealtimeDataManager();

// 向后兼容函数
window.updateConversationDisplay = function(conversationId, data) {
    return window.RealtimeDataManager.updateConversationData(data);
};

window.updateShopStats = function(shopId, stats) {
    return window.RealtimeDataManager.updateShopStatsDOM(shopId, stats);
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealtimeDataManager;
}