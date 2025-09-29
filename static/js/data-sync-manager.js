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

    isTempId(id) {
        return typeof id === 'string' && id.startsWith('temp-shop-');
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
        if (this.isTempId(shopId)) {
            this.debug('跳过临时店铺ID的API刷新:', shopId);
            return null;
        }
        
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

                let stats = {
                    conversation_count: conversationCount,
                    unread_count: unreadCount,
                    conversations: conversations,
                    updated_at: new Date().toISOString()
                };

                this.debug(`计算得到统计数据:`, stats);

                // 回退修正：若API为0但DOM显示有未读，以DOM派生值为准（避免导航红点与shop-stat不一致）
                const derivedUnread = this.deriveUnreadFromDom(shopId);
                if ((stats.unread_count || 0) < derivedUnread) {
                    this.debug(`检测到DOM派生未读 ${derivedUnread} 大于API统计 ${stats.unread_count}，采用DOM值`);
                    stats = { ...stats, unread_count: derivedUnread };
                }

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
     * 从当前页面DOM派生店铺未读数量
     * 规则：统计属于该店铺的对话项(.conversation-item[data-shop-id])中的 .unread-badge 文本总和
     */
    deriveUnreadFromDom(shopId) {
        try {
            const badges = [
                ...document.querySelectorAll(`.conversation-item[data-shop-id="${shopId}"] .unread-badge`),
                ...document.querySelectorAll(`.unread-badge[data-shop-id="${shopId}"]`)
            ];
            let total = 0;
            badges.forEach(badge => {
                const n = parseInt((badge.textContent || '').trim(), 10);
                if (!Number.isNaN(n)) total += n;
            });
            return total;
        } catch (e) {
            this.debug('deriveUnreadFromDom 异常:', e);
            return 0;
        }
    }

    /**
     * 强制更新店铺统计DOM
     */
    updateShopStatsDOM(shopId, stats) {
        this.debug(`更新店铺 ${shopId} DOM显示:`, stats);

        // 更鲁棒的选择器：先定位卡片容器
        const containerCandidates = [
            ...document.querySelectorAll(`.shop-card[data-shop-id="${shopId}"]`),
            ...document.querySelectorAll(`[data-shop-id="${shopId}"]`)
        ];
        const container = containerCandidates.find(el => el && el.getAttribute('data-shop-id') === String(shopId));

        // 由于 .shop-stats 区域被移除，不再更新 .shop-stat；改为仅更新状态和未读徽章
        this.debug(`定位到店铺容器: ${!!container}`);

        // 更新店铺状态指示器（同样兼容两种层级定位方式）
        const statusElements = [
            ...document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-status`),
            ...document.querySelectorAll(`.shop-status[data-shop-id="${shopId}"]`)
        ];
        statusElements.forEach(statusElement => {
            const hasConversations = (stats.conversation_count || 0) > 0;
            const statusClass = hasConversations ? 'status-active' : 'status-inactive';
            statusElement.className = `shop-status ${statusClass}`;

            // 保留状态文本节点（.shop-status-text），只更新徽章
            let textEl = statusElement.querySelector('.shop-status-text');
            if (!textEl) {
                textEl = document.createElement('span');
                textEl.className = 'shop-status-text';
                statusElement.prepend(textEl);
            }
            // 不强制更新状态文字，保持原模板文案
        });

        // 更新未读徽章 (原有的shop-unread-badge)
        const badgeElements = [
            ...document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-unread-badge`),
            ...document.querySelectorAll(`.shop-unread-badge[data-shop-id="${shopId}"]`)
        ];
        badgeElements.forEach(badge => {
            const unreadCount = stats.unread_count || 0;
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
                // 确保在状态区域内表现合理
                badge.style.position = 'static';
                badge.style.marginLeft = '8px';
            } else {
                badge.style.display = 'none';
            }
        });

        // 更新店铺状态中的未读红点 (新增的unread-badge)
        this.updateShopStatusUnreadBadge(shopId, stats.unread_count || 0);
    }

    /**
     * 更新店铺状态中的未读消息红点
     * @param {string} shopId 店铺ID
     * @param {number} unreadCount 未读消息数量
     */
    updateShopStatusUnreadBadge(shopId, unreadCount) {
        this.debug(`更新店铺 ${shopId} 状态红点:`, unreadCount);
        
        // 查找店铺状态元素
        const statusElements = [
            ...document.querySelectorAll(`.shop-status[data-shop-id="${shopId}"]`),
            ...document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-status`)
        ];
        
        statusElements.forEach(statusElement => {
            // 查找或创建红点元素
            let badge = statusElement.querySelector('.unread-badge');
            
            if (!badge) {
                // 创建新的红点元素
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.setAttribute('data-unread-count', '0');
                statusElement.appendChild(badge);
            }
            
            const count = parseInt(unreadCount) || 0;
            badge.setAttribute('data-unread-count', count);
            
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'flex';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
            
            this.debug(`店铺 ${shopId} 状态红点更新完成，数量: ${count}`);
        });
    }

    /**
     * 强制刷新对话数据
     */
    async forceRefreshConversation(conversationId) {
        this.debug(`强制刷新对话 ${conversationId} 数据`);

        try {
            // 1) 先看缓存
            let conversation = this.conversationCache.get(conversationId);

            // 2) 兼容全局数据
            if (!conversation && Array.isArray(window.conversationsData)) {
                conversation = window.conversationsData.find(c => String(c.id) === String(conversationId));
            }

            // 3) API 回退：请求该对话的消息列表，提取最后一条
            if (!conversation) {
                conversation = await this.fetchConversationFromApi(conversationId);
            }

            if (conversation) {
                this.conversationCache.set(conversationId, conversation);
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
     * 从 API 获取对话详情（基于消息列表推导最后一条消息和时间）
     */
    async fetchConversationFromApi(conversationId) {
        try {
            const token = this.getAuthToken();
            const resp = await fetch(`/api/conversations/${conversationId}/messages`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                cache: 'no-cache'
            });
            if (!resp.ok) {
                this.debug('获取对话消息失败，HTTP状态:', resp.status);
                return null;
            }
            const json = await resp.json();
            const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
            if (!list.length) return { id: conversationId, last_message: '暂无消息', last_message_time: null, unread_count: 0 };

            const last = list[list.length - 1];
            return {
                id: conversationId,
                last_message: last.content || last.message || '',
                last_message_time: last.created_at || last.sent_at || null,
                // 无法精准获知未读，保持不变由上层/后续事件更新
            };
        } catch (e) {
            this.debug('fetchConversationFromApi 异常:', e);
            return null;
        }
    }

    /**
     * 强制更新对话DOM
     */
    updateConversationDOM(conversationId, conversation) {
        this.debug(`更新对话 ${conversationId} DOM显示:`, conversation);

        // last-message 兼容两种结构：父容器携带 data-conversation-id，或元素自身携带
        const lastMessageElements = [
            ...document.querySelectorAll(`[data-conversation-id="${conversationId}"] .last-message`),
            ...document.querySelectorAll(`.last-message[data-conversation-id="${conversationId}"]`),
            // 兼容别名 .conversation-message
            ...document.querySelectorAll(`[data-conversation-id="${conversationId}"] .conversation-message`),
            ...document.querySelectorAll(`.conversation-message[data-conversation-id="${conversationId}"]`)
        ];
        this.debug(`找到 ${lastMessageElements.length} 个last-message元素(含别名)`);

        lastMessageElements.forEach(element => {
            const oldMessage = element.textContent;
            const newMessage = conversation.last_message || '等待客户消息...';
            element.textContent = newMessage;
            this.debug(`更新last-message: "${oldMessage}" → "${newMessage}"`);

            element.style.transition = 'background-color .2s ease';
            element.style.backgroundColor = '#fff3cd';
            setTimeout(() => { element.style.backgroundColor = ''; }, 600);
        });

        // message-time 同样兼容
        const messageTimeElements = [
            ...document.querySelectorAll(`[data-conversation-id="${conversationId}"] .message-time`),
            ...document.querySelectorAll(`.message-time[data-conversation-id="${conversationId}"]`),
            ...document.querySelectorAll(`[data-conversation-id="${conversationId}"] .conversation-time`),
            ...document.querySelectorAll(`.conversation-time[data-conversation-id="${conversationId}"]`)
        ];
        this.debug(`找到 ${messageTimeElements.length} 个message-time元素(含别名)`);

        messageTimeElements.forEach(element => {
            const oldTime = element.textContent;
            let newTime = '暂无消息';
            if (conversation.last_message_time) {
                try {
                    const date = new Date(conversation.last_message_time);
                    newTime = date.toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });
                } catch (e) {
                    this.debug('时间格式化错误:', e);
                    newTime = conversation.last_message_time;
                }
            }
            element.textContent = newTime;
            this.debug(`更新message-time: "${oldTime}" → "${newTime}"`);
        });

        // 未读徽章兼容
        const unreadBadges = [
            ...document.querySelectorAll(`[data-conversation-id="${conversationId}"] .unread-badge`),
            ...document.querySelectorAll(`.unread-badge[data-conversation-id="${conversationId}"]`)
        ];
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