/**
 * GlobalUtils - 全局工具库
 * 职责：统一管理重复的工具函数，避免各模块重复实现
 * 包含：认证、提示、HTTP请求、格式化等通用功能
 */
(function() {
    'use strict';

    class GlobalUtils {
        constructor() {
            this.initialized = false;
        }

        /**
         * 初始化全局工具
         */
        init() {
            if (this.initialized) return;
            
            // 注册全局方法
            this.registerGlobalMethods();
            
            this.initialized = true;
            console.log('✅ 全局工具库已初始化 (global-utils.js)');
        }

        /**
         * 注册全局方法到window对象
         */
        registerGlobalMethods() {
            // 认证相关
            if (!window.getAuthToken) {
                window.getAuthToken = this.getAuthToken.bind(this);
            }
            if (!window.getAuthHeaders) {
                window.getAuthHeaders = this.getAuthHeaders.bind(this);
            }

            // 提示相关
            if (!window.showToast) {
                window.showToast = this.showToast.bind(this);
            }

            // HTTP请求相关
            if (!window.safeRequest) {
                window.safeRequest = this.safeRequest.bind(this);
            }

            // 格式化相关
            if (!window.formatTime) {
                window.formatTime = this.formatTime.bind(this);
            }
            if (!window.formatRelativeTime) {
                window.formatRelativeTime = this.formatRelativeTime.bind(this);
            }
            if (!window.formatFileSize) {
                window.formatFileSize = this.formatFileSize.bind(this);
            }

            // JSON安全处理
            if (!window.safeJson) {
                window.safeJson = this.safeJson.bind(this);
            }
        }

        // ===== 认证相关 =====

        /**
         * 获取认证token
         */
        getAuthToken() {
            // 优先从AuthHelper获取
            if (window.AuthHelper && typeof window.AuthHelper.getToken === 'function') {
                return window.AuthHelper.getToken();
            }

            // 降级：从localStorage/sessionStorage获取
            return localStorage.getItem('authToken') || 
                   localStorage.getItem('auth_token') || 
                   sessionStorage.getItem('authToken') || 
                   sessionStorage.getItem('auth_token') || 
                   '';
        }

        /**
         * 获取认证头部
         */
        getAuthHeaders() {
            // 优先从AuthHelper获取
            if (window.AuthHelper && typeof window.AuthHelper.getHeaders === 'function') {
                return window.AuthHelper.getHeaders();
            }

            // 降级：手动构建
            const token = this.getAuthToken();
            return {
                'Authorization': `Bearer ${token}`,
                'X-Session-Id': token,  // 后端SessionExtractor需要这个头
                'Content-Type': 'application/json'
            };
        }

        // ===== 提示相关 =====

        /**
         * 显示提示消息
         */
        showToast(message, type = 'info') {
            // 优先使用Notify组件
            if (window.Notify && typeof window.Notify.show === 'function') {
                try {
                    window.Notify.show(message, type);
                    return;
                } catch (e) {
                    console.warn('[GlobalUtils] Notify组件错误:', e);
                }
            }

            // 降级：使用Toast UI
            if (window.Toast && typeof window.Toast.show === 'function') {
                try {
                    window.Toast.show(message, type);
                    return;
                } catch (e) {
                    console.warn('[GlobalUtils] Toast UI错误:', e);
                }
            }

            // 最终降级：console + alert
            console.log(`[Toast ${type}] ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }

        // ===== HTTP请求相关 =====

        /**
         * 安全的HTTP请求
         */
        async safeRequest(url, options = {}) {
            const {
                retry = 0,
                retryDelay = 300,
                transform,
                expectedStatus = 200,
                silent = false,
                ...fetchOpts
            } = options;
            let attempt = 0;

            const exec = async () => {
                const finalOptions = {
                    headers: this.getAuthHeaders(),
                    ...fetchOpts
                };
                const resp = await fetch(url, finalOptions);
                let json;
                try { json = await resp.json(); } catch(_) { json = {}; }

                if (resp.status === 401) {
                    if (!silent) this.showToast('登录已过期，请重新登录', 'error');
                    this.redirectToLogin();
                    throw { code: 401, message: 'Unauthorized', response: resp, data: json };
                }
                if (resp.status !== expectedStatus && !json.success) {
                    const err = { code: resp.status, message: json.error || '请求失败', response: resp, data: json };
                    throw err;
                }
                const data = transform ? transform(json) : json;
                return data;
            };

            while (true) {
                try {
                    return await exec();
                } catch (err) {
                    attempt++;
                    if (attempt > retry) {
                        if (!silent) this.showToast(err.message || '网络错误', 'error');
                        console.error('[GlobalUtils] safeRequest 最终失败', url, err);
                        throw err;
                    }
                    await this.delay(retryDelay * attempt);
                }
            }
        }

        /**
         * 重定向到登录页
         */
        redirectToLogin() {
            setTimeout(() => {
                if (window.location.pathname.includes('/mobile/')) {
                    window.location.href = '/mobile/login';
                } else {
                    window.location.href = '/login';
                }
            }, 1000);
        }

        // ===== 格式化相关 =====

        /**
         * 格式化时间
         */
        formatTime(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            
            return date.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }

        /**
         * 格式化相对时间
         */
        formatRelativeTime(timestamp) {
            if (!timestamp) return '';
            
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            
            const now = new Date();
            const diff = now - date;
            
            if (diff < 60000) return '刚刚';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
            
            return date.toLocaleDateString('zh-CN');
        }

        /**
         * 格式化文件大小
         */
        formatFileSize(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            
            return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
        }

        // ===== JSON处理相关 =====

        /**
         * 安全的JSON解析
         */
        safeJson(str, defaultValue = null) {
            try {
                return JSON.parse(str);
            } catch (e) {
                console.warn('[GlobalUtils] JSON解析失败:', e);
                return defaultValue;
            }
        }

        /**
         * 安全的JSON字符串化
         */
        safeStringify(obj, defaultValue = '{}') {
            try {
                return JSON.stringify(obj);
            } catch (e) {
                console.warn('[GlobalUtils] JSON字符串化失败:', e);
                return defaultValue;
            }
        }

        // ===== 工具方法 =====

        /**
         * 防抖函数
         */
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        /**
         * 节流函数
         */
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        /**
         * 延迟函数
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 生成唯一ID
         */
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        /**
         * HTML转义
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * 检查是否为移动设备
         */
        isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        /**
         * 获取查询参数
         */
        getQueryParam(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        }

        /**
         * 设置查询参数
         */
        setQueryParam(name, value) {
            const url = new URL(window.location);
            url.searchParams.set(name, value);
            window.history.replaceState({}, '', url);
        }
    }

    // 创建全局实例
    const globalUtils = new GlobalUtils();
    
    // 暴露到全局
    window.GlobalUtils = GlobalUtils;
    window.globalUtils = globalUtils;
    
    // 自动初始化
    globalUtils.init();

    console.log('✅ 全局工具库已加载 (global-utils.js)');

})();