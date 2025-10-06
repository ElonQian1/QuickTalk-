/**
 * UnifiedFetch - 统一HTTP请求工具
 * 
 * 目标：合并UnifiedApiManager和UnifiedDataManager的重复功能
 * - 统一缓存策略  
 * - 统一错误处理
 * - 统一请求去重
 * - 统一重试机制
 * - 统一日志记录
 */
(function() {
    'use strict';

    // 防止重复初始化
    if (window.UnifiedFetch) {
        console.warn('⚠️ UnifiedFetch已存在，跳过重复初始化');
        return;
    }

    class UnifiedFetch {
        constructor(options = {}) {
            this.options = {
                debug: false,
                cacheTimeout: 30000, // 30秒缓存
                maxRetries: 3,
                retryDelay: 1000,
                enableCache: true,
                enableDuplicatePrevention: true,
                ...options
            };

            // 统一缓存存储
            this.cache = new Map();
            
            // 请求去重 - 防止相同请求并发
            this.pendingRequests = new Map();
            
            // 统计信息
            this.stats = {
                total: 0,
                cacheHits: 0,
                cacheMisses: 0,
                duplicatesPrevented: 0,
                retries: 0,
                errors: 0
            };

            this.log('info', 'UnifiedFetch初始化完成');
        }

        /**
         * 统一日志方法
         */
        log(level, ...args) {
            if (!this.options.debug && level === 'debug') return;
            
            const prefix = '[UnifiedFetch]';
            const method = console[level] || console.log;
            method(prefix, ...args);
        }

        /**
         * 生成缓存键
         */
        _getCacheKey(url, options = {}) {
            const method = options.method || 'GET';
            const body = options.body || '';
            return `${method}:${url}:${typeof body === 'string' ? body : JSON.stringify(body)}`;
        }

        /**
         * 检查缓存
         */
        _getFromCache(cacheKey) {
            if (!this.options.enableCache) return null;
            
            const cached = this.cache.get(cacheKey);
            if (!cached) return null;

            const now = Date.now();
            if (now - cached.timestamp > this.options.cacheTimeout) {
                this.cache.delete(cacheKey);
                return null;
            }

            this.stats.cacheHits++;
            this.log('debug', '缓存命中:', cacheKey);
            return cached.data;
        }

        /**
         * 设置缓存
         */
        _setCache(cacheKey, data) {
            if (!this.options.enableCache) return;
            
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
            this.log('debug', '缓存已设置:', cacheKey);
        }

        /**
         * 统一fetch方法
         */
        async fetch(url, options = {}) {
            this.stats.total++;
            
            const cacheKey = this._getCacheKey(url, options);
            
            // 检查缓存
            const cached = this._getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            this.stats.cacheMisses++;

            // 检查是否有相同请求正在进行
            if (this.options.enableDuplicatePrevention && this.pendingRequests.has(cacheKey)) {
                this.stats.duplicatesPrevented++;
                this.log('debug', '请求去重:', cacheKey);
                return await this.pendingRequests.get(cacheKey);
            }

            // 执行请求
            const requestPromise = this._doFetch(url, options, cacheKey);
            
            if (this.options.enableDuplicatePrevention) {
                this.pendingRequests.set(cacheKey, requestPromise);
            }

            try {
                const result = await requestPromise;
                this._setCache(cacheKey, result);
                return result;
            } finally {
                if (this.options.enableDuplicatePrevention) {
                    this.pendingRequests.delete(cacheKey);
                }
            }
        }

        /**
         * 实际fetch执行（带重试）
         */
        async _doFetch(url, options, cacheKey) {
            let lastError;
            
            for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
                try {
                    this.log('debug', `请求 [${attempt + 1}/${this.options.maxRetries + 1}]:`, url);
                    
                    const response = await fetch(url, {
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
                    this.log('debug', '请求成功:', url);
                    return data;
                    
                } catch (error) {
                    lastError = error;
                    this.stats.errors++;
                    
                    this.log('warn', `请求失败 [${attempt + 1}/${this.options.maxRetries + 1}]:`, error.message);
                    
                    // 最后一次尝试时不再等待
                    if (attempt < this.options.maxRetries) {
                        this.stats.retries++;
                        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
                    }
                }
            }

            throw lastError;
        }

        /**
         * GET请求快捷方法
         */
        async get(url, options = {}) {
            return await this.fetch(url, { ...options, method: 'GET' });
        }

        /**
         * POST请求快捷方法
         */
        async post(url, data, options = {}) {
            return await this.fetch(url, {
                ...options,
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        /**
         * PUT请求快捷方法
         */
        async put(url, data, options = {}) {
            return await this.fetch(url, {
                ...options,
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }

        /**
         * DELETE请求快捷方法
         */
        async delete(url, options = {}) {
            return await this.fetch(url, { ...options, method: 'DELETE' });
        }

        /**
         * 清理缓存
         */
        clearCache() {
            this.cache.clear();
            this.log('info', '缓存已清理');
        }

        /**
         * 获取统计信息
         */
        getStats() {
            return { ...this.stats };
        }

        /**
         * 调试信息
         */
        debug() {
            console.group('🌐 UnifiedFetch调试信息');
            console.log('📊 统计信息:', this.getStats());
            console.log('💾 缓存大小:', this.cache.size);
            console.log('⏳ 待处理请求:', this.pendingRequests.size);
            console.groupEnd();
        }

        /**
         * 销毁实例
         */
        destroy() {
            this.clearCache();
            this.pendingRequests.clear();
            this.log('info', 'UnifiedFetch已销毁');
        }
    }

    // 创建全局实例
    const globalUnifiedFetch = new UnifiedFetch({
        debug: window.QT_CONFIG?.debug || false
    });

    // 注册到window
    window.UnifiedFetch = UnifiedFetch;
    window.unifiedFetch = globalUnifiedFetch;

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('unified-fetch', 'core', '统一HTTP请求工具已加载 (UnifiedFetch)');
    } else {
        console.log('✅ 统一HTTP请求工具已加载 (UnifiedFetch)');
    }

})();