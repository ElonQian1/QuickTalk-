/**
 * UIBase - UI组件基础类
 * 
 * 设计目标：
 * - 消除所有UI组件的重复DOM操作模式
 * - 统一组件生命周期、样式注入、事件处理
 * - 提供可重用的元素创建和管理方法
 * - 支持统一的调试和状态管理接口
 * 
 * 适用组件：
 * - Toast (轻通知)
 * - LoadingStates (加载态)
 * - EmptyStates (空状态)
 * - MessageBubble (消息气泡)
 * - 以及其他自定义UI组件
 */
(function() {
    'use strict';

    class UIBase {
        constructor(componentName, options = {}) {
            this.componentName = componentName;
            this.options = {
                debug: false,
                autoAttach: true,
                containerSelector: 'body',
                ...options
            };

            // 组件状态
            this.state = {
                mounted: false,
                destroyed: false,
                visible: true
            };

            // DOM元素管理
            this.elements = new Map();
            this.eventListeners = [];
            this.styleSheets = [];

            this.log('info', `UI组件 ${componentName} 初始化完成`);
        }

        /**
         * 统一日志记录
         */
        log(level, message, ...args) {
            if (!this.options.debug && level === 'debug') return;
            
            const timestamp = new Date().toLocaleTimeString();
            const prefix = `[${this.componentName}:${timestamp}]`;
            
            if (window.QT_LOG) {
                const fn = window.QT_LOG[level] || window.QT_LOG.info;
                fn(this.componentName.toLowerCase(), message, ...args);
            } else {
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 生成唯一ID (统一模式)
         */
        generateId(prefix = 'ui') {
            return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 创建DOM元素 (统一模式)
         */
        createElement(tag, options = {}) {
            const element = document.createElement(tag);
            
            if (options.className) {
                element.className = options.className;
            }
            
            if (options.innerHTML) {
                element.innerHTML = options.innerHTML;
            }
            
            if (options.textContent) {
                element.textContent = options.textContent;
            }
            
            if (options.styles) {
                this.applyStyles(element, options.styles);
            }
            
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            
            if (options.id) {
                element.id = options.id;
                this.elements.set(options.id, element);
            }
            
            return element;
        }

        /**
         * 批量创建DOM元素
         */
        createElements(elementConfigs) {
            const elements = {};
            
            Object.entries(elementConfigs).forEach(([key, config]) => {
                elements[key] = this.createElement(config.tag, {
                    id: key,
                    ...config
                });
            });
            
            return elements;
        }

        /**
         * 应用样式到元素
         */
        applyStyles(element, styles) {
            if (typeof styles === 'string') {
                element.style.cssText = styles;
            } else if (typeof styles === 'object') {
                Object.entries(styles).forEach(([property, value]) => {
                    element.style[property] = value;
                });
            }
        }

        /**
         * 注入CSS样式 (统一模式)
         */
        injectStyles(cssText, id = null) {
            const styleId = id || `${this.componentName}-styles`;
            
            // 检查是否已存在
            if (document.getElementById(styleId)) {
                this.log('debug', '样式已存在，跳过注入:', styleId);
                return;
            }
            
            const style = this.createElement('style', {
                id: styleId,
                textContent: cssText
            });
            
            document.head.appendChild(style);
            this.styleSheets.push(style);
            
            this.log('debug', '样式已注入:', styleId);
        }

        /**
         * 添加事件监听器 (统一管理)
         */
        addEventListener(element, eventType, handler, options = {}) {
            const wrappedHandler = (event) => {
                try {
                    handler.call(this, event);
                } catch (error) {
                    this.log('error', '事件处理器执行失败:', error);
                }
            };
            
            element.addEventListener(eventType, wrappedHandler, options);
            
            // 记录监听器，用于清理
            this.eventListeners.push({
                element,
                eventType,
                handler: wrappedHandler,
                options
            });
            
            return wrappedHandler;
        }

        /**
         * 查找或创建容器
         */
        ensureContainer(containerId, options = {}) {
            let container = document.getElementById(containerId);
            
            if (!container) {
                container = this.createElement('div', {
                    id: containerId,
                    ...options
                });
                
                const parent = document.querySelector(this.options.containerSelector);
                if (parent) {
                    parent.appendChild(container);
                } else {
                    document.body.appendChild(container);
                }
                
                this.log('info', '容器已创建:', containerId);
            }
            
            return container;
        }

        /**
         * 显示/隐藏元素
         */
        setVisible(element, visible) {
            if (visible) {
                element.style.display = '';
                element.removeAttribute('hidden');
            } else {
                element.style.display = 'none';
                element.setAttribute('hidden', '');
            }
        }

        /**
         * 淡入/淡出动画
         */
        fadeIn(element, duration = 300) {
            return new Promise(resolve => {
                element.style.opacity = '0';
                element.style.transition = `opacity ${duration}ms ease`;
                element.style.display = '';
                
                // 强制重排
                element.offsetHeight;
                
                element.style.opacity = '1';
                
                setTimeout(() => {
                    element.style.transition = '';
                    resolve();
                }, duration);
            });
        }

        fadeOut(element, duration = 300) {
            return new Promise(resolve => {
                element.style.transition = `opacity ${duration}ms ease`;
                element.style.opacity = '0';
                
                setTimeout(() => {
                    element.style.display = 'none';
                    element.style.transition = '';
                    resolve();
                }, duration);
            });
        }

        /**
         * 延迟执行
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 获取组件状态
         */
        getState() {
            return {
                ...this.state,
                elementCount: this.elements.size,
                listenerCount: this.eventListeners.length,
                styleSheetCount: this.styleSheets.length
            };
        }

        /**
         * 挂载组件
         */
        mount() {
            if (this.state.mounted) {
                this.log('warn', '组件已挂载');
                return;
            }
            
            this.state.mounted = true;
            this.log('info', '组件已挂载');
        }

        /**
         * 卸载组件
         */
        unmount() {
            if (!this.state.mounted) {
                this.log('warn', '组件未挂载');
                return;
            }
            
            this.state.mounted = false;
            this.log('info', '组件已卸载');
        }

        /**
         * 销毁组件
         */
        destroy() {
            if (this.state.destroyed) {
                this.log('warn', '组件已销毁');
                return;
            }
            
            // 清理事件监听器
            this.eventListeners.forEach(({ element, eventType, handler, options }) => {
                element.removeEventListener(eventType, handler, options);
            });
            this.eventListeners = [];
            
            // 清理样式表
            this.styleSheets.forEach(style => {
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            });
            this.styleSheets = [];
            
            // 清理DOM元素
            this.elements.forEach(element => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
            });
            this.elements.clear();
            
            this.state.destroyed = true;
            this.log('info', '组件已销毁');
        }
    }

    // 工厂函数
    function createUIComponent(componentName, options) {
        return new UIBase(componentName, options);
    }

    // 暴露到全局
    window.UIBase = UIBase;
    window.createUIComponent = createUIComponent;

    // 注册到模块系统
    if (window.registerModule) {
        window.registerModule('UIBase', UIBase);
        window.registerModule('createUIComponent', createUIComponent);
    }

    console.log('✅ UI基础类已加载 (UIBase)');

})();