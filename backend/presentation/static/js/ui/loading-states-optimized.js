/**
 * LoadingStates - 加载态组件
 * 继承自UIBase，专注于加载状态的显示和管理
 * 
 * 优化内容：
 * - 移除重复的DOM创建代码
 * - 使用UIBase提供的统一接口
 * - 增强加载态的功能和样式
 */
(function(){
    'use strict';

    // 检查UIBase依赖
    if (typeof window.UIBase !== 'function') {
        console.error('❌ LoadingStates组件依赖UIBase，但UIBase未定义。请确保ui-base.js在loading-states-optimized.js之前加载。');
        
        // 提供降级实现
        const fallbackAPI = {
            show: (container, options) => {
                if (container) {
                    container.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">加载中...</div>';
                }
            },
            hide: (container) => {
                if (container && container.querySelector && container.querySelector('.loading-state')) {
                    container.innerHTML = '';
                }
            },
            spinner: () => fallbackAPI.show,
            overlay: () => fallbackAPI.show,
            small: () => fallbackAPI.show,
            button: () => fallbackAPI.show,
            skeleton: () => console.log('📊 [LoadingStates Fallback] 骨架屏不可用'),
            showFullScreen: () => console.log('📊 [LoadingStates Fallback] 全局加载不可用'),
            hideFullScreen: () => console.log('📊 [LoadingStates Fallback] 全局加载隐藏'),
            attachTo: () => fallbackAPI.show,
            detachFrom: () => fallbackAPI.hide
        };
        
        // 统一API暴露（降级）
        exposeLoadingStatesAPI(fallbackAPI);
        console.log('⚠️ LoadingStates降级模式已启用（UIBase不可用）');
        return;
    }

    class LoadingStates extends UIBase {
        constructor(options = {}) {
            super('LoadingStates', {
                debug: false,
                defaultText: '正在加载...',
                ...options
            });

            // 注入样式
            this._injectLoadingStyles();
            
            this.log('info', 'LoadingStates组件初始化完成');
        }

        /**
         * 注入加载态样式
         */
        _injectLoadingStyles() {
            const styles = `
                .loading-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    color: #666;
                }
                
                .loading-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #3498db;
                    border-radius: 50%;
                    animation: loading-spin 1s linear infinite;
                    margin-bottom: 12px;
                }
                
                .loading-text {
                    font-size: 14px;
                    color: #666;
                    text-align: center;
                }
                
                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(255, 255, 255, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9998;
                }
                
                .loading-inline {
                    padding: 10px;
                    min-height: 60px;
                }
                
                .loading-small .loading-spinner {
                    width: 20px;
                    height: 20px;
                    border-width: 2px;
                    margin-bottom: 8px;
                }
                
                .loading-small .loading-text {
                    font-size: 12px;
                }
                
                @keyframes loading-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            
            this.injectStyles(styles);
        }

        /**
         * 创建加载态元素
         */
        spinner(text = null, options = {}) {
            const config = {
                size: 'normal', // normal, small
                type: 'inline', // inline, overlay
                className: '',
                ...options
            };

            const loadingText = text || this.options.defaultText;
            
            const elements = this.createElements({
                wrapper: {
                    tag: 'div',
                    className: `loading-state loading-${config.size} loading-${config.type} ${config.className}`.trim()
                },
                spinner: {
                    tag: 'div',
                    className: 'loading-spinner'
                },
                text: {
                    tag: 'div',
                    className: 'loading-text',
                    textContent: loadingText
                }
            });

            elements.wrapper.appendChild(elements.spinner);
            elements.wrapper.appendChild(elements.text);

            return elements.wrapper;
        }

        /**
         * 创建覆盖层加载态
         */
        overlay(text = null) {
            return this.spinner(text, { type: 'overlay' });
        }

        /**
         * 创建小尺寸加载态
         */
        small(text = null) {
            return this.spinner(text, { size: 'small' });
        }

        /**
         * 创建按钮加载态
         */
        button(text = '处理中...') {
            return this.spinner(text, { 
                size: 'small', 
                className: 'loading-button' 
            });
        }

        /**
         * 显示全屏加载态
         */
        showFullScreen(text = null) {
            const loadingElement = this.overlay(text);
            loadingElement.id = 'global-loading';
            
            document.body.appendChild(loadingElement);
            
            this.log('debug', '全屏加载态已显示');
            return loadingElement;
        }

        /**
         * 隐藏全屏加载态
         */
        hideFullScreen() {
            const loadingElement = document.getElementById('global-loading');
            if (loadingElement) {
                this.fadeOut(loadingElement, 200).then(() => {
                    if (loadingElement.parentNode) {
                        loadingElement.parentNode.removeChild(loadingElement);
                    }
                });
                
                this.log('debug', '全屏加载态已隐藏');
            }
        }

        /**
         * 为元素添加加载态
         */
        attachTo(element, text = null, options = {}) {
            if (!element) {
                this.log('warn', '目标元素不存在');
                return null;
            }

            const loadingElement = this.spinner(text, options);
            
            // 保存原始内容
            const originalContent = element.innerHTML;
            loadingElement.setAttribute('data-original-content', originalContent);
            
            // 替换内容
            element.innerHTML = '';
            element.appendChild(loadingElement);
            
            this.log('debug', '加载态已附加到元素');
            return loadingElement;
        }

        /**
         * 从元素移除加载态
         */
        detachFrom(element) {
            if (!element) return;

            const loadingElement = element.querySelector('.loading-state');
            if (loadingElement) {
                const originalContent = loadingElement.getAttribute('data-original-content');
                if (originalContent) {
                    element.innerHTML = originalContent;
                } else {
                    element.removeChild(loadingElement);
                }
                
                this.log('debug', '加载态已从元素移除');
            }
        }

        /**
         * 创建骨架屏
         */
        skeleton(config = {}) {
            const skeletonConfig = {
                lines: 3,
                showAvatar: false,
                ...config
            };

            const wrapper = this.createElement('div', {
                className: 'loading-skeleton'
            });

            if (skeletonConfig.showAvatar) {
                const avatar = this.createElement('div', {
                    className: 'skeleton-avatar'
                });
                wrapper.appendChild(avatar);
            }

            for (let i = 0; i < skeletonConfig.lines; i++) {
                const line = this.createElement('div', {
                    className: `skeleton-line ${i === skeletonConfig.lines - 1 ? 'short' : ''}`
                });
                wrapper.appendChild(line);
            }

            // 注入骨架屏样式
            this._injectSkeletonStyles();

            return wrapper;
        }

        /**
         * 注入骨架屏样式
         */
        _injectSkeletonStyles() {
            const styles = `
                .loading-skeleton {
                    padding: 15px;
                    animation: skeleton-pulse 1.5s ease-in-out infinite;
                }
                
                .skeleton-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #e2e5e7;
                    margin-bottom: 10px;
                }
                
                .skeleton-line {
                    height: 12px;
                    background: #e2e5e7;
                    border-radius: 6px;
                    margin-bottom: 8px;
                }
                
                .skeleton-line.short {
                    width: 60%;
                }
                
                @keyframes skeleton-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `;
            
            this.injectStyles(styles, 'skeleton-styles');
        }
    }

    // 统一API暴露函数
    function exposeLoadingStatesAPI(loadingAPI) {
        // 统一暴露为LoadingStatesUI（保持向后兼容）
        window.LoadingStatesUI = {
            spinner: (text) => loadingAPI.spinner(text),
            overlay: (text) => loadingAPI.overlay(text),
            small: (text) => loadingAPI.small(text),
            button: (text) => loadingAPI.button(text),
            skeleton: (config) => loadingAPI.skeleton(config),
            showFullScreen: (text) => loadingAPI.showFullScreen(text),
            hideFullScreen: () => loadingAPI.hideFullScreen(),
            attachTo: (element, text, options) => loadingAPI.attachTo(element, text, options),
            detachFrom: (element) => loadingAPI.detachFrom(element)
        };
        
        // 同时暴露为LoadingStates（新的统一命名）
        window.LoadingStates = window.LoadingStatesUI;
    }

    // 创建全局实例
    const loadingStatesInstance = new LoadingStates();

    // 统一API暴露
    exposeLoadingStatesAPI(loadingStatesInstance);

    console.log('✅ 优化的LoadingStates组件已加载 (继承UIBase)');

})();