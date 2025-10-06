/**
 * APIClient - 统一的API调用客户端
 * 消除重复的fetch代码，提供统一的错误处理、认证和日志记录
 * 
 * 功能特性：
 * - 自动添加认证头
 * - 统一错误处理
 * - 请求/响应日志
 * - 重试机制
 * - 超时控制
 */
(function() {
    'use strict';

    class APIClient {
        constructor(options = {}) {
            this.baseURL = options.baseURL || '';
            this.timeout = options.timeout || 30000; // 30秒超时
            this.retryCount = options.retryCount || 2;
            this.debug = options.debug || false;

            // 使用统一日志系统
            this.logger = window.Loggers?.APIClient || {
                debug: (...args) => this._fallbackLog('debug', ...args),
                info: (...args) => this._fallbackLog('info', ...args),
                warn: (...args) => this._fallbackLog('warn', ...args),
                error: (...args) => this._fallbackLog('error', ...args)
            };

            // 默认请求头
            this.defaultHeaders = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            // 会话管理
            this.sessionId = null;
            this.authToken = null;

            this.logger.info('APIClient初始化完成');
        }

        /**
         * 降级日志输出
         */
        _fallbackLog(level, message, data = null) {
            if (!this.debug && level === 'debug') return;

            const prefix = `[APIClient]`;
            const timestamp = new Date().toISOString().substr(11, 8);
            
            switch (level) {
                case 'error':
                    console.error(`${prefix} ${timestamp} ❌`, message, data);
                    break;
                case 'warn':
                    console.warn(`${prefix} ${timestamp} ⚠️`, message, data);
                    break;
                case 'debug':
                    console.debug(`${prefix} ${timestamp} 🔍`, message, data);
                    break;
                default:
                    console.log(`${prefix} ${timestamp} ℹ️`, message, data);
            }
        }

        /**
         * 统一日志记录 (使用 UnifiedLogger)
         */
        log(level, message, data = null) {
            this.logger[level](message, data);
        }

        /**
         * 设置会话ID
         */
        setSessionId(sessionId) {
            this.sessionId = sessionId;
            this.log('debug', '会话ID已更新:', sessionId?.substring(0, 8) + '...');
        }

        /**
         * 设置认证令牌
         */
        setAuthToken(token) {
            this.authToken = token;
            this.log('debug', '认证令牌已更新');
        }

        /**
         * 获取认证头
         */
        getAuthHeaders() {
            const headers = {};

            // 会话ID认证
            if (this.sessionId) {
                headers['X-Session-Id'] = this.sessionId;
                headers['Authorization'] = `Bearer ${this.sessionId}`;
            }

            // 令牌认证
            if (this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            return headers;
        }

        /**
         * 构建完整URL
         */
        buildURL(endpoint) {
            if (endpoint.startsWith('http')) {
                return endpoint;
            }
            return this.baseURL + endpoint;
        }

        /**
         * 核心HTTP请求方法
         */
        async request(endpoint, options = {}) {
            const url = this.buildURL(endpoint);
            
            // 构建请求配置
            const config = {
                method: 'GET',
                ...options,
                headers: {
                    ...this.defaultHeaders,
                    ...this.getAuthHeaders(),
                    ...options.headers
                }
            };

            // 请求体处理
            if (config.body && typeof config.body === 'object' && config.method !== 'GET') {
                config.body = JSON.stringify(config.body);
            }

            this.log('debug', `${config.method} ${endpoint}`, {
                headers: config.headers,
                body: config.body
            });

            let lastError;
            
            // 重试机制
            for (let attempt = 0; attempt <= this.retryCount; attempt++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                    const response = await fetch(url, {
                        ...config,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    this.log('debug', `响应: ${response.status} ${response.statusText}`);

                    if (!response.ok) {
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        error.status = response.status;
                        error.response = response;
                        
                        // 尝试获取错误详情
                        try {
                            const errorData = await response.json();
                            error.data = errorData;
                            error.message = errorData.message || errorData.error || error.message;
                        } catch (e) {
                            // JSON解析失败，使用原错误信息
                        }

                        throw error;
                    }

                    // 解析响应
                    const contentType = response.headers.get('content-type');
                    let data;
                    
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        data = await response.text();
                    }

                    this.log('debug', '请求成功', data);
                    return data;

                } catch (error) {
                    lastError = error;

                    if (error.name === 'AbortError') {
                        this.log('error', '请求超时:', endpoint);
                        error.message = '请求超时';
                    } else if (error.status === 401 || error.status === 403) {
                        this.log('warn', ((window.StateTexts && window.StateTexts.AUTH_FAIL) || '认证失败') + ':', error.message);
                        this.handleAuthError();
                        throw error; // 认证错误不重试
                    } else if (attempt < this.retryCount) {
                        this.log('warn', `请求失败，重试 ${attempt + 1}/${this.retryCount}:`, error.message);
                        await this.delay(1000 * (attempt + 1)); // 递增延迟
                        continue;
                    }

                    this.log('error', ((window.StateTexts && window.StateTexts.API_GENERIC_FAIL) || '请求最终失败') + ':', error.message);
                    throw error;
                }
            }

            throw lastError;
        }

        /**
         * GET请求
         */
        async get(endpoint, params = {}) {
            let url = endpoint;
            
            // 添加查询参数
            if (Object.keys(params).length > 0) {
                const searchParams = new URLSearchParams();
                Object.keys(params).forEach(key => {
                    if (params[key] !== undefined && params[key] !== null) {
                        searchParams.append(key, params[key]);
                    }
                });
                url += (url.includes('?') ? '&' : '?') + searchParams.toString();
            }

            return this.request(url, { method: 'GET' });
        }

        /**
         * POST请求
         */
        async post(endpoint, data = {}) {
            return this.request(endpoint, {
                method: 'POST',
                body: data
            });
        }

        /**
         * PUT请求
         */
        async put(endpoint, data = {}) {
            return this.request(endpoint, {
                method: 'PUT',
                body: data
            });
        }

        /**
         * DELETE请求
         */
        async delete(endpoint) {
            return this.request(endpoint, {
                method: 'DELETE'
            });
        }

        /**
         * PATCH请求
         */
        async patch(endpoint, data = {}) {
            return this.request(endpoint, {
                method: 'PATCH',
                body: data
            });
        }

        /**
         * 处理认证错误
         */
        handleAuthError() {
            this.log('warn', '认证失败，清除本地会话');
            
            // 清除本地存储
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('sessionId');
                localStorage.removeItem('token');
                localStorage.removeItem('userInfo');
                localStorage.removeItem('currentUser');
            }

            // 重置客户端状态
            this.sessionId = null;
            this.authToken = null;

            // 触发认证失败事件
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('api:auth_failed', {
                    detail: { message: '登录已过期，请重新登录' }
                }));
            }
        }

        /**
         * 健康检查
         */
        async healthCheck() {
            try {
                const result = await this.get('/api/health');
                this.log('info', '服务器健康检查通过');
                return { healthy: true, data: result };
            } catch (error) {
                this.log('error', '服务器健康检查失败:', error.message);
                return { healthy: false, error: error.message };
            }
        }

        /**
         * 延迟工具函数
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 批量请求
         */
        async batch(requests) {
            this.log('info', `执行批量请求，数量: ${requests.length}`);
            
            const results = await Promise.allSettled(
                requests.map(req => this.request(req.endpoint, req.options))
            );

            return results.map((result, index) => ({
                success: result.status === 'fulfilled',
                data: result.status === 'fulfilled' ? result.value : null,
                error: result.status === 'rejected' ? result.reason.message : null,
                request: requests[index]
            }));
        }

        /**
         * 获取客户端状态
         */
        getStatus() {
            return {
                hasSession: !!this.sessionId,
                hasToken: !!this.authToken,
                baseURL: this.baseURL,
                timeout: this.timeout,
                retryCount: this.retryCount,
                debug: this.debug
            };
        }

        /**
         * 销毁客户端
         */
        destroy() {
            this.sessionId = null;
            this.authToken = null;
            this.log('info', 'APIClient已销毁');
        }
    }

    // 创建默认实例
    const defaultAPIClient = new APIClient({
        debug: false,
        timeout: 30000,
        retryCount: 2
    });

    // 自动设置会话ID
    if (typeof localStorage !== 'undefined') {
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
            defaultAPIClient.setSessionId(sessionId);
        }
    }

    // 暴露到全局
    window.APIClient = APIClient;
    window.apiClient = defaultAPIClient;

    // 注册到模块系统
    if (window.registerModule) {
        window.registerModule('APIClient', APIClient);
        window.registerModule('apiClient', defaultAPIClient);
    }

    console.log('✅ 统一API客户端已加载 (消除重复fetch代码)');

})();