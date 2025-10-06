/**
 * 统一API调用管理器 - UnifiedApiManager
 * 
 * 设计目标：
 * - 消除重复的API调用
 * - 提供智能缓存机制
 * - 统一错误处理和重试逻辑
 * - 防止并发重复请求
 * - 提供加载状态管理
 */
(function() {
    'use strict';

    // 检查是否已初始化
    if (window.UnifiedApiManager) {
        console.warn('⚠️ UnifiedApiManager已存在，跳过重复初始化');
        return;
    }

    const T = (k, f) => (typeof window.getText === 'function') ? window.getText(k, f) : ((window.StateTexts && window.StateTexts[k]) || f || k);

    class UnifiedApiManager {
        constructor(options = {}) {
            this.options = {
                debug: false,
                cacheTimeout: 30000, // 30秒缓存
                maxRetries: 3,
                retryDelay: 1000,
                enableBatching: true,
                ...options
            };

            // 缓存存储
            this.cache = new Map();
            
            // 正在进行的请求（防止重复请求）
            this.pendingRequests = new Map();
            
            // 批量请求队列
            this.batchQueue = new Map();
            this.batchTimer = null;

            // 统计信息
            this.stats = {
                cacheHits: 0,
                cacheMisses: 0,
                requestsMade: 0,
                requestsCached: 0,
                duplicatesPrevented: 0,
                batchesSent: 0
            };

            // 使用统一日志系统
            this.logger = window.getLogger ? window.getLogger('ApiManager', { enableDebug: this.options.debug }) : null;

            this.log('info', T('API_MANAGER_INIT', 'API管理器初始化完成'));
        }

        /**
         * 统一日志记录 - 使用 UnifiedLogger
         */
        log(level, message, ...args) {
            if (this.logger) {
                this.logger[level](message, ...args);
            } else {
                // 降级处理
                if (!this.options.debug && level === 'debug') return;
                const prefix = '[UnifiedApiManager]';
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 生成缓存键
         */
        _generateCacheKey(url, options = {}) {
            const method = options.method || 'GET';
            const body = options.body ? JSON.stringify(options.body) : '';
            const headers = options.headers ? JSON.stringify(options.headers) : '';
            return `${method}:${url}:${body}:${headers}`;
        }

        /**
         * 检查缓存是否有效
         */
        _isCacheValid(cacheEntry) {
            if (!cacheEntry) return false;
            return Date.now() - cacheEntry.timestamp < this.options.cacheTimeout;
        }

        /**
         * 获取缓存数据
         */
        _getFromCache(cacheKey) {
            const entry = this.cache.get(cacheKey);
            if (this._isCacheValid(entry)) {
                this.stats.cacheHits++;
                this.log('debug', T('CACHE_HIT', '缓存命中'), cacheKey);
                return entry.data;
            }
            
            if (entry) {
                this.cache.delete(cacheKey);
                this.log('debug', T('CACHE_EXPIRED', '缓存过期'), cacheKey);
            }
            
            this.stats.cacheMisses++;
            return null;
        }

        /**
         * 设置缓存数据
         */
        _setCache(cacheKey, data) {
            this.cache.set(cacheKey, {
                data: JSON.parse(JSON.stringify(data)), // 深拷贝
                timestamp: Date.now()
            });
            this.stats.requestsCached++;
            this.log('debug', T('CACHE_SET', '设置缓存'), cacheKey);
        }

        /**
         * 通用API请求方法
         */
        async request(url, options = {}) {
            const cacheKey = this._generateCacheKey(url, options);
            
            // 检查缓存（仅对GET请求缓存）
            const method = options.method || 'GET';
            if (method === 'GET') {
                const cached = this._getFromCache(cacheKey);
                if (cached) {
                    return cached;
                }
            }

            // 检查是否有相同的请求正在进行
            if (this.pendingRequests.has(cacheKey)) {
                this.stats.duplicatesPrevented++;
                this.log('debug', T('DUPLICATE_PREVENTED', '防止重复请求'), url);
                return this.pendingRequests.get(cacheKey);
            }

            // 执行请求
            const requestPromise = this._executeRequest(url, options);
            this.pendingRequests.set(cacheKey, requestPromise);

            try {
                const result = await requestPromise;
                
                // 缓存结果（仅GET请求且成功时）
                if (method === 'GET' && result && !result.error) {
                    this._setCache(cacheKey, result);
                }
                
                return result;
            } finally {
                this.pendingRequests.delete(cacheKey);
            }
        }

        /**
         * 执行实际的HTTP请求
         */
        async _executeRequest(url, options) {
            let lastError;
            
            for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
                try {
                    this.stats.requestsMade++;
                    this.log('debug', `${T('REQUEST_ATTEMPT', '请求尝试')} ${attempt}/${this.options.maxRetries}:`, url);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            ...options.headers
                        },
                        ...options
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    this.log('debug', T('REQUEST_SUCCESS', '请求成功'), url);
                    return data;
                    
                } catch (error) {
                    lastError = error;
                    this.log('warn', `${T('REQUEST_FAILED', '请求失败')} (${attempt}/${this.options.maxRetries}):`, url, error.message);
                    
                    // 最后一次尝试失败
                    if (attempt === this.options.maxRetries) {
                        break;
                    }
                    
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
                }
            }

            // 所有重试都失败
            this.log('error', T('REQUEST_FINAL_FAIL', '请求最终失败'), url, lastError);
            return { error: lastError.message, url };
        }

        /**
         * 批量请求（实验性功能）
         */
        async batchRequest(requests) {
            if (!this.options.enableBatching) {
                return Promise.all(requests.map(req => this.request(req.url, req.options)));
            }

            const batchId = Date.now().toString();
            this.batchQueue.set(batchId, requests);
            
            // 延迟执行批量请求，允许更多请求加入
            return new Promise((resolve) => {
                setTimeout(async () => {
                    const batchRequests = this.batchQueue.get(batchId) || [];
                    this.batchQueue.delete(batchId);
                    
                    this.stats.batchesSent++;
                    this.log('debug', T('BATCH_EXECUTE', '执行批量请求'), batchRequests.length);
                    
                    const results = await Promise.allSettled(
                        batchRequests.map(req => this.request(req.url, req.options))
                    );
                    
                    resolve(results.map(result => 
                        result.status === 'fulfilled' ? result.value : { error: result.reason }
                    ));
                }, 100);
            });
        }

        /**
         * 清除缓存
         */
        clearCache(pattern = null) {
            if (!pattern) {
                const cleared = this.cache.size;
                this.cache.clear();
                this.log('info', T('CACHE_CLEARED_ALL', '清空所有缓存'), { cleared });
                return;
            }

            const keysToDelete = [];
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach(key => this.cache.delete(key));
            this.log('info', T('CACHE_CLEARED_PATTERN', '清空匹配缓存'), { pattern, cleared: keysToDelete.length });
        }

        /**
         * 获取统计信息
         */
        getStats() {
            return {
                ...this.stats,
                cacheSize: this.cache.size,
                pendingRequests: this.pendingRequests.size,
                batchQueueSize: this.batchQueue.size,
                cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
            };
        }

        /**
         * 调试信息
         */
        debug() {
            console.group('🔍 UnifiedApiManager调试信息');
            console.log('📊 统计信息:', this.getStats());
            console.log('💾 缓存键列表:', Array.from(this.cache.keys()));
            console.log('⏳ 进行中的请求:', Array.from(this.pendingRequests.keys()));
            console.groupEnd();
        }
    }

    // 创建全局实例
    const globalApiManager = new UnifiedApiManager({
        debug: window.QT_CONFIG?.debug || false,
        cacheTimeout: 30000,
        maxRetries: 3
    });

    // 暴露全局接口
    window.UnifiedApiManager = UnifiedApiManager;
    window.apiManager = globalApiManager;

    /**
     * 高级API方法
     */
    window.ApiUtils = {
        /**
         * 获取店铺列表（带缓存）
         */
        async getShops(forceRefresh = false) {
            if (forceRefresh) {
                globalApiManager.clearCache('/api/shops');
            }
            return globalApiManager.request('/api/shops', {
                headers: { 'Authorization': localStorage.getItem('authToken') || '' }
            });
        },

        /**
         * 获取对话列表（带缓存）
         */
        async getConversations(shopId, forceRefresh = false) {
            const url = `/api/conversations?shop_id=${shopId}`;
            if (forceRefresh) {
                globalApiManager.clearCache(url);
            }
            return globalApiManager.request(url, {
                headers: { 'Authorization': localStorage.getItem('authToken') || '' }
            });
        },

        /**
         * 获取消息列表（带缓存）
         */
        async getMessages(conversationId, forceRefresh = false) {
            const url = `/api/conversations/${conversationId}/messages`;
            if (forceRefresh) {
                globalApiManager.clearCache(url);
            }
            return globalApiManager.request(url, {
                headers: { 'Authorization': localStorage.getItem('authToken') || '' }
            });
        },

        /**
         * 发送消息（不缓存）
         */
        async sendMessage(data) {
            return globalApiManager.request('/api/send', {
                method: 'POST',
                headers: { 
                    'Authorization': localStorage.getItem('authToken') || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        },

        /**
         * 批量获取店铺统计（实验性）
         */
        async getBatchShopStats(shopIds) {
            const requests = shopIds.map(id => ({
                url: `/api/shops/${id}/stats`,
                options: {
                    headers: { 'Authorization': localStorage.getItem('authToken') || '' }
                }
            }));
            return globalApiManager.batchRequest(requests);
        }
    };

    console.log('✅ 统一API管理器已加载 (UnifiedApiManager)');

})();