/**
 * UtilsBase - 工具函数基础类
 * 
 * 设计目标：
 * - 统一所有重复的工具函数（格式化、验证、转换等）
 * - 提供可扩展的工具函数管理机制
 * - 消除跨文件的函数重复定义
 * - 支持命名空间和版本管理
 */
(function() {
    'use strict';

    class UtilsBase {
        constructor() {
            this.version = '1.0.0';
            this.modules = new Map();
            
            // 注册核心模块
            this._registerCoreModules();
            
            console.log('✅ UtilsBase工具基础类已加载');
        }

        /**
         * 注册核心工具模块
         */
        _registerCoreModules() {
            this.registerModule('format', new FormatUtils());
            this.registerModule('validate', new ValidateUtils());
            this.registerModule('convert', new ConvertUtils());
            this.registerModule('dom', new DomUtils());
            this.registerModule('http', new HttpUtils());
        }

        /**
         * 注册工具模块
         */
        registerModule(name, moduleInstance) {
            this.modules.set(name, moduleInstance);
            console.log(`📦 工具模块已注册: ${name}`);
        }

        /**
         * 获取工具模块
         */
        getModule(name) {
            return this.modules.get(name);
        }

        /**
         * 获取所有模块
         */
        getAllModules() {
            const result = {};
            this.modules.forEach((module, name) => {
                result[name] = module;
            });
            return result;
        }
    }

    /**
     * 格式化工具模块
     */
    class FormatUtils {
        constructor() {
            this.name = 'FormatUtils';
        }

        /**
         * 格式化日期时间
         */
        formatDate(dateString, options = {}) {
            if (!dateString) return '未知';
            
            try {
                const date = new Date(dateString);
                const config = {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    ...options
                };
                
                return date.toLocaleDateString('zh-CN', config);
            } catch (error) {
                console.warn('日期格式化失败:', error);
                return dateString;
            }
        }

        /**
         * 格式化相对时间 (几分钟前、几小时前等)
         */
        formatTime(date) {
            if (!date) return '未知';
            
            const dateObj = (date instanceof Date) ? date : new Date(date);
            const now = new Date();
            const diff = now - dateObj;
            
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(diff / (1000 * 60));
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            
            if (seconds < 30) {
                return '刚刚';
            } else if (minutes < 1) {
                return `${seconds}秒前`;
            } else if (minutes < 60) {
                return `${minutes}分钟前`;
            } else if (hours < 24) {
                return `${hours}小时前`;
            } else if (days < 7) {
                return `${days}天前`;
            } else {
                return this.formatDate(date, { month: 'short', day: 'numeric' });
            }
        }

        /**
         * 格式化文件大小
         */
        formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            const k = 1024;
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
        }

        /**
         * 格式化数字
         */
        formatNumber(num, options = {}) {
            const config = {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
                ...options
            };
            
            return new Intl.NumberFormat('zh-CN', config).format(num);
        }

        /**
         * 格式化百分比
         */
        formatPercent(value, total = 100, decimals = 1) {
            if (total === 0) return '0%';
            const percent = (value / total) * 100;
            return `${percent.toFixed(decimals)}%`;
        }

        /**
         * 格式化货币
         */
        formatCurrency(amount, currency = 'CNY') {
            return new Intl.NumberFormat('zh-CN', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2
            }).format(amount);
        }

        /**
         * 截断文本
         */
        truncateText(text, maxLength = 50, suffix = '...') {
            if (!text || text.length <= maxLength) return text;
            return text.substring(0, maxLength - suffix.length) + suffix;
        }

        /**
         * 格式化手机号码
         */
        formatPhoneNumber(phone) {
            if (!phone) return '';
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 11) {
                return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
            }
            return phone;
        }
    }

    /**
     * 验证工具模块
     */
    class ValidateUtils {
        constructor() {
            this.name = 'ValidateUtils';
        }

        /**
         * 验证邮箱
         */
        isEmail(email) {
            const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return pattern.test(email);
        }

        /**
         * 验证手机号
         */
        isPhoneNumber(phone) {
            const pattern = /^1[3-9]\d{9}$/;
            return pattern.test(phone);
        }

        /**
         * 验证URL
         */
        isUrl(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }

        /**
         * 验证非空
         */
        isNotEmpty(value) {
            return value !== null && value !== undefined && value !== '';
        }

        /**
         * 验证数字范围
         */
        isInRange(value, min, max) {
            const num = Number(value);
            return !isNaN(num) && num >= min && num <= max;
        }

        /**
         * 验证文件类型
         */
        isValidFileType(file, allowedTypes) {
            if (!file || !allowedTypes) return false;
            return allowedTypes.includes(file.type);
        }

        /**
         * 验证文件大小
         */
        isValidFileSize(file, maxSizeInMB) {
            if (!file) return false;
            const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
            return file.size <= maxSizeInBytes;
        }
    }

    /**
     * 转换工具模块
     */
    class ConvertUtils {
        constructor() {
            this.name = 'ConvertUtils';
        }

        /**
         * 转换为数组
         */
        toArray(value) {
            if (Array.isArray(value)) return value;
            if (value === null || value === undefined) return [];
            return [value];
        }

        /**
         * 深拷贝对象
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }

        /**
         * 对象转查询字符串
         */
        objectToQueryString(obj) {
            const params = new URLSearchParams();
            Object.entries(obj).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    params.append(key, value);
                }
            });
            return params.toString();
        }

        /**
         * 查询字符串转对象
         */
        queryStringToObject(queryString) {
            const params = new URLSearchParams(queryString);
            const obj = {};
            params.forEach((value, key) => {
                obj[key] = value;
            });
            return obj;
        }

        /**
         * 驼峰转下划线
         */
        camelToSnake(str) {
            return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        }

        /**
         * 下划线转驼峰
         */
        snakeToCamel(str) {
            return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
        }
    }

    /**
     * DOM工具模块
     */
    class DomUtils {
        constructor() {
            this.name = 'DomUtils';
        }

        /**
         * 安全获取元素
         */
        $(selector, context = document) {
            return context.querySelector(selector);
        }

        /**
         * 获取所有匹配元素
         */
        $$(selector, context = document) {
            return Array.from(context.querySelectorAll(selector));
        }

        /**
         * 创建元素
         */
        createElement(tag, options = {}) {
            const element = document.createElement(tag);
            
            if (options.className) element.className = options.className;
            if (options.innerHTML) element.innerHTML = options.innerHTML;
            if (options.textContent) element.textContent = options.textContent;
            if (options.id) element.id = options.id;
            
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            
            if (options.styles) {
                Object.assign(element.style, options.styles);
            }
            
            return element;
        }

        /**
         * 检查元素是否在视口中
         */
        isInViewport(element) {
            const rect = element.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= window.innerHeight &&
                rect.right <= window.innerWidth
            );
        }

        /**
         * 滚动到元素
         */
        scrollToElement(element, options = {}) {
            const config = {
                behavior: 'smooth',
                block: 'center',
                ...options
            };
            element.scrollIntoView(config);
        }

        /**
         * 获取元素位置
         */
        getElementPosition(element) {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top + window.pageYOffset,
                left: rect.left + window.pageXOffset,
                width: rect.width,
                height: rect.height
            };
        }
    }

    /**
     * HTTP工具模块
     */
    class HttpUtils {
        constructor() {
            this.name = 'HttpUtils';
        }

        /**
         * 封装fetch请求
         */
        async request(url, options = {}) {
            const config = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                ...options
            };

            try {
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
                }

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                } else {
                    return await response.text();
                }
            } catch (error) {
                console.error('HTTP请求失败:', error);
                throw error;
            }
        }

        /**
         * GET请求
         */
        get(url, params = {}) {
            const queryString = new URLSearchParams(params).toString();
            const fullUrl = queryString ? `${url}?${queryString}` : url;
            return this.request(fullUrl);
        }

        /**
         * POST请求
         */
        post(url, data = {}) {
            return this.request(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        /**
         * PUT请求
         */
        put(url, data = {}) {
            return this.request(url, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        }

        /**
         * DELETE请求
         */
        delete(url) {
            return this.request(url, {
                method: 'DELETE'
            });
        }
    }

    // 创建全局实例
    const utilsInstance = new UtilsBase();

    // 暴露到全局作用域
    window.UtilsBase = UtilsBase;
    window.Utils = utilsInstance;

    // 兼容旧版API
    const formatModule = utilsInstance.getModule('format');
    window.formatDate = (date, options) => formatModule.formatDate(date, options);
    window.formatTime = (date) => formatModule.formatTime(date);
    window.formatFileSize = (bytes) => formatModule.formatFileSize(bytes);

    const validateModule = utilsInstance.getModule('validate');
    window.isEmail = (email) => validateModule.isEmail(email);
    window.isPhoneNumber = (phone) => validateModule.isPhoneNumber(phone);

    const httpModule = utilsInstance.getModule('http');
    window.httpGet = (url, params) => httpModule.get(url, params);
    window.httpPost = (url, data) => httpModule.post(url, data);

})();