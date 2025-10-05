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

    // 创建全局实例
    const loadingStatesInstance = new LoadingStates();

    // 兼容旧版API
    window.LoadingStatesUI = {
        spinner: (text) => loadingStatesInstance.spinner(text),
        overlay: (text) => loadingStatesInstance.overlay(text),
        small: (text) => loadingStatesInstance.small(text),
        button: (text) => loadingStatesInstance.button(text),
        skeleton: (config) => loadingStatesInstance.skeleton(config),
        showFullScreen: (text) => loadingStatesInstance.showFullScreen(text),
        hideFullScreen: () => loadingStatesInstance.hideFullScreen(),
        attachTo: (element, text, options) => loadingStatesInstance.attachTo(element, text, options),
        detachFrom: (element) => loadingStatesInstance.detachFrom(element)
    };

    console.log('✅ 优化的LoadingStates组件已加载 (继承UIBase)');

})();