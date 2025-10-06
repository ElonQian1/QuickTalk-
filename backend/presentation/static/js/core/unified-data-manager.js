/**
 * 统一数据管理器 - UnifiedDataManager
 * 
 * 设计目标：
 * - 消除DataSyncManager、UnifiedDataSyncManager、mobileDataSyncManager等重复实现
 * - 提供统一的数据获取、缓存和同步接口
 * - 支持离线存储和智能预加载
 * - 集成API管理器实现缓存和去重
 * - 提供状态管理和变更通知
 */
(function() {
    'use strict';

    // 检查是否已初始化
    if (window.UnifiedDataManager) {
        console.warn('⚠️ UnifiedDataManager已存在，跳过重复初始化');
        return;
    }

    class UnifiedDataManager {
        constructor(options = {}) {
            this.options = {
                debug: false,
                enableOfflineCache: true,
                enableAutoSync: true,
                syncInterval: 60000, // 1分钟自动同步
                ...options
            };

            // 使用统一日志系统
            this.logger = window.getLogger ? window.getLogger('DataManager', { enableDebug: this.options.debug }) : null;

            // 使用统一的fetch工具，消除重复的HTTP请求逻辑
            this.fetch = window.unifiedFetch || new (window.UnifiedFetch || class MockFetch {
                async get() { throw new Error('UnifiedFetch未加载'); }
                async post() { throw new Error('UnifiedFetch未加载'); }
            })();

            // 数据存储
            this.stores = {
                shops: new Map(),
                conversations: new Map(),
                messages: new Map(),
                users: new Map(),
                stats: new Map()
            };

            // 数据状态跟踪
            this.dataState = {
                shops: { loaded: false, loading: false, lastUpdate: null },
                conversations: { loaded: false, loading: false, lastUpdate: null },
                messages: { loaded: false, loading: false, lastUpdate: null }
            };

            // 订阅者管理
            this.subscribers = new Map();

            // 自动同步定时器
            this.syncTimer = null;

            // 依赖注入 - API管理器
            this.apiManager = window.apiManager || null;

            this.log('info', 'UnifiedDataManager初始化完成');

            if (this.options.enableAutoSync) {
                this._startAutoSync();
            }
        }

        /**
         * 日志记录
         */
        log(level, message, ...args) {
            if (this.logger) {
                this.logger[level](message, ...args);
            } else {
                const prefix = '[DataManager]';
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 订阅数据变更
         */
        subscribe(dataType, callback) {
            if (!this.subscribers.has(dataType)) {
                this.subscribers.set(dataType, new Set());
            }
            this.subscribers.get(dataType).add(callback);

            // 返回取消订阅函数
            return () => {
                const subscribers = this.subscribers.get(dataType);
                if (subscribers) {
                    subscribers.delete(callback);
                }
            };
        }

        /**
         * 通知订阅者
         */
        _notifySubscribers(dataType, data, action = 'update') {
            const subscribers = this.subscribers.get(dataType);
            if (subscribers) {
                subscribers.forEach(callback => {
                    try {
                        callback({ type: dataType, data, action, timestamp: Date.now() });
                    } catch (error) {
                        this.log('error', '订阅者回调执行失败', error);
                    }
                });
            }

            // 发布全局事件
            if (window.eventBus) {
                window.eventBus.emit(`data:${dataType}:${action}`, { data, timestamp: Date.now() });
            }
        }

        /**
         * 获取店铺数据
         */
        async getShops(forceRefresh = false) {
            const stateKey = 'shops';
            
            if (this.dataState[stateKey].loading) {
                this.log('debug', '店铺数据正在加载中，等待...');
                return this._waitForLoading(stateKey);
            }

            if (!forceRefresh && this.dataState[stateKey].loaded && this._isDataFresh(stateKey)) {
                this.log('debug', '返回缓存的店铺数据');
                return Array.from(this.stores.shops.values());
            }

            return this._loadShops(forceRefresh);
        }

        /**
         * 内部加载店铺数据
         */
        async _loadShops(forceRefresh = false) {
            const stateKey = 'shops';
            this.dataState[stateKey].loading = true;

            try {
                this.log('info', '开始加载店铺数据...');
                
                // 使用API管理器
                const shops = this.apiManager ? 
                    await this.apiManager.request('/api/shops', {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    }) : 
                    await this.fetch.get('/api/shops', {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    });

                if (shops && Array.isArray(shops)) {
                    this._updateShopsStore(shops);
                    this.dataState[stateKey].loaded = true;
                    this.dataState[stateKey].lastUpdate = Date.now();
                    
                    this.log('info', `店铺数据加载完成，共${shops.length}个店铺`);
                    this._notifySubscribers('shops', shops, 'loaded');
                    
                    return shops;
                } else {
                    throw new Error('店铺数据格式错误');
                }
            } catch (error) {
                this.log('error', '加载店铺数据失败', error);
                this._notifySubscribers('shops', null, 'error');
                return [];
            } finally {
                this.dataState[stateKey].loading = false;
            }
        }

        /**
         * 更新店铺存储
         */
        _updateShopsStore(shops) {
            this.stores.shops.clear();
            shops.forEach(shop => {
                this.stores.shops.set(shop.id, { ...shop, lastUpdate: Date.now() });
            });
        }

        /**
         * 获取对话数据
         */
        async getConversations(shopId, forceRefresh = false) {
            if (!shopId) {
                this.log('warn', '获取对话数据需要shopId');
                return [];
            }

            const cacheKey = `conversations_${shopId}`;
            
            if (!forceRefresh && this.stores.conversations.has(cacheKey)) {
                const cached = this.stores.conversations.get(cacheKey);
                if (this._isDataFresh('conversations', cached.lastUpdate)) {
                    this.log('debug', '返回缓存的对话数据');
                    return cached.data;
                }
            }

            return this._loadConversations(shopId, forceRefresh);
        }

        /**
         * 内部加载对话数据
         */
        async _loadConversations(shopId, forceRefresh = false) {
            try {
                this.log('info', `开始加载店铺${shopId}的对话数据...`);
                
                const url = `/api/conversations?shop_id=${shopId}`;
                const conversations = this.apiManager ?
                    await this.apiManager.request(url, {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    }) :
                    await this.fetch.get(url, {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    });

                if (conversations && Array.isArray(conversations)) {
                    const cacheKey = `conversations_${shopId}`;
                    this.stores.conversations.set(cacheKey, {
                        data: conversations,
                        lastUpdate: Date.now()
                    });
                    
                    this.log('info', `对话数据加载完成，共${conversations.length}个对话`);
                    this._notifySubscribers('conversations', { shopId, conversations }, 'loaded');
                    
                    return conversations;
                } else {
                    throw new Error('对话数据格式错误');
                }
            } catch (error) {
                this.log('error', '加载对话数据失败', error);
                this._notifySubscribers('conversations', null, 'error');
                return [];
            }
        }

        /**
         * 获取消息数据
         */
        async getMessages(conversationId, forceRefresh = false) {
            if (!conversationId) {
                this.log('warn', '获取消息数据需要conversationId');
                return [];
            }

            const cacheKey = `messages_${conversationId}`;
            
            if (!forceRefresh && this.stores.messages.has(cacheKey)) {
                const cached = this.stores.messages.get(cacheKey);
                if (this._isDataFresh('messages', cached.lastUpdate)) {
                    this.log('debug', '返回缓存的消息数据');
                    return cached.data;
                }
            }

            return this._loadMessages(conversationId, forceRefresh);
        }

        /**
         * 内部加载消息数据
         */
        async _loadMessages(conversationId, forceRefresh = false) {
            try {
                this.log('info', `开始加载对话${conversationId}的消息数据...`);
                
                const url = `/api/conversations/${conversationId}/messages`;
                const messages = this.apiManager ?
                    await this.apiManager.request(url, {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    }) :
                    await this.fetch.get(url, {
                        headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                    });

                if (messages && Array.isArray(messages)) {
                    const cacheKey = `messages_${conversationId}`;
                    this.stores.messages.set(cacheKey, {
                        data: messages,
                        lastUpdate: Date.now()
                    });
                    
                    this.log('info', `消息数据加载完成，共${messages.length}条消息`);
                    this._notifySubscribers('messages', { conversationId, messages }, 'loaded');
                    
                    return messages;
                } else {
                    throw new Error('消息数据格式错误');
                }
            } catch (error) {
                this.log('error', '加载消息数据失败', error);
                this._notifySubscribers('messages', null, 'error');
                return [];
            }
        }

        /**
         * 检查数据是否新鲜
         */
        _isDataFresh(dataType, timestamp = null) {
            const updateTime = timestamp || this.dataState[dataType]?.lastUpdate;
            if (!updateTime) return false;
            
            return Date.now() - updateTime < this.options.cacheTimeout;
        }

        /**
         * 等待加载完成
         */
        async _waitForLoading(stateKey, timeout = 10000) {
            const startTime = Date.now();
            
            while (this.dataState[stateKey].loading) {
                if (Date.now() - startTime > timeout) {
                    throw new Error(`加载${stateKey}超时`);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            return Array.from(this.stores[stateKey].values());
        }

        /**
         * 开始自动同步
         */
        _startAutoSync() {
            if (this.syncTimer) return;
            
            this.syncTimer = setInterval(() => {
                this._performAutoSync();
            }, this.options.syncInterval);
            
            this.log('info', '自动同步已启动');
        }

        /**
         * 执行自动同步
         */
        async _performAutoSync() {
            try {
                // 只同步已加载的数据
                if (this.dataState.shops.loaded) {
                    await this.getShops(true);
                }
                
                this.log('debug', '自动同步完成');
            } catch (error) {
                this.log('error', '自动同步失败', error);
            }
        }

        /**
         * 停止自动同步
         */
        stopAutoSync() {
            if (this.syncTimer) {
                clearInterval(this.syncTimer);
                this.syncTimer = null;
                this.log('info', '自动同步已停止');
            }
        }

        /**
         * 清除缓存
         */
        clearCache() {
            Object.values(this.stores).forEach(store => store.clear());
            Object.keys(this.dataState).forEach(key => {
                this.dataState[key] = { loaded: false, loading: false, lastUpdate: null };
            });
            this.log('info', '缓存已清除');
        }

        /**
         * 获取统计信息
         */
        getStats() {
            return {
                stores: {
                    shops: this.stores.shops.size,
                    conversations: this.stores.conversations.size,
                    messages: this.stores.messages.size
                },
                state: this.dataState,
                subscribers: Array.from(this.subscribers.keys()).map(key => ({
                    type: key,
                    count: this.subscribers.get(key).size
                }))
            };
        }

        /**
         * 销毁实例
         */
        destroy() {
            this.stopAutoSync();
            this.clearCache();
            this.subscribers.clear();
            this.log('info', 'UnifiedDataManager已销毁');
        }
    }

    // 创建全局实例
    const globalDataManager = new UnifiedDataManager({
        debug: window.QT_CONFIG?.debug || false
    });

    // 暴露全局接口
    window.UnifiedDataManager = UnifiedDataManager;
    window.dataManager = globalDataManager;

    // 兼容性别名（向后兼容）
    window.DataSyncManager = globalDataManager;
    window.unifiedDataSyncManager = globalDataManager;
    window.mobileDataSyncManager = globalDataManager;

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('unified-data-manager', 'core', '统一数据管理器已加载 (UnifiedDataManager)');
    } else {
        console.log('✅ 统一数据管理器已加载 (UnifiedDataManager)');
    }

})();