/**
 * 统一剪贴板工具 - 消除复制功能重复代码
 * 
 * 设计目标:
 * 1. 统一所有复制到剪贴板的功能，支持现代和传统API
 * 2. 提供一致的用户体验和错误处理
 * 3. 支持多种复制场景：文本、代码、链接等
 * 4. 集成视觉反馈和状态管理
 * 
 * 这个工具将替代各文件中的重复复制实现：
 * - integration-code-modal.js 中的集成代码复制
 * - promotion-modal.js 中的推广链接复制
 * - promotion.js 中的推广功能复制
 * - message-actions.js 中的消息复制
 */

class UnifiedClipboard {
    constructor() {
        this.name = 'UnifiedClipboard';
        this.version = '1.0.0';
        
        // 配置选项
        this.config = {
            // 默认成功消息
            successMessage: '✅ 已复制到剪贴板',
            // 默认失败消息
            errorMessage: '❌ 复制失败，请手动复制',
            // 视觉反馈持续时间
            feedbackDuration: 2000,
            // 是否显示控制台日志
            enableLogging: true,
            // 是否自动选择文本
            autoSelect: true
        };
        
        // 状态管理
        this.state = {
            isSupported: this._checkSupport(),
            lastCopyTime: null,
            copyCount: 0
        };
        
        this._initializeClipboard();
    }

    // === 核心复制方法 ===

    /**
     * 通用复制文本方法
     * @param {string} text - 要复制的文本
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 复制是否成功
     */
    async copyText(text, options = {}) {
        if (!text) {
            this._logError('复制内容为空');
            return false;
        }

        const config = { ...this.config, ...options };
        
        try {
            // 优先使用现代 Clipboard API
            if (this.state.isSupported.modern) {
                await navigator.clipboard.writeText(text);
                this._handleSuccess(config);
                return true;
            }
            
            // 降级使用传统方法
            if (this.state.isSupported.legacy) {
                return this._copyTextLegacy(text, config);
            }
            
            // 都不支持
            this._handleError(new Error('浏览器不支持复制功能'), config);
            return false;
            
        } catch (error) {
            this._logError('现代API复制失败，尝试传统方法', error);
            
            // 现代API失败时尝试传统方法
            if (this.state.isSupported.legacy) {
                return this._copyTextLegacy(text, config);
            }
            
            this._handleError(error, config);
            return false;
        }
    }

    /**
     * 复制表单元素内容
     * @param {HTMLElement} element - 表单元素
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 复制是否成功
     */
    async copyFromElement(element, options = {}) {
        if (!element) {
            this._logError('复制元素不存在');
            return false;
        }

        const text = this._getElementText(element);
        if (!text) {
            this._logError('元素内容为空');
            return false;
        }

        // 自动选择文本
        if (options.autoSelect !== false && this.config.autoSelect) {
            this._selectElement(element);
        }

        return await this.copyText(text, options);
    }

    /**
     * 复制代码内容（带格式保持）
     * @param {string} code - 代码内容
     * @param {string} language - 编程语言
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 复制是否成功
     */
    async copyCode(code, language = '', options = {}) {
        if (!code) {
            this._logError('代码内容为空');
            return false;
        }

        const config = {
            ...options,
            successMessage: options.successMessage || `✅ ${language || '代码'}已复制到剪贴板`,
            enableMetadata: true
        };

        // 为代码添加元数据注释
        let formattedCode = code;
        if (config.enableMetadata && language) {
            const timestamp = new Date().toLocaleString('zh-CN');
            formattedCode = `// 复制时间: ${timestamp}\n// 语言: ${language}\n\n${code}`;
        }

        return await this.copyText(formattedCode, config);
    }

    /**
     * 复制链接地址
     * @param {string} url - 链接地址
     * @param {string} title - 链接标题
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 复制是否成功
     */
    async copyLink(url, title = '', options = {}) {
        if (!url) {
            this._logError('链接地址为空');
            return false;
        }

        const config = {
            ...options,
            successMessage: options.successMessage || '✅ 链接已复制到剪贴板'
        };

        // 格式化链接内容
        let linkText = url;
        if (title && options.includeTitle !== false) {
            linkText = `${title}\n${url}`;
        }

        return await this.copyText(linkText, config);
    }

