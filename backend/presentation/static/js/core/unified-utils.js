/**
 * 统一工具函数库 - 消除工具函数重复代码
 * 
 * 设计目标:
 * 1. 统一所有重复的工具函数，避免多处实现相同逻辑
 * 2. 提供标准化的API接口和一致的行为
 * 3. 支持模块化导入和全局访问
 * 4. 集成现有的工具函数，保持向下兼容
 * 
 * 这个工具库将替代各文件中的重复工具函数：
 * - utils-base.js 中的各种工具方法
 * - messages-manager-clean.js 中的 escapeHtml、formatTime
 * - template-renderer.js 中的 HTML转义
 * - 各个组件中重复的验证、格式化函数
 */

class UnifiedUtils {
    constructor() {
        this.name = 'UnifiedUtils';
        this.version = '1.0.0';
        
        // 缓存机制
        this._cache = new Map();
        this._cacheEnabled = true;
        this._maxCacheSize = 1000;
        
        // 性能监控
        this._performanceMarks = new Map();
        
        this._initializeGlobalFunctions();
    }

    // === 内部辅助方法 - 消除重复验证逻辑 ===
    
    /**
     * 通用字符串验证
     */
    _validateString(value, returnEmpty = true) {
        if (!value) return returnEmpty ? '' : false;
        if (typeof value !== 'string') {
            return returnEmpty ? String(value) : false;
        }
        return value;
    }

    /**
     * 通用非空验证
     */
    _validateRequired(value, type = 'string') {
        if (!value) return false;
        if (type === 'string' && typeof value !== 'string') return false;
        return true;
    }

    // === 字符串处理工具 ===

    /**
     * HTML转义 - 统一实现
     */
    escapeHtml(text) {
        const validText = this._validateString(text);
        if (!validText) return '';
        
        // 缓存检查
        const cacheKey = `escape:${validText}`;
        if (this._cacheEnabled && this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }
        
        const escaped = validText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
            
        this._setCache(cacheKey, escaped);
        return escaped;
    }

