/**
 * 数据同步管理器
 * 专门处理API数据获取和DOM同步更新
 * 
 * @author GitHub Copilot
 * @version 2.0
 * @date 2025-09-29
 */

class DataSyncManager {
    constructor() {
        this.conversationCache = new Map();
        this.shopStatsCache = new Map();
        this.apiCallCache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存
        this.isDebugMode = false;
        this.updateQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * 开启调试模式
     */
    enableDebugMode() {
        this.isDebugMode = true;
        console.log('🔄 DataSyncManager: 调试模式已开启');
    }

    /**
     * 调试日志
     */
    debug(...args) {
        if (this.isDebugMode) {
            console.log('🔄 DataSyncManager:', ...args);
        }
    }

    /**
     * 获取认证token
     */
    getAuthToken() {
        return window.getAuthToken ? window.getAuthToken() : localStorage.getItem('auth_token') || '';
    }

    /**
     * 强制刷新店铺统计数据
     */
    async forceRefreshShopStats(shopId) {
        this.debug(`强制刷新店铺 ${shopId} 统计数据`);
        
        try {
            const response = await fetch(`/api/conversations?shop_id=${shopId}`, {
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                cache: 'no-cache' // 强制不使用缓存
            });

            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status}`);
            }

            const data = await response.json();
            this.debug(`API响应数据:`, data);

            if (data.success && data.data) {
                const conversations = data.data;
                const conversationCount = conversations.length;
                const unreadCount = conversations.reduce((sum, conv) => {
                    const unread = parseInt(conv.unread_count) || 0;
                    return sum + unread;
                }, 0);

                const stats = {
                    conversation_count: conversationCount,
                    unread_count: unreadCount,
                    conversations: conversations,
                    updated_at: new Date().toISOString()
                };

                this.debug(`计算得到统计数据:`, stats);

                // 更新缓存
                this.shopStatsCache.set(shopId, stats);

                // 立即更新DOM
                this.updateShopStatsDOM(shopId, stats);

                // 同时更新对话缓存
                conversations.forEach(conv => {
                    this.conversationCache.set(conv.id, conv);
                });

                return stats;
            } else {
                throw new Error(`API返回失败: ${data.error || '未知错误'}`);
            }
        } catch (error) {
            this.debug(`刷新店铺统计失败:`, error);
            throw error;
        }
    }

    /**
     * 强制更新店铺统计DOM
     */
    updateShopStatsDOM(shopId, stats) {
        this.debug(`更新店铺 ${shopId} DOM显示:`, stats);

        // 更新所有相关的shop-stat元素
        const shopStatElements = document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-stat`);
        this.debug(`找到 ${shopStatElements.length} 个shop-stat元素`);

        shopStatElements.forEach(statElement => {
            const labelElement = statElement.querySelector('.shop-stat-label');
            const valueElement = statElement.querySelector('.shop-stat-value');
            
            if (!labelElement || !valueElement) {
                this.debug('shop-stat元素结构不完整:', statElement);
                return;
            }

            const label = labelElement.textContent.trim();
            let newValue = 0;

            if (label === '对话') {
                newValue = stats.conversation_count || 0;
            } else if (label === '未读') {
                newValue = stats.unread_count || 0;
            }

            const oldValue = valueElement.textContent;
            valueElement.textContent = newValue;
            
            this.debug(`更新 ${label}: ${oldValue} → ${newValue}`);

            // 添加更新动画效果
            valueElement.style.color = '#007bff';
            setTimeout(() => {
                valueElement.style.color = '';
            }, 1000);
        });

        // 更新店铺状态指示器
        const statusElements = document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-status`);
        statusElements.forEach(statusElement => {
            const hasConversations = (stats.conversation_count || 0) > 0;
            const statusClass = hasConversations ? 'status-active' : 'status-inactive';
            const statusText = hasConversations ? '有对话' : '等待中';
            
            statusElement.className = `shop-status ${statusClass}`;
            statusElement.textContent = statusText;
            
            this.debug(`更新店铺状态: ${statusText}`);
        });

        // 更新未读徽章
        const badgeElements = document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-unread-badge`);
        badgeElements.forEach(badge => {
            const unreadCount = stats.unread_count || 0;
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    /**
     * 强制刷新对话数据
     */
    async forceRefreshConversation(conversationId) {
        this.debug(`强制刷新对话 ${conversationId} 数据`);

        try {
            // 从缓存或API获取对话数据
            let conversation = this.conversationCache.get(conversationId);
            
            if (!conversation) {
                // 尝试从当前页面的conversations数组中找到
                if (window.conversationsData && window.conversationsData.length > 0) {
                    conversation = window.conversationsData.find(c => c.id === conversationId);
                }
            }

            if (conversation) {
                this.updateConversationDOM(conversationId, conversation);
                return conversation;
            } else {
                this.debug(`对话 ${conversationId} 数据未找到`);
                return null;
            }
        } catch (error) {
            this.debug(`刷新对话数据失败:`, error);
            throw error;
        }
    }

    /**
     * 强制更新对话DOM
     */
    updateConversationDOM(conversationId, conversation) {
        this.debug(`更新对话 ${conversationId} DOM显示:`, conversation);

        // 更新last-message元素
        const lastMessageElements = document.querySelectorAll(`[data-conversation-id="${conversationId}"] .last-message`);
        this.debug(`找到 ${lastMessageElements.length} 个last-message元素`);

        lastMessageElements.forEach(element => {
            const oldMessage = element.textContent;
            const newMessage = conversation.last_message || '等待客户消息...';
            
            element.textContent = newMessage;
            this.debug(`更新last-message: "${oldMessage}" → "${newMessage}"`);

            // 添加更新动画效果
            element.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
                element.style.backgroundColor = '';
            }, 1000);
        });

        // 更新message-time元素
        const messageTimeElements = document.querySelectorAll(`[data-conversation-id="${conversationId}"] .message-time`);
        this.debug(`找到 ${messageTimeElements.length} 个message-time元素`);

        messageTimeElements.forEach(element => {
            const oldTime = element.textContent;
            let newTime = '暂无消息';
            
            if (conversation.last_message_time) {
                try {
                    const date = new Date(conversation.last_message_time);
                    newTime = date.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                } catch (e) {
                    this.debug('时间格式化错误:', e);
                    newTime = conversation.last_message_time;
                }
            }
            
            element.textContent = newTime;
            this.debug(`更新message-time: "${oldTime}" → "${newTime}"`);
        });

        // 更新未读徽章
        const unreadBadges = document.querySelectorAll(`[data-conversation-id="${conversationId}"] .unread-badge`);
        unreadBadges.forEach(badge => {
            const unreadCount = parseInt(conversation.unread_count) || 0;
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
            this.debug(`更新unread-badge: ${unreadCount}`);
        });
    }