    /**
     * 复制表格数据
     * @param {Array} data - 表格数据
     * @param {Object} options - 配置选项
     * @returns {Promise<boolean>} - 复制是否成功
     */
    async copyTableData(data, options = {}) {
        if (!Array.isArray(data) || data.length === 0) {
            this._logError('表格数据为空');
            return false;
        }

        const format = options.format || 'tsv'; // tsv, csv, markdown
        let formattedData;

        switch (format) {
            case 'csv':
                formattedData = this._formatAsCSV(data);
                break;
            case 'markdown':
                formattedData = this._formatAsMarkdown(data);
                break;
            default: // tsv
                formattedData = this._formatAsTSV(data);
        }

        const config = {
            ...options,
            successMessage: options.successMessage || `✅ 表格数据已复制 (${format.toUpperCase()})`
        };

        return await this.copyText(formattedData, config);
    }

    // === 便捷方法 ===

    /**
     * 从按钮触发复制（常用场景）
     * @param {HTMLElement} button - 复制按钮
     * @param {string|HTMLElement} source - 复制源
     * @param {Object} options - 配置选项
     */
    async copyFromButton(button, source, options = {}) {
        if (!button || !source) {
            this._logError('按钮或复制源不存在');
            return false;
        }

        // 设置按钮状态
        const originalText = button.textContent;
        const originalStyle = button.style.cssText;
        
        try {
            // 显示加载状态
            button.disabled = true;
            button.textContent = '复制中...';

            let success;
            if (typeof source === 'string') {
                success = await this.copyText(source, options);
            } else {
                success = await this.copyFromElement(source, options);
            }

            if (success) {
                // 显示成功状态
                button.textContent = '✅ 已复制';
                button.style.background = '#28a745';
                button.style.color = '#fff';

                // 恢复按钮状态
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.cssText = originalStyle;
                    button.disabled = false;
                }, this.config.feedbackDuration);
            } else {
                // 恢复按钮状态
                button.textContent = originalText;
                button.style.cssText = originalStyle;
                button.disabled = false;
            }