    /**
     * 反转义HTML
     */
    unescapeHtml(text) {
        const validText = this._validateString(text);
        if (!validText) return '';
        
        return validText
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    /**
     * 截断文本
     */
    truncateText(text, maxLength = 50, suffix = '...') {
        const validText = this._validateString(text);
        if (!validText || validText.length <= maxLength) return validText;
        return validText.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * 首字母大写
     */
    capitalize(text) {
        const validText = this._validateString(text);
        if (!validText) return '';
        return validText.charAt(0).toUpperCase() + validText.slice(1).toLowerCase();
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

    // === 时间处理工具 ===

    /**
     * 统一时间格式化
     */
    formatTime(timestamp, format = 'HH:mm') {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        
        const cacheKey = `time:${timestamp}:${format}`;
        if (this._cacheEnabled && this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }
        
        const formatters = {
            YYYY: date.getFullYear(),
            MM: String(date.getMonth() + 1).padStart(2, '0'),
            DD: String(date.getDate()).padStart(2, '0'),
            HH: String(date.getHours()).padStart(2, '0'),
            mm: String(date.getMinutes()).padStart(2, '0'),
            ss: String(date.getSeconds()).padStart(2, '0')
        };
        
        let result = format;
        for (const [token, value] of Object.entries(formatters)) {
            result = result.replace(new RegExp(token, 'g'), value);
        }
        
        this._setCache(cacheKey, result);
        return result;
    }

    /**
     * 格式化日期时间
     */
    formatDateTime(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
        return this.formatTime(timestamp, format);
    }

    /**
     * 相对时间格式化
     */
    formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        
        return this.formatTime(timestamp, 'MM-DD HH:mm');
    }

    // === 防抖节流工具 ===

    /**
     * 防抖函数 - 统一实现
     */
    debounce(func, delay = 300, immediate = false) {
        let timeoutId;
        let lastArgs;
        
        const debounced = function(...args) {
            lastArgs = args;
            
            const callNow = immediate && !timeoutId;
            
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                timeoutId = null;
                if (!immediate) {
                    func.apply(this, lastArgs);
                }
            }, delay);
            
            if (callNow) {
                func.apply(this, args);
            }
        };
        
        debounced.cancel = () => {
            clearTimeout(timeoutId);
            timeoutId = null;
        };
        
        debounced.flush = function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                func.apply(this, lastArgs);
                timeoutId = null;
            }
        };
        
        return debounced;
    }

    /**
     * 节流函数 - 统一实现
     */
    throttle(func, delay = 300, options = {}) {
        let lastCall = 0;
        let timeoutId = null;
        
        const {
            leading = true,
            trailing = true
        } = options;
        
        return function(...args) {
            const now = Date.now();
            
            if (!lastCall && !leading) {
                lastCall = now;
            }
            
            const remaining = delay - (now - lastCall);
            
            if (remaining <= 0 || remaining > delay) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                lastCall = now;
                func.apply(this, args);
            } else if (!timeoutId && trailing) {
                timeoutId = setTimeout(() => {
                    lastCall = leading ? Date.now() : 0;
                    timeoutId = null;
                    func.apply(this, args);
                }, remaining);
            }
        };
    }

    // === 验证工具 ===

    /**
     * 邮箱验证 - 统一实现
     */
    validateEmail(email) {
        if (!this._validateRequired(email, 'string')) return false;
        
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email.trim());
    }

    /**
     * 手机号验证
     */
    validatePhone(phone) {
        if (!this._validateRequired(phone, 'string')) return false;
        
        const cleaned = phone.replace(/\D/g, '');
        const regex = /^1[3-9]\d{9}$/;
        return regex.test(cleaned);
    }

    /**
     * URL验证 - 统一实现
     */
    validateUrl(url) {
        if (!this._validateRequired(url, 'string')) return false;
        
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 域名验证
     */
    validateDomain(domain) {
        if (!this._validateRequired(domain, 'string')) return false;
        
        const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        return regex.test(domain);
    }

    /**
     * 身份证验证
     */
    validateIdCard(idCard) {
        if (!this._validateRequired(idCard, 'string')) return false;
        
        const regex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
        return regex.test(idCard);
    }

    // === 对象处理工具 ===

    /**
     * 深拷贝 - 统一实现
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof RegExp) return new RegExp(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        return obj;
    }

    /**
     * 对象扁平化
     */
    flatten(obj, prefix = '', separator = '.') {
        const flattened = {};
        
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}${separator}${key}` : key;
                
                if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    Object.assign(flattened, this.flatten(obj[key], newKey, separator));
                } else {
                    flattened[newKey] = obj[key];
                }
            }
        }
        
        return flattened;
    }

    /**
     * 对象合并
     */
    mergeDeep(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();

        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.mergeDeep(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }

        return this.mergeDeep(target, ...sources);
    }

    // === 数组处理工具 ===

    /**
     * 数组去重
     */
    unique(array, key = null) {
        if (!Array.isArray(array)) return [];
        
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const val = item[key];
                if (seen.has(val)) return false;
                seen.add(val);
                return true;
            });
        }
        
        return [...new Set(array)];
    }

    /**
     * 数组分组
     */
    groupBy(array, key) {
        if (!Array.isArray(array)) return {};
        
        return array.reduce((groups, item) => {
            const group = typeof key === 'function' ? key(item) : item[key];
            if (!groups[group]) groups[group] = [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    /**
     * 数组分块
     */
    chunk(array, size = 1) {
        if (!Array.isArray(array) || size < 1) return [];
        
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    // === 数字处理工具 ===

    /**
     * 数字格式化
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
     * 货币格式化
     */
    formatCurrency(amount, currency = 'CNY') {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    /**
     * 文件大小格式化
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
    }

    // === ID生成工具 ===

    /**
     * 生成唯一ID
     */
    generateId(prefix = '', length = 8) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, length);
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * 生成UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // === 本地存储工具 ===

    /**
     * 安全的本地存储
     */
    storage = {
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('存储失败:', error);
                return false;
            }
        },
        
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('读取存储失败:', error);
                return defaultValue;
            }
        },
        
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('删除存储失败:', error);
                return false;
            }
        },
        
        clear: () => {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('清空存储失败:', error);
                return false;
            }
        }
    };

    // === 设备检测工具 ===

    /**
     * 设备类型检测
     */
    device = {
        isMobile: () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        isTablet: () => /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent),
        isDesktop: () => !this.device.isMobile() && !this.device.isTablet(),
        getScreenSize: () => ({
            width: window.innerWidth,
            height: window.innerHeight
        })
    };

    // === 工具方法 ===

    /**
     * 检查是否为对象
     */
    isObject(obj) {
        return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
    }

    /**
     * 检查是否为空值
     */
    isEmpty(value) {
        if (value === null || value === undefined || value === '') return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * 类型检查
     */
    getType(value) {
        return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    }

    // === 性能监控工具 ===

    /**
     * 性能计时开始
     */
    timeStart(label) {
        this._performanceMarks.set(label, performance.now());
    }

    /**
     * 性能计时结束
     */
    timeEnd(label) {
        const startTime = this._performanceMarks.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            this._performanceMarks.delete(label);
            console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return null;
    }

    // === 缓存管理 ===

    /**
     * 设置缓存
     */
    _setCache(key, value) {
        if (!this._cacheEnabled) return;
        
        // 限制缓存大小
        if (this._cache.size >= this._maxCacheSize) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        
        this._cache.set(key, value);
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this._cache.clear();
    }

    /**
     * 启用/禁用缓存
     */
    setCacheEnabled(enabled) {
        this._cacheEnabled = enabled;
        if (!enabled) {
            this.clearCache();
        }
    }

    // === 全局函数初始化 ===

    /**
     * 初始化全局函数（向下兼容）
     */
    _initializeGlobalFunctions() {
        // 为常用函数创建全局别名
        window.escapeHtml = this.escapeHtml.bind(this);
        window.formatTime = this.formatTime.bind(this);
        window.formatDateTime = this.formatDateTime.bind(this);
        window.debounce = this.debounce.bind(this);
        window.throttle = this.throttle.bind(this);
        window.generateId = this.generateId.bind(this);
        window.deepClone = this.deepClone.bind(this);
        
        // 兼容旧的Utils对象
        if (!window.Utils) {
            window.Utils = this;
        } else {
            // 扩展现有的Utils
            Object.assign(window.Utils, this);
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            version: this.version,
            cacheSize: this._cache.size,
            cacheEnabled: this._cacheEnabled,
            performanceMarks: this._performanceMarks.size
        };
    }

    /**
     * 销毁工具库
     */
    destroy() {
        this.clearCache();
        this._performanceMarks.clear();
    }
}

// 创建全局单例
window.UnifiedUtils = new UnifiedUtils();

// 创建模块化导出
export default UnifiedUtils;