/**
 * 全局工具库 - 消除重复代码的基础工具函数
 * 优先级最高，为所有其他模块提供基础工具
 */
(function() {
    'use strict';

    const GlobalUtils = {
        /**
         * 防抖函数
         */
        debounce(func, wait, immediate = false) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    timeout = null;
                    if (!immediate) func.apply(this, args);
                };
                const callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(this, args);
            };
        },

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
        },

        /**
         * 深度克隆对象
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            if (typeof obj === 'object') {
                const clonedObj = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        clonedObj[key] = this.deepClone(obj[key]);
                    }
                }
                return clonedObj;
            }
        },

        /**
         * 安全的JSON解析
         */
        safeJsonParse(str, defaultValue = null) {
            try {
                return JSON.parse(str);
            } catch (e) {
                console.warn('[GlobalUtils] JSON解析失败:', e);
                return defaultValue;
            }
        },

        /**
         * 生成UUID
         */
        generateUUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        /**
         * 格式化时间
         */
        formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
            if (!date) return '';
            const d = new Date(date);
            if (isNaN(d.getTime())) return '';

            const formatMap = {
                'YYYY': d.getFullYear(),
                'MM': String(d.getMonth() + 1).padStart(2, '0'),
                'DD': String(d.getDate()).padStart(2, '0'),
                'HH': String(d.getHours()).padStart(2, '0'),
                'mm': String(d.getMinutes()).padStart(2, '0'),
                'ss': String(d.getSeconds()).padStart(2, '0')
            };

            return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => formatMap[match]);
        },

        /**
         * 相对时间格式化（如：刚刚、5分钟前）
         */
        formatRelativeTime(date) {
            if (!date) return '';
            const now = new Date();
            const target = new Date(date);
            const diff = now.getTime() - target.getTime();

            if (diff < 60000) return '刚刚';
            if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
            if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
            if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
            
            return this.formatTime(date, 'MM-DD HH:mm');
        },

        /**
         * DOM工具 - 安全获取元素
         */
        $(selector, context = document) {
            return context.querySelector(selector);
        },

        $$(selector, context = document) {
            return Array.from(context.querySelectorAll(selector));
        },

        /**
         * 事件工具 - 统一事件处理
         */
        on(element, event, handler, options = false) {
            if (element && typeof element.addEventListener === 'function') {
                element.addEventListener(event, handler, options);
            }
        },

        off(element, event, handler, options = false) {
            if (element && typeof element.removeEventListener === 'function') {
                element.removeEventListener(event, handler, options);
            }
        },

        /**
         * 数据验证工具
         */
        isValidEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        isValidPhone(phone) {
            const phoneRegex = /^1[3-9]\d{9}$/;
            return phoneRegex.test(phone);
        },

        /**
         * URL工具
         */
        getQueryParam(name) {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        },

        setQueryParam(name, value) {
            const url = new URL(window.location);
            url.searchParams.set(name, value);
            window.history.replaceState({}, '', url);
        },

        /**
         * 存储工具
         */
        storage: {
            set(key, value, isSession = false) {
                try {
                    const storage = isSession ? sessionStorage : localStorage;
                    storage.setItem(key, JSON.stringify(value));
                } catch (e) {
                    console.warn('[GlobalUtils] 存储写入失败:', e);
                }
            },

            get(key, defaultValue = null, isSession = false) {
                try {
                    const storage = isSession ? sessionStorage : localStorage;
                    const value = storage.getItem(key);
                    return value ? JSON.parse(value) : defaultValue;
                } catch (e) {
                    console.warn('[GlobalUtils] 存储读取失败:', e);
                    return defaultValue;
                }
            },

            remove(key, isSession = false) {
                try {
                    const storage = isSession ? sessionStorage : localStorage;
                    storage.removeItem(key);
                } catch (e) {
                    console.warn('[GlobalUtils] 存储删除失败:', e);
                }
            }
        },

        /**
         * 异步工具
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        async retry(fn, maxAttempts = 3, delay = 1000) {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    if (attempt === maxAttempts) throw error;
                    await this.sleep(delay * attempt);
                }
            }
        },

        /**
         * 数组工具
         */
        unique(array, key) {
            if (!key) return [...new Set(array)];
            
            const seen = new Set();
            return array.filter(item => {
                const value = typeof key === 'function' ? key(item) : item[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        },

        groupBy(array, key) {
            return array.reduce((groups, item) => {
                const value = typeof key === 'function' ? key(item) : item[key];
                if (!groups[value]) groups[value] = [];
                groups[value].push(item);
                return groups;
            }, {});
        }
    };

    // 全局暴露
    window.GlobalUtils = GlobalUtils;
    window.Utils = GlobalUtils; // 向后兼容

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('global-utils', 'utils', 'GlobalUtils 已加载');
    } else {
        console.log('✅ GlobalUtils 已加载');
    }
})();