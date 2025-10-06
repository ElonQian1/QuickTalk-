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
                enableBatching: true,
                batchDelay: 100,
                ...options
            };

            // 使用统一的fetch工具，消除重复的缓存和重试逻辑
            this.fetch = window.unifiedFetch || new (window.UnifiedFetch || class MockFetch {
                async get() { throw new Error('UnifiedFetch未加载'); }
                async post() { throw new Error('UnifiedFetch未加载'); }
                async put() { throw new Error('UnifiedFetch未加载'); }
                async delete() { throw new Error('UnifiedFetch未加载'); }
            })();

            // 批量请求队列（UnifiedFetch不处理的特殊功能）
            this.batchQueue = new Map();
            this.batchTimer = null;

            // 简化的统计信息（大部分由UnifiedFetch处理）
            this.stats = {
                batchesSent: 0,
                batchedRequests: 0
            };

            // 使用统一日志系统
            this.logger = window.getLogger ? window.getLogger('ApiManager', { enableDebug: this.options.debug }) : null;

            this.log('info', T('API_MANAGER_INIT', 'API管理器初始化完成'));
        }

        /**
         * 统一日志记录 - 使用 UnifiedLogger（简化版）
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
         * 通用API请求方法（委托给UnifiedFetch）
         */
        async request(url, options = {}) {
            const method = options.method || 'GET';
            
            try {
                switch (method.toUpperCase()) {
                    case 'GET':
                        return await this.fetch.get(url, options);
                    case 'POST':
                        return await this.fetch.post(url, options.body ? JSON.parse(options.body) : {}, options);
                    case 'PUT':
                        return await this.fetch.put(url, options.body ? JSON.parse(options.body) : {}, options);
                    case 'DELETE':
                        return await this.fetch.delete(url, options);
                    default:
                        return await this.fetch.fetch(url, options);
                }
            } catch (error) {
                this.log('error', `API请求失败 ${method} ${url}:`, error.message);
                throw error;
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
         * 清除缓存（委托给UnifiedFetch）
         */
        clearCache(pattern = null) {
            if (this.fetch && this.fetch.clearCache) {
                this.fetch.clearCache();
                this.log('info', T('CACHE_CLEARED_DELEGATED', '缓存清理已委托给UnifiedFetch'));
            }
        }

        /**
         * 获取统计信息（合并UnifiedFetch的统计）
         */
        getStats() {
            const fetchStats = this.fetch.getStats ? this.fetch.getStats() : {};
            return {
                ...this.stats,
                ...fetchStats,
                batchQueueSize: this.batchQueue.size
            };
        }

        /**
         * 调试信息
         */
        debug() {
            console.group('🔍 UnifiedApiManager调试信息');
            console.log('📊 统计信息:', this.getStats());
            console.log('� 批量队列:', Array.from(this.batchQueue.keys()));
            if (this.fetch.debug) {
                console.log('🌐 UnifiedFetch调试:');
                this.fetch.debug();
            }
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
            const headers = window.AuthHelper ? window.AuthHelper.getHeaders() : 
                          { 'Authorization': localStorage.getItem('authToken') || '' };
            return globalApiManager.request('/api/shops', { headers });
        },

        /**
         * 获取对话列表（带缓存）
         */
        async getConversations(shopId, forceRefresh = false) {
            const url = `/api/conversations?shop_id=${shopId}`;
            if (forceRefresh) {
                globalApiManager.clearCache(url);
            }
            const headers = window.AuthHelper ? window.AuthHelper.getHeaders() : 
                          { 'Authorization': localStorage.getItem('authToken') || '' };
            return globalApiManager.request(url, { headers });
        },

        /**
         * 获取消息列表（带缓存）
         */
        async getMessages(conversationId, forceRefresh = false) {
            const url = `/api/conversations/${conversationId}/messages`;
            if (forceRefresh) {
                globalApiManager.clearCache(url);
            }
            const headers = window.AuthHelper ? window.AuthHelper.getHeaders() : 
                          { 'Authorization': localStorage.getItem('authToken') || '' };
            return globalApiManager.request(url, { headers });
        },

        /**
         * 发送消息（不缓存）
         */
        async sendMessage(data) {
            const headers = window.AuthHelper ? window.AuthHelper.getHeaders() : 
                          { 
                              'Authorization': localStorage.getItem('authToken') || '',
                              'Content-Type': 'application/json'
                          };
            return globalApiManager.request('/api/send', {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
        },

        /**
         * 批量获取店铺统计（实验性）
         */
        async getBatchShopStats(shopIds) {
            const headers = window.AuthHelper ? window.AuthHelper.getHeaders() : 
                          { 'Authorization': localStorage.getItem('authToken') || '' };
            const requests = shopIds.map(id => ({
                url: `/api/shops/${id}/stats`,
                options: { headers }
            }));
            return globalApiManager.batchRequest(requests);
        }
    };

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('unified-api-manager', 'core', '统一API管理器已加载 (UnifiedApiManager)');
    } else {
        console.log('✅ 统一API管理器已加载 (UnifiedApiManager)');
    }

})();