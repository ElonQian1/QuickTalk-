/**
 * 统一工具库 - 整合所有重复的工具函数
 * 解决项目中工具函数重复实现的问题
 * 提供标准化的工具函数调用接口
 */
class UnifiedUtils {
    /**
     * 深拷贝对象 - 统一实现，替换所有重复的deepClone方法
     * @param {any} obj - 要拷贝的对象
     * @returns {any} 深拷贝后的对象
     */
    static deepClone(obj) {
        // 处理基本类型和null
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        // 处理Date对象
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        // 处理RegExp对象
        if (obj instanceof RegExp) {
            return new RegExp(obj);
        }
        
        // 处理数组
        if (Array.isArray(obj)) {
            return obj.map(item => UnifiedUtils.deepClone(item));
        }
        
        // 处理普通对象
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = UnifiedUtils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
        
        return obj;
    }

    /**
     * 防抖函数 - 统一实现
     * @param {Function} func - 要防抖的函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * 节流函数 - 统一实现
     * @param {Function} func - 要节流的函数
     * @param {number} delay - 节流间隔(ms)
     * @returns {Function} 节流后的函数
     */
    static throttle(func, delay) {
        let lastTime = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastTime >= delay) {
                lastTime = now;
                return func.apply(this, args);
            }
        };
    }

    /**
     * 复制文本到剪贴板 - 统一实现，替换所有copyCode方法
     * @param {string} text - 要复制的文本
     * @param {Element} button - 可选的按钮元素，用于显示反馈
     * @returns {Promise<boolean>} 复制是否成功
     */
    static async copyToClipboard(text, button = null) {
        try {
            // 优先使用现代API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                
                if (button) {
                    UnifiedUtils.showCopySuccess(button);
                }
                
                return true;
            } else {
                // 兼容性处理
                return UnifiedUtils.fallbackCopyText(text, button);
            }
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            
            // 尝试兼容性方法
            return UnifiedUtils.fallbackCopyText(text, button);
        }
    }

    /**
     * 兼容性复制文本方法
     * @param {string} text - 要复制的文本
     * @param {Element} button - 可选的按钮元素
     * @returns {boolean} 复制是否成功
     */
    static fallbackCopyText(text, button = null) {
        try {
            // 创建临时textarea
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            
            // 选择并复制
            textarea.select();
            textarea.setSelectionRange(0, 99999); // 移动端兼容
            const success = document.execCommand('copy');
            
            // 清理
            document.body.removeChild(textarea);
            
            if (success && button) {
                UnifiedUtils.showCopySuccess(button);
            }
            
            return success;
        } catch (error) {
            console.error('兼容性复制失败:', error);
            return false;
        }
    }

    /**
     * 显示复制成功状态 - 统一实现
     * @param {Element} button - 按钮元素
     * @param {number} duration - 显示持续时间(ms)
     */
    static showCopySuccess(button, duration = 2000) {
        if (!button) return;
        
        const originalText = button.textContent || button.innerHTML;
        const originalBg = button.style.background || '';
        const originalColor = button.style.color || '';
        
        // 显示成功状态
        button.textContent = '✅ 已复制';
        button.style.background = '#28a745';
        button.style.color = '#fff';
        
        // 恢复原状态
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = originalBg;
            button.style.color = originalColor;
        }, duration);
    }

    /**
     * 格式化时间 - 统一时间格式化方法
     * @param {Date|string|number} date - 日期
     * @param {string} format - 格式字符串
     * @returns {string} 格式化后的时间
     */
    static formatTime(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        
        if (isNaN(d.getTime())) {
            return '';
        }
        
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const seconds = d.getSeconds().toString().padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * 生成唯一ID - 统一ID生成方法
     * @param {string} prefix - ID前缀
     * @returns {string} 唯一ID
     */
    static generateId(prefix = 'id') {
        return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    }

    /**
     * 检查是否为空值
     * @param {any} value - 要检查的值
     * @returns {boolean} 是否为空
     */
    static isEmpty(value) {
        if (value === null || value === undefined) {
            return true;
        }
        
        if (typeof value === 'string') {
            return value.trim() === '';
        }
        
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        
        if (typeof value === 'object') {
            return Object.keys(value).length === 0;
        }
        
        return false;
    }

    /**
     * 安全的JSON解析
     * @param {string} jsonString - JSON字符串
     * @param {any} defaultValue - 默认值
     * @returns {any} 解析结果或默认值
     */
    static safeJsonParse(jsonString, defaultValue = null) {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('JSON解析失败:', error);
            return defaultValue;
        }
    }

    /**
     * 安全的JSON字符串化
     * @param {any} obj - 要字符串化的对象
     * @param {string} defaultValue - 默认值
     * @returns {string} JSON字符串或默认值
     */
    static safeJsonStringify(obj, defaultValue = '{}') {
        try {
            return JSON.stringify(obj);
        } catch (error) {
            console.warn('JSON字符串化失败:', error);
            return defaultValue;
        }
    }

    /**
     * 等待指定时间
     * @param {number} ms - 等待时间(毫秒)
     * @returns {Promise} Promise对象
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 下载文件 - 统一文件下载方法
     * @param {string} content - 文件内容
     * @param {string} filename - 文件名
     * @param {string} contentType - 内容类型
     */
    static downloadFile(content, filename, contentType = 'text/plain') {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 清理URL对象
        URL.revokeObjectURL(url);
    }

    /**
     * 获取文件扩展名
     * @param {string} filename - 文件名
     * @returns {string} 文件扩展名
     */
    static getFileExtension(filename) {
        if (!filename || typeof filename !== 'string') {
            return '';
        }
        
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex !== -1 ? filename.substring(lastDotIndex + 1).toLowerCase() : '';
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 验证邮箱格式
     * @param {string} email - 邮箱地址
     * @returns {boolean} 是否为有效邮箱
     */
    static isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * 验证URL格式
     * @param {string} url - URL地址
     * @returns {boolean} 是否为有效URL
     */
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 转义HTML字符
     * @param {string} str - 要转义的字符串
     * @returns {string} 转义后的字符串
     */
    static escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 移除HTML标签
     * @param {string} html - HTML字符串
     * @returns {string} 纯文本
     */
    static stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }
}

// 全局导出
window.UnifiedUtils = UnifiedUtils;

// 为了向后兼容，也创建Utils别名
if (!window.Utils) {
    window.Utils = UnifiedUtils;
}

// 导出模块（如果支持）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedUtils;
}