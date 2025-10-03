/**
 * 整合的数据同步管理器
 * 合并原有DataSyncManager功能，去除重复，优化架构
 * 
 * @author GitHub Copilot
 * @version 3.0
 * @date 2025-10-03
 */

class UnifiedDataSyncManager {
    constructor(dependencies = {}) {
        this.eventBus = dependencies.eventBus || window.eventBus;
        this.logger = dependencies.logger || window.logger;
        this.sessionManager = dependencies.sessionManager || window.unifiedSessionManager;
        
        // 缓存管理
        this.conversationCache = new Map();
        this.shopStatsCache = new Map();
        this.apiCallCache = new Map();
        this.cacheTimeout = window.APP_CONSTANTS?.CACHE.DEFAULT_TTL || 30000;
        
        // 队列管理
        this.updateQueue = [];
        this.isProcessingQueue = false;
        this.batchSize = 5;
        this.queueTimeout = 1000;
        
        // 状态管理
        this.isOnline = navigator.onLine;
        this.retryAttempts = 3;
        this.retryDelay = 1000;
        
        this.init();
    }

    /**
     * 统一处理来自 WebSocket 的消息（可选）
     * - 仅做轻量分发，将具体刷新委托给现有方法/队列
     */
    handleWsMessage(payload) {
        try {
            if (!payload) return;
            const t = payload.type || (payload.data && payload.data.type);
            if (!t) return;

            // 简单类型直达
            if (t === 'shop_stats_update') {
                const shopId = payload.shop_id || payload.data?.shop_id;
                if (shopId) {
                    this.queueUpdate('shop_stats', shopId);
                }
                return;
            }
            if (t === 'new_message') {
                const shopId = payload.data && payload.data.shop_id;
                const convId = payload.data && (payload.data.conversation_id || payload.data.conversationId);
                if (shopId) this.queueUpdate('shop_stats', shopId);
                if (convId) this.queueUpdate('conversation', convId, payload.data);
                return;
            }

            // 领域事件（按需扩展）
            if (typeof t === 'string' && t.startsWith('domain.event.')) {
                // 先尝试对话相关的统一刷新
                const convId = payload.data && (payload.data.conversation_id || payload.data.conversationId);
                if (convId) this.queueUpdate('conversation', convId, payload.data);
                return;
            }
        } catch (e) {
            this.logger?.warn('UnifiedDataSyncManager', 'handleWsMessage 处理失败', e);
        }
    }

    /**
     * 初始化数据同步管理器
     */
    init() {
        this._setupEventListeners();
        this._startQueueProcessor();
        this._setupNetworkMonitoring();
        
        this.logger?.info('UnifiedDataSyncManager', '数据同步管理器初始化完成');
    }

    /**
     * 获取认证token
     */
    getAuthToken() {
        return window.getAuthToken ? window.getAuthToken() : 
               localStorage.getItem('auth_token') || 
               sessionStorage.getItem('auth_token') || '';
    }

    /**
     * 通用API请求方法
     */
    async makeApiRequest(url, options = {}) {
        const requestId = this._generateRequestId();
        const cacheKey = `${options.method || 'GET'}_${url}`;
        
        // 检查缓存
        if (options.useCache !== false && this.apiCallCache.has(cacheKey)) {
            const cached = this.apiCallCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.logger?.debug('UnifiedDataSyncManager', `使用缓存数据: ${url}`);
                return cached.data;
            }
        }

        const startTime = Date.now();
        
