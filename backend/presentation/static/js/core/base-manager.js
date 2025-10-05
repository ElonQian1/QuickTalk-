/**
 * BaseManager - 业务管理器基类
 * 
 * 设计目标：
 * - 消除所有业务管理器中的重复代码
 * - 统一错误处理、日志记录、状态管理模式
 * - 提供可重用的API调用和数据加载模式
 * - 支持依赖注入和事件驱动架构
 * - 集成TemplateRenderer进行统一DOM渲染
 * 
 * 使用方式：
 * ```javascript
 * class ShopsManager extends BaseManager {
 *     constructor(options) {
 *         super('ShopsManager', options);
 *     }
 *     
 *     async loadShops() {
 *         return this.apiCall('/api/shops', {
 *             successCallback: (data) => {
 *                 this.shops = this.filterActiveShops(data);
 *                 this.options.onShopsLoaded?.(this.shops);
 *             }
 *         });
 *     }
 * }
 * ```
 */
(function() {
    'use strict';
    
    // 确保TemplateRenderer可用
    if (!window.TemplateRenderer) {
        console.warn('[BaseManager] TemplateRenderer未加载，将回退到原生DOM操作');
    }

    class BaseManager {
        constructor(managerName, options = {}) {
            this.managerName = managerName;
            this.options = {
                debug: false,
                retryCount: 2,
                timeout: 30000,
                ...options
            };
            
            // 初始化统一日志器
            this.logger = window.Loggers?.BaseManager || window.UnifiedLogger?.createModuleLogger(managerName) || {
                debug: (...args) => console.log(`[${managerName}]`, ...args),
                info: (...args) => console.info(`[${managerName}]`, ...args),
                warn: (...args) => console.warn(`[${managerName}]`, ...args),
                error: (...args) => console.error(`[${managerName}]`, ...args)
            };
            
            // 统一状态管理
            this.state = {
                loading: false,
                error: null,
                initialized: false,
                lastUpdate: null
            };
            
            // 事件系统
            this.eventBus = options.eventBus || window.MessageEventBus || null;
            
            // 请求缓存（避免重复请求）
            this._requestCache = new Map();
            this._requestPromises = new Map();
        }

        /**
         * 统一日志记录 (使用UnifiedLogger)
         */
        log(level, message, ...args) {
            if (this.logger && this.logger[level]) {
                this.logger[level](message, ...args);
            } else if (this.logger && this.logger.log) {
                // 兼容旧格式
                this.logger.log(level, message, ...args);
            } else {
                // 回退到原始实现
                if (!this.options.debug && level === 'debug') return;
                
                const timestamp = new Date().toLocaleTimeString();
                const prefix = `[${this.managerName}:${timestamp}]`;
                
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 发布事件
         */
        emit(eventName, data) {
            if (this.eventBus) {
                this.eventBus.emit(eventName, data);
            }
            
            // 调用对应的回调选项
            const callbackName = 'on' + eventName.charAt(0).toUpperCase() + eventName.slice(1);
            if (typeof this.options[callbackName] === 'function') {
                this.options[callbackName](data);
            }
        }

        /**
         * 获取APIClient实例
         */
        getApiClient() {
            if (!this._apiClient) {
                // 确保APIClient可用
                if (typeof window.apiClient === 'undefined') {
                    throw new Error('APIClient未初始化，请确保api-client.js已加载');
                }
                this._apiClient = window.apiClient;
            }
            return this._apiClient;
        }

        /**
         * 统一的API调用方法 (优化版 - 使用APIClient)
         */
        async apiCall(url, options = {}) {
            const {
                method = 'GET',
                data = null,
                body = null,
                useCache = true,
                cacheTimeout = 5 * 60 * 1000, // 5分钟缓存
                successCallback = null,
                errorCallback = null,
                loadingMessage = '正在加载...',
                headers = {}
            } = options;

            // 生成缓存键
            const requestData = body || data;
            const cacheKey = `${method}:${url}:${JSON.stringify(requestData)}`;
            
            // 检查缓存
            if (useCache && method === 'GET') {
                const cached = this._requestCache.get(cacheKey);
                if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
                    this.log('debug', '使用缓存数据:', url);
                    if (successCallback) successCallback(cached.data);
                    return cached.data;
                }
            }

            // 防止重复请求
            if (this._requestPromises.has(cacheKey)) {
                this.log('debug', '等待现有请求:', url);
                return this._requestPromises.get(cacheKey);
            }

            this.state.loading = true;
            this.state.error = null;
            this.log('info', `开始API调用: ${method} ${url}`);

            // 使用APIClient执行请求
            const apiClient = this.getApiClient();
            
            const requestPromise = this._executeApiCallWithClient(apiClient, url, method, requestData, headers);
            this._requestPromises.set(cacheKey, requestPromise);

            try {
                const apiResult = await requestPromise;
                
                // APIClient返回的是已解析的数据，无需再解析
                this.log('debug', 'API响应:', apiResult);

                // 检查响应格式
                let data;
                if (apiResult && typeof apiResult === 'object' && apiResult.hasOwnProperty('success')) {
                    // 标准API响应格式
                    if (apiResult.success) {
                        data = apiResult.data;
                    } else {
                        const error = apiResult.error || apiResult.message || ((window.StateTexts && window.StateTexts.API_GENERIC_FAIL) || 'API调用失败');
                        this.state.error = error;
                        this.log('error', 'API返回错误:', error);
                        if (errorCallback) errorCallback(error);
                        return null;
                    }
                } else {
                    // 直接数据响应
                    data = apiResult;
                }
                
                // 缓存成功的GET请求
                if (useCache && method === 'GET' && data !== null) {
                    this._requestCache.set(cacheKey, {
                        data,
                        timestamp: Date.now()
                    });
                }
                
                this.state.lastUpdate = Date.now();
                if (successCallback) successCallback(data);
                
                this.log('info', 'API调用成功');
                return data;

            } catch (error) {
                // APIClient已经处理了认证错误等情况
                const errorMessage = error.message || ((window.StateTexts && window.StateTexts.API_GENERIC_FAIL) || 'API调用失败');
                this.state.error = errorMessage;
                this.log('error', 'API调用错误:', errorMessage);
                if (errorCallback) errorCallback(errorMessage);
                return null;
            } finally {
                this.state.loading = false;
                this._requestPromises.delete(cacheKey);
            }
        }

        /**
         * 使用APIClient执行API调用
         */
        async _executeApiCallWithClient(apiClient, url, method, data, extraHeaders = {}) {
            const requestOptions = {
                headers: extraHeaders
            };

            // 根据HTTP方法调用相应的APIClient方法
            switch (method.toLowerCase()) {
                case 'get':
                    return await apiClient.get(url, data || {});
                    
                case 'post':
                    return await apiClient.post(url, data || {});
                    
                case 'put':
                    return await apiClient.put(url, data || {});
                    
                case 'delete':
                    return await apiClient.delete(url);
                    
                case 'patch':
                    return await apiClient.patch(url, data || {});
                    
                default:
                    // 使用通用request方法
                    return await apiClient.request(url, {
                        method: method.toUpperCase(),
                        body: data,
                        headers: extraHeaders
                    });
            }
        }

        /**
         * 清理缓存
         */
        clearCache() {
            this._requestCache.clear();
            this.log('info', '缓存已清理');
        }

        /**
         * 统一的UI状态管理 (增强TemplateRenderer支持)
         */
        updateUI(containerId, content, className = '') {
            const container = document.getElementById(containerId);
            if (!container) {
                this.log('warn', `容器 ${containerId} 不存在`);
                return;
            }

            // 使用TemplateRenderer进行渲染
            if (window.TemplateRenderer && (content.template || content.type)) {
                if (content.type) {
                    // 状态UI渲染
                    const stateElement = window.TemplateRenderer.createStateUI(content.type, content.options || {});
                    container.innerHTML = '';
                    container.appendChild(stateElement);
                } else if (content.template) {
                    // 模板渲染
                    window.TemplateRenderer.renderToContainer(container, content);
                }
            } else {
                // 传统渲染方式
                if (typeof content === 'string') {
                    container.innerHTML = content;
                } else if (content instanceof Element) {
                    container.innerHTML = '';
                    container.appendChild(content);
                }
            }

            if (className) {
                container.className = className;
            }
        }

        /**
         * 便捷的模板渲染方法
         */
        renderTemplate(template, data = {}, options = {}) {
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.renderTemplate(template, data, options);
            }
            
            // 简单的插值回退
            return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return data[key] !== undefined ? data[key] : match;
            });
        }

        /**
         * 便捷的列表渲染方法
         */
        renderList(items, itemTemplate, options = {}) {
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.renderList(items, itemTemplate, options);
            }
            
            // 简单的列表渲染回退
            if (!Array.isArray(items)) return '';
            return items.map(item => this.renderTemplate(itemTemplate, item)).join('');
        }

        /**
         * 便捷的DOM创建方法
         */
        createElement(tag, options = {}) {
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.createElement(tag, options);
            }
            
            // 回退到原生DOM创建
            const element = document.createElement(tag);
            if (options.className) element.className = options.className;
            if (options.innerHTML) element.innerHTML = options.innerHTML;
            if (options.textContent) element.textContent = options.textContent;
            if (options.id) element.id = options.id;
            return element;
        }

        /**
         * 生成加载状态UI (使用TemplateRenderer)
         */
        createLoadingUI(message = '正在加载...') {
            // 统一改用 UnifiedLoading 以避免重复 spinner DOM
            if (window.UnifiedLoading) {
                // 创建一个容器元素并挂载 inline load (不直接替换调用方结构)
                const wrapper = document.createElement('span');
                const key = 'inline-temp-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
                // 先占位，稍后 show inline 替换 wrapper 内容
                setTimeout(() => {
                    // 使用 wrapper 自身作为 target
                    window.UnifiedLoading.show({ scope: 'inline', key, target: wrapper, text: message });
                }, 0);
                return wrapper;
            }
            // 回退：仍保留 TemplateRenderer 或旧实现
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.createStateUI('loading', { message });
            }
            const div = document.createElement('div');
            div.className = 'loading-state';
            div.innerHTML = `<div class="loading-spinner"></div><div class="loading-message">${message}</div>`;
            return div;
        }

        /**
         * 生成错误状态UI (统一迁移至 UnifiedState)
         */
        createErrorUI(message = '加载失败', retryCallback = null) {
            // 首选：UnifiedState (新统一实现)
            if (window.UnifiedState && typeof window.UnifiedState.show === 'function') {
                const container = document.createElement('div');
                const key = 'bm-error-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
                window.UnifiedState.show({
                    type: 'error',
                    key,
                    target: container,
                    message,
                    retry: retryCallback || undefined
                });
                return container.firstChild || container; // 返回实际状态节点
            }

            // 次选：旧 EmptyStatesUI (兼容层或旧组件)
            if (window.EmptyStatesUI && typeof window.EmptyStatesUI.error === 'function') {
                return window.EmptyStatesUI.error(message, retryCallback);
            }

            // 再次：TemplateRenderer 模板化渲染
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.createStateUI('error', {
                    message,
                    showRetry: !!retryCallback,
                    retryCallback
                });
            }

            // 最后：原生 DOM 回退
            const div = document.createElement('div');
            div.className = 'error-state';
            div.innerHTML = `
                <div class="error-message">${message}</div>
                ${retryCallback ? '<button class="retry-btn">重试</button>' : ''}
            `;
            if (retryCallback) {
                const btn = div.querySelector('.retry-btn');
                if (btn) btn.addEventListener('click', e => { try { retryCallback(e); } catch(err){ console.error(err); } });
            }
            return div;
        }

        /**
         * 生成空状态UI (统一迁移至 UnifiedState)
         */
        createEmptyUI(message = '暂无数据', actionText = '', actionCallback = null) {
            // 首选：UnifiedState (新统一实现)
            if (window.UnifiedState && typeof window.UnifiedState.show === 'function') {
                const container = document.createElement('div');
                const key = 'bm-empty-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
                window.UnifiedState.show({
                    type: 'empty',
                    key,
                    target: container,
                    message,
                    action: (actionText && actionCallback) ? { text: actionText, onClick: actionCallback } : undefined
                });
                return container.firstChild || container;
            }

            // 次选：旧 EmptyStatesUI
            if (window.EmptyStatesUI && typeof window.EmptyStatesUI.empty === 'function') {
                return window.EmptyStatesUI.empty(message, actionText, actionCallback);
            }

            // 再次：TemplateRenderer
            if (window.TemplateRenderer) {
                return window.TemplateRenderer.createStateUI('empty', {
                    message,
                    showAction: !!(actionText && actionCallback),
                    actionText,
                    actionCallback
                });
            }

            // 最后：原生 DOM 回退
            const div = document.createElement('div');
            div.className = 'empty-state';
            div.innerHTML = `
                <div class="empty-message">${message}</div>
                ${actionText && actionCallback ? `<button class="empty-action-btn">${actionText}</button>` : ''}
            `;
            if (actionText && actionCallback) {
                const btn = div.querySelector('.empty-action-btn');
                if (btn) btn.addEventListener('click', e => { try { actionCallback(e); } catch(err){ console.error(err); } });
            }
            return div;
        }

        /**
         * 销毁管理器
         */
        destroy() {
            this.clearCache();
            this._requestPromises.clear();
            this.state = null;
            this.options = null;
            this.log('info', '管理器已销毁');
        }
    }

    // 暴露到全局
    window.BaseManager = BaseManager;

    console.log('✅ BaseManager 基础管理器类已加载');

})();