            return success;
        } catch (error) {
            // 错误时恢复按钮状态
            button.textContent = originalText;
            button.style.cssText = originalStyle;
            button.disabled = false;
            throw error;
        }
    }

    /**
     * 批量复制（用于选择性复制）
     * @param {Array} items - 复制项目列表
     * @param {string} separator - 分隔符
     * @param {Object} options - 配置选项
     */
    async copyBatch(items, separator = '\n', options = {}) {
        if (!Array.isArray(items) || items.length === 0) {
            this._logError('批量复制项目为空');
            return false;
        }

        const combinedText = items.join(separator);
        const config = {
            ...options,
            successMessage: options.successMessage || `✅ 已复制 ${items.length} 项内容`
        };

        return await this.copyText(combinedText, config);
    }

    // === 内部辅助方法 ===

    /**
     * 检查浏览器支持情况
     */
    _checkSupport() {
        return {
            modern: !!(navigator.clipboard && navigator.clipboard.writeText),
            legacy: !!document.execCommand,
            secure: location.protocol === 'https:' || location.hostname === 'localhost'
        };
    }

    /**
     * 传统方法复制文本
     */
    _copyTextLegacy(text, config) {
        try {
            // 创建临时文本区域
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);

            // 选择并复制
            textarea.focus();
            textarea.select();
            textarea.setSelectionRange(0, textarea.value.length);

            const success = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (success) {
                this._handleSuccess(config);
                return true;
            } else {
                throw new Error('execCommand 复制失败');
            }
        } catch (error) {
            this._handleError(error, config);
            return false;
        }
    }

    /**
     * 获取元素文本内容
     */
    _getElementText(element) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return element.value;
        }
        return element.textContent || element.innerText || '';
    }

    /**
     * 选择元素文本
     */
    _selectElement(element) {
        try {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.focus();
                element.select();
                element.setSelectionRange(0, element.value.length);
            } else {
                const range = document.createRange();
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } catch (error) {
            this._logError('选择文本失败', error);
        }
    }

    /**
     * 处理复制成功
     */
    _handleSuccess(config) {
        this.state.lastCopyTime = Date.now();
        this.state.copyCount++;

        if (config.successMessage && !config.silent) {
            this._showMessage(config.successMessage, 'success');
        }

        if (this.config.enableLogging) {
            console.log('📋 复制成功:', config.successMessage);
        }

        // 触发自定义事件
        this._dispatchEvent('clipboard:success', {
            message: config.successMessage,
            timestamp: this.state.lastCopyTime
        });
    }

    /**
     * 处理复制错误
     */
    _handleError(error, config) {
        if (config.errorMessage && !config.silent) {
            this._showMessage(config.errorMessage, 'error');
        }

        if (this.config.enableLogging) {
            console.error('📋 复制失败:', error);
        }

        // 触发自定义事件
        this._dispatchEvent('clipboard:error', {
            error: error.message,
            message: config.errorMessage
        });
    }

    /**
     * 显示消息提示
     */
    _showMessage(message, type = 'info') {
        // 尝试使用已有的通知系统
        if (window.showToast && typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else if (window.UnifiedLogger) {
            window.UnifiedLogger.log('clipboard', message, { level: type });
        } else {
            // 降级使用 alert（在生产环境中应该避免）
            if (type === 'error') {
                alert(message);
            } else {
                console.log(message);
            }
        }
    }

    /**
     * 格式化数据为不同格式
     */
    _formatAsTSV(data) {
        return data.map(row => 
            Array.isArray(row) ? row.join('\t') : Object.values(row).join('\t')
        ).join('\n');
    }

    _formatAsCSV(data) {
        return data.map(row => {
            const values = Array.isArray(row) ? row : Object.values(row);
            return values.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        }).join('\n');
    }

    _formatAsMarkdown(data) {
        if (data.length === 0) return '';
        
        const headers = Array.isArray(data[0]) ? 
            data[0].map((_, i) => `列${i + 1}`) : 
            Object.keys(data[0]);
        
        let result = '| ' + headers.join(' | ') + ' |\n';
        result += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
        
        data.forEach(row => {
            const values = Array.isArray(row) ? row : Object.values(row);
            result += '| ' + values.join(' | ') + ' |\n';
        });
        
        return result;
    }

    /**
     * 派发自定义事件
     */
    _dispatchEvent(eventName, detail) {
        try {
            const event = new CustomEvent(eventName, { detail });
            document.dispatchEvent(event);
        } catch (error) {
            this._logError('派发事件失败', error);
        }
    }

    /**
     * 日志记录
     */
    _logError(message, error = null) {
        if (this.config.enableLogging) {
            console.error(`📋 [UnifiedClipboard] ${message}`, error || '');
        }
    }

    /**
     * 初始化剪贴板功能
     */
    _initializeClipboard() {
        if (this.config.enableLogging) {
            console.log('📋 UnifiedClipboard 初始化完成');
            console.log('📋 浏览器支持情况:', this.state.isSupported);
        }

        // 检查安全上下文
        if (!this.state.isSupported.secure && this.state.isSupported.modern) {
            console.warn('📋 非安全上下文，现代 Clipboard API 可能不可用');
        }

        // 绑定全局快捷键（可选）
        if (this.config.enableGlobalShortcuts) {
            this._bindGlobalShortcuts();
        }
    }

    // === 工具方法 ===

    /**
     * 获取剪贴板统计信息
     */
    getStats() {
        return {
            version: this.version,
            copyCount: this.state.copyCount,
            lastCopyTime: this.state.lastCopyTime,
            isSupported: this.state.isSupported
        };
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        this.state.copyCount = 0;
        this.state.lastCopyTime = null;
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// 创建全局单例
window.UnifiedClipboard = new UnifiedClipboard();

// 向下兼容的全局函数
window.copyToClipboard = (text, options) => window.UnifiedClipboard.copyText(text, options);
window.copyCode = (code, language, options) => window.UnifiedClipboard.copyCode(code, language, options);
window.copyFromElement = (element, options) => window.UnifiedClipboard.copyFromElement(element, options);

// 模块化导出
export default UnifiedClipboard;