        try {
            const defaultOptions = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'X-Request-ID': requestId
                },
                timeout: window.APP_CONSTANTS?.API.TIMEOUT || 10000
            };

            const finalOptions = { ...defaultOptions, ...options };
            
            if (finalOptions.body && typeof finalOptions.body === 'object') {
                finalOptions.body = JSON.stringify(finalOptions.body);
            }

            this.logger?.debug('UnifiedDataSyncManager', `API请求: ${finalOptions.method} ${url}`);

            const response = await this._fetchWithTimeout(url, finalOptions);
            const duration = Date.now() - startTime;

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // 缓存成功的响应
            if (options.useCache !== false && finalOptions.method === 'GET') {
                this.apiCallCache.set(cacheKey, {
                    data,
                    timestamp: Date.now()
                });
            }

            // 记录性能指标
            this.logger?.performance('UnifiedDataSyncManager', `API请求 ${url}`, duration);
            
            // 发布事件
            this.eventBus?.emit(window.APP_CONSTANTS?.EVENTS.DATA_SYNC_SUCCESS, {
                url,
                method: finalOptions.method,
                duration,
                requestId
            });

            return data;

        } catch (error) {
            const duration = Date.now() - startTime;
            
            this.logger?.error('UnifiedDataSyncManager', `API请求失败: ${url}`, {
                error: error.message,
                duration,
                requestId
            });

            // 发布错误事件
            this.eventBus?.emit(window.APP_CONSTANTS?.EVENTS.DATA_SYNC_ERROR, {
                url,
                error: error.message,
                duration,
                requestId
            });

            throw error;
        }
    }

    /**
     * 获取对话数据
     */
    async fetchConversation(conversationId, useCache = true) {
        const cacheKey = `conversation_${conversationId}`;
        
        // 检查缓存
        if (useCache && this.conversationCache.has(cacheKey)) {
            const cached = this.conversationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const data = await this.makeApiRequest(
                `/api/conversations/${conversationId}`,
                { useCache }
            );

            // 更新缓存
            this.conversationCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            // 发布事件
            this.eventBus?.emit(window.APP_CONSTANTS?.EVENTS.CONVERSATION_UPDATED, {
                conversationId,
                data
            });

            return data;

        } catch (error) {
            this.logger?.error('UnifiedDataSyncManager', 
                `获取对话数据失败: ${conversationId}`, error);
            throw error;
        }
    }

    /**
     * 获取店铺统计数据
     */
    async fetchShopStats(shopId, useCache = true) {
        const cacheKey = `shop_stats_${shopId}`;
        
        // 检查缓存
        if (useCache && this.shopStatsCache.has(cacheKey)) {
            const cached = this.shopStatsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const data = await this.makeApiRequest(
                `/api/shops/${shopId}/stats`,
                { useCache }
            );

            // 更新缓存
            this.shopStatsCache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            // 更新DOM
            this.updateShopStatsDOM(shopId, data);

            // 发布事件
            this.eventBus?.emit(window.APP_CONSTANTS?.EVENTS.BADGE_UPDATE, {
                target: `shop_${shopId}`,
                newCount: data.unread_count || 0,
                shopId,
                stats: data
            });

            return data;

        } catch (error) {
            this.logger?.error('UnifiedDataSyncManager', 
                `获取店铺统计失败: ${shopId}`, error);
            throw error;
        }
    }

    /**
     * 批量获取店铺统计
     */
    async fetchMultipleShopStats(shopIds, useCache = true) {
        const promises = shopIds.map(shopId => 
            this.fetchShopStats(shopId, useCache).catch(error => {
                this.logger?.warn('UnifiedDataSyncManager', 
                    `店铺 ${shopId} 统计获取失败`, error);
                return null;
            })
        );

        const results = await Promise.all(promises);
        
        // 过滤掉失败的结果
        const successfulResults = results.filter(result => result !== null);
        
        this.logger?.info('UnifiedDataSyncManager', 
            `批量获取店铺统计完成: ${successfulResults.length}/${shopIds.length}`);

        return successfulResults;
    }

    /**
     * 强制刷新数据
     */
    async forceRefresh(type, id) {
        this.logger?.info('UnifiedDataSyncManager', `强制刷新: ${type} ${id}`);

        switch (type) {
            case 'conversation':
                this.conversationCache.delete(`conversation_${id}`);
                return await this.fetchConversation(id, false);
                
            case 'shop_stats':
                this.shopStatsCache.delete(`shop_stats_${id}`);
                return await this.fetchShopStats(id, false);
                
            default:
                throw new Error(`不支持的刷新类型: ${type}`);
        }
    }

    /**
     * 更新店铺统计DOM
     */
    updateShopStatsDOM(shopId, stats) {
        this.logger?.debug('UnifiedDataSyncManager', 
            `更新店铺 ${shopId} DOM显示`, stats);

        try {
            // 更新店铺状态指示器
            this._updateShopStatusElements(shopId, stats);
            
            // 更新未读徽章
            this._updateUnreadBadges(shopId, stats);
            
            // 更新统计数字
            this._updateStatsNumbers(shopId, stats);

        } catch (error) {
            this.logger?.error('UnifiedDataSyncManager', 
                `更新店铺DOM失败: ${shopId}`, error);
        }
    }

    /**
     * 队列化更新
     */
    queueUpdate(type, id, data) {
        this.updateQueue.push({
            type,
            id,
            data,
            timestamp: Date.now()
        });

        this.logger?.debug('UnifiedDataSyncManager', 
            `更新已加入队列: ${type} ${id} (队列长度: ${this.updateQueue.length})`);
    }

    /**
     * 清除所有缓存
     */
    clearAllCaches() {
        this.conversationCache.clear();
        this.shopStatsCache.clear();
        this.apiCallCache.clear();
        
        this.logger?.info('UnifiedDataSyncManager', '所有缓存已清除');
        
        this.eventBus?.emit('cache.cleared', {
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return {
            conversations: this.conversationCache.size,
            shopStats: this.shopStatsCache.size,
            apiCalls: this.apiCallCache.size,
            queueLength: this.updateQueue.length,
            isProcessingQueue: this.isProcessingQueue,
            isOnline: this.isOnline
        };
    }

    /**
     * 更新店铺状态元素
     * @private
     */
    _updateShopStatusElements(shopId, stats) {
        const statusElements = document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-status`);
        
        statusElements.forEach(statusElement => {
            const hasConversations = (stats.conversation_count || 0) > 0;
            const statusClass = hasConversations ? 'status-active' : 'status-inactive';
            
            statusElement.className = `shop-status ${statusClass}`;
            
            // 更新状态文字
            let textEl = statusElement.querySelector('.shop-status-text');
            if (!textEl) {
                textEl = document.createElement('span');
                textEl.className = 'shop-status-text';
                statusElement.prepend(textEl);
            }
            
            textEl.textContent = hasConversations ? '有对话' : '无对话';
        });
    }

    /**
     * 更新未读徽章
     * @private
     */
    _updateUnreadBadges(shopId, stats) {
        const badgeElements = document.querySelectorAll(`[data-shop-id="${shopId}"] .shop-unread-badge`);
        
        badgeElements.forEach(badge => {
            const unreadCount = stats.unread_count || 0;
            
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'inline-block';
                badge.classList.add('visible');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('visible');
            }
        });
    }

    /**
     * 更新统计数字
     * @private
     */
    _updateStatsNumbers(shopId, stats) {
        const statsContainer = document.querySelector(`[data-shop-id="${shopId}"] .shop-stats`);
        
        if (statsContainer) {
            const conversationCount = statsContainer.querySelector('.conversation-count');
            const messageCount = statsContainer.querySelector('.message-count');
            
            if (conversationCount) {
                conversationCount.textContent = stats.conversation_count || 0;
            }
            
            if (messageCount) {
                messageCount.textContent = stats.message_count || 0;
            }
        }
    }

    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.logger?.info('UnifiedDataSyncManager', '网络已连接');
            this._processQueuedUpdates();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.logger?.warn('UnifiedDataSyncManager', '网络已断开');
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this._processQueuedUpdates();
            }
        });
    }

    /**
     * 设置网络监控
     * @private
     */
    _setupNetworkMonitoring() {
        // 定期检查网络连接
        setInterval(() => {
            if (this.isOnline && this.updateQueue.length > 0) {
                this._processQueuedUpdates();
            }
        }, 30000); // 30秒检查一次
    }

    /**
     * 启动队列处理器
     * @private
     */
    _startQueueProcessor() {
        setInterval(() => {
            this._processQueuedUpdates();
        }, this.queueTimeout);
    }

    /**
     * 处理队列中的更新
     * @private
     */
    async _processQueuedUpdates() {
        if (this.isProcessingQueue || this.updateQueue.length === 0 || !this.isOnline) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            const batch = this.updateQueue.splice(0, this.batchSize);
            
            this.logger?.debug('UnifiedDataSyncManager', 
                `处理更新批次: ${batch.length} 项`);

            const promises = batch.map(update => this._processUpdate(update));
            await Promise.allSettled(promises);

        } catch (error) {
            this.logger?.error('UnifiedDataSyncManager', '处理更新队列失败', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * 处理单个更新
     * @private
     */
    async _processUpdate(update) {
        try {
            switch (update.type) {
                case 'conversation':
                    await this.fetchConversation(update.id, false);
                    break;
                case 'shop_stats':
                    await this.fetchShopStats(update.id, false);
                    break;
                default:
                    this.logger?.warn('UnifiedDataSyncManager', 
                        `未知的更新类型: ${update.type}`);
            }
        } catch (error) {
            this.logger?.error('UnifiedDataSyncManager', 
                `处理更新失败: ${update.type} ${update.id}`, error);
        }
    }

    /**
     * 带超时的fetch请求
     * @private
     */
    async _fetchWithTimeout(url, options) {
        const timeout = options.timeout || 10000;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`请求超时: ${url}`);
            }
            
            throw error;
        }
    }

    /**
     * 生成请求ID
     * @private
     */
    _generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// 注册到模块系统
window.registerModule('UnifiedDataSyncManager', UnifiedDataSyncManager, ['EventBus', 'UnifiedSessionManager']);

// 向后兼容
window.unifiedDataSyncManager = window.getModule('UnifiedDataSyncManager');
window.DataSyncManager = UnifiedDataSyncManager;

// 全局便捷函数
window.refreshShopStats = function(shopId) {
    return window.unifiedDataSyncManager.forceRefresh('shop_stats', shopId);
};

window.refreshConversation = function(conversationId) {
    return window.unifiedDataSyncManager.forceRefresh('conversation', conversationId);
};

console.log('🔄 统一数据同步管理器已初始化 (整合了DataSyncManager功能)');