    /**
     * 批量刷新所有显示的店铺统计
     */
    async refreshAllVisibleShops() {
        this.debug('开始批量刷新所有可见店铺');

        const shopElements = document.querySelectorAll('[data-shop-id]');
        const shopIds = new Set();
        
        shopElements.forEach(element => {
            const shopId = element.getAttribute('data-shop-id');
            if (shopId && shopId !== 'undefined') {
                shopIds.add(shopId);
            }
        });

        this.debug(`发现 ${shopIds.size} 个不同的店铺ID:`, Array.from(shopIds));

        for (const shopId of shopIds) {
            try {
                await this.forceRefreshShopStats(shopId);
                // 添加小延迟避免API调用过于频繁
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                this.debug(`刷新店铺 ${shopId} 失败:`, error);
            }
        }

        this.debug('批量刷新完成');
    }

    /**
     * 批量刷新所有显示的对话
     */
    async refreshAllVisibleConversations() {
        this.debug('开始批量刷新所有可见对话');

        const conversationElements = document.querySelectorAll('[data-conversation-id]');
        const conversationIds = new Set();
        
        conversationElements.forEach(element => {
            const conversationId = element.getAttribute('data-conversation-id');
            if (conversationId && conversationId !== 'undefined') {
                conversationIds.add(conversationId);
            }
        });

        this.debug(`发现 ${conversationIds.size} 个不同的对话ID:`, Array.from(conversationIds));

        for (const conversationId of conversationIds) {
            try {
                await this.forceRefreshConversation(conversationId);
            } catch (error) {
                this.debug(`刷新对话 ${conversationId} 失败:`, error);
            }
        }

        this.debug('对话批量刷新完成');
    }

    /**
     * 添加更新任务到队列
     */
    queueUpdate(type, id, data = null) {
        this.updateQueue.push({ type, id, data, timestamp: Date.now() });
        this.processUpdateQueue();
    }

    /**
     * 处理更新队列
     */
    async processUpdateQueue() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        
        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            
            try {
                if (update.type === 'shop') {
                    await this.forceRefreshShopStats(update.id);
                } else if (update.type === 'conversation') {
                    if (update.data) {
                        this.updateConversationDOM(update.id, update.data);
                    } else {
                        await this.forceRefreshConversation(update.id);
                    }
                }
            } catch (error) {
                this.debug(`处理更新队列失败:`, error);
            }
            
            // 添加小延迟
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.isProcessingQueue = false;
    }

    /**
     * 获取调试信息
     */
    getDebugInfo() {
        return {
            conversationCacheSize: this.conversationCache.size,
            shopStatsCacheSize: this.shopStatsCache.size,
            updateQueueSize: this.updateQueue.length,
            isProcessingQueue: this.isProcessingQueue,
            isDebugMode: this.isDebugMode
        };
    }

    /**
     * 清除所有缓存
     */
    clearCache() {
        this.conversationCache.clear();
        this.shopStatsCache.clear();
        this.updateQueue.length = 0;
        this.debug('所有缓存已清除');
    }
}

// 创建全局实例
window.DataSyncManager = new DataSyncManager();

// 向后兼容函数
window.refreshShopStats = function(shopId) {
    return window.DataSyncManager.forceRefreshShopStats(shopId);
};

window.refreshConversation = function(conversationId) {
    return window.DataSyncManager.forceRefreshConversation(conversationId);
};

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataSyncManager;
}