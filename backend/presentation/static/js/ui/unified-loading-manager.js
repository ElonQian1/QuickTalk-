/**
 * 统一加载管理系统
 * 整合并替代重复的加载状态相关模块
 * 
 * 替代的模块:
 * - loading-states-optimized.js (通用加载状态)
 * - skeleton-list.js (骨架屏列表)
 * 
 * 依赖:
 * - UIBase (继承标准化能力)
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-06
 */

class UnifiedLoadingManager extends UIBase {
    constructor(options = {}) {
        super();
        
        this.options = {
            // 加载配置
            defaultText: '正在加载...',
            defaultSize: 'medium',
            
            // 骨架屏配置
            skeletonRows: 5,
            showAvatar: true,
            skeletonLines: 2,
            
            // 动画配置
            animationDuration: '1.2s',
            pulseOpacity: 0.6,
            
            ...options
        };

        // 状态管理
        this.activeLoaders = new Map(); // loaderId -> config
        
        this.init();
    }

    init() {
        this.log('info', '统一加载管理系统初始化');
        
        // 注入样式
        this.injectLoadingStyles();
        
        // 初始化事件监听
        this.initEventListeners();
    }

    /**
     * 注入加载状态样式
     * 整合原有的样式注入逻辑
     */
    injectLoadingStyles() {
        const styles = `
            /* 通用加载状态样式 */
            .unified-loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: #666;
                min-height: 60px;
            }
            
            .unified-loading-state.loading-small {
                padding: 10px;
                min-height: 40px;
            }
            
            .unified-loading-state.loading-large {
                padding: 40px;
                min-height: 120px;
            }
            
            /* 加载旋转器样式 */
            .unified-loading-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: unified-spin 1s linear infinite;
                margin-bottom: 12px;
            }
            
            .loading-small .unified-loading-spinner {
                width: 20px;
                height: 20px;
                border-width: 2px;
                margin-bottom: 8px;
            }
            
            .loading-large .unified-loading-spinner {
                width: 48px;
                height: 48px;
                border-width: 4px;
                margin-bottom: 16px;
            }
            
            .unified-loading-text {
                font-size: 14px;
                color: #999;
                text-align: center;
            }
            
            /* 按钮加载状态 */
            .unified-loading-button {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }
            
            .unified-loading-button::after {
                content: "";
                position: absolute;
                inset: 2px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: inherit;
                animation: unified-spin 0.8s linear infinite;
            }
            
            /* 骨架屏样式 - 统一动画 */
            .unified-skeleton-container {
                width: 100%;
            }
            
            .unified-skeleton-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                border-bottom: 1px solid #f1f3f5;
            }
            
            .unified-skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(90deg, #eceff1, #f5f7fa, #eceff1);
                background-size: 200px 100%;
                animation: unified-shimmer ${this.options.animationDuration} infinite;
                flex-shrink: 0;
            }
            
            .unified-skeleton-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .unified-skeleton-line {
                height: 10px;
                border-radius: 6px;
                background: linear-gradient(90deg, #eceff1, #f5f7fa, #eceff1);
                background-size: 200px 100%;
                animation: unified-shimmer ${this.options.animationDuration} infinite;
            }
            
            .unified-skeleton-line.short {
                width: 60%;
            }
            
            .unified-skeleton-line.medium {
                width: 80%;
            }
            
            .unified-skeleton-line.long {
                width: 100%;
            }
            
            /* 通用骨架元素 */
            .unified-skeleton-element {
                background: linear-gradient(90deg, #eceff1, #f5f7fa, #eceff1);
                background-size: 200px 100%;
                animation: unified-shimmer ${this.options.animationDuration} infinite;
                border-radius: 4px;
            }
            
            /* 脉冲动画 (替代版本) */
            .unified-skeleton-pulse {
                animation: unified-pulse 1.5s ease-in-out infinite;
            }
            
            /* 动画关键帧 */
            @keyframes unified-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes unified-shimmer {
                0% { background-position: -200px 0; }
                100% { background-position: 200px 0; }
            }
            
            @keyframes unified-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: ${this.options.pulseOpacity}; }
            }
            
            /* 响应式适配 */
            @media (max-width: 768px) {
                .unified-skeleton-row {
                    padding: 8px 12px;
                }
                
                .unified-skeleton-avatar {
                    width: 36px;
                    height: 36px;
                }
                
                .unified-loading-state {
                    padding: 16px;
                }
            }
        `;

        this.injectCSS(styles, 'unified-loading-styles');
    }

    /**
     * 显示通用加载状态
     */
    showLoading(container, options = {}) {
        const config = {
            text: this.options.defaultText,
            size: this.options.defaultSize,
            type: 'spinner',
            overlay: false,
            ...options
        };

        const loadingElement = this.createElement('div', {
            className: `unified-loading-state loading-${config.size} loading-${config.type}`
        });

        // 添加旋转器
        if (config.type === 'spinner') {
            const spinner = this.createElement('div', {
                className: 'unified-loading-spinner'
            });
            loadingElement.appendChild(spinner);
        }

        // 添加文本
        if (config.text) {
            const text = this.createElement('div', {
                className: 'unified-loading-text',
                textContent: config.text
            });
            loadingElement.appendChild(text);
        }

        // 插入到容器
        if (config.overlay) {
            // 覆盖模式
            container.style.position = 'relative';
            loadingElement.style.position = 'absolute';
            loadingElement.style.inset = '0';
            loadingElement.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            loadingElement.style.zIndex = '1000';
        } else {
            // 替换模式
            container.innerHTML = '';
        }
        
        container.appendChild(loadingElement);

        // 记录加载状态
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, { container, element: loadingElement, config });
        
        return loaderId;
    }

    /**
     * 显示按钮加载状态
     */
    showButtonLoading(button, text) {
        if (!button) return null;

        button.classList.add('unified-loading-button');
        button.disabled = true;
        
        // 保存原始状态
        const originalText = button.textContent;
        const originalHtml = button.innerHTML;
        
        if (text) {
            button.textContent = text;
        }

        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'button',
            element: button,
            originalText,
            originalHtml
        });

        return loaderId;
    }

    /**
     * 创建骨架屏 - 统一API
     * 整合自skeleton-list.js的buildConversationsSkeleton
     */
    createSkeleton(config = {}) {
        const skeletonConfig = {
            rows: this.options.skeletonRows,
            showAvatar: this.options.showAvatar,
            lines: this.options.skeletonLines,
            animationType: 'shimmer', // shimmer | pulse
            ...config
        };

        const container = this.createElement('div', {
            className: 'unified-skeleton-container'
        });

        for (let i = 0; i < skeletonConfig.rows; i++) {
            const row = this.createElement('div', {
                className: 'unified-skeleton-row'
            });

            // 头像骨架
            if (skeletonConfig.showAvatar) {
                const avatar = this.createElement('div', {
                    className: `unified-skeleton-avatar ${skeletonConfig.animationType === 'pulse' ? 'unified-skeleton-pulse' : ''}`
                });
                row.appendChild(avatar);
            }

            // 内容行
            const content = this.createElement('div', {
                className: 'unified-skeleton-content'
            });

            for (let j = 0; j < skeletonConfig.lines; j++) {
                const lineClass = j === skeletonConfig.lines - 1 ? 'short' : (j === 0 ? 'medium' : 'long');
                const line = this.createElement('div', {
                    className: `unified-skeleton-line ${lineClass} ${skeletonConfig.animationType === 'pulse' ? 'unified-skeleton-pulse' : ''}`
                });
                content.appendChild(line);
            }

            row.appendChild(content);
            container.appendChild(row);
        }

        return container;
    }

    /**
     * 显示骨架屏到容器
     */
    showSkeleton(container, config) {
        const skeleton = this.createSkeleton(config);
        container.innerHTML = '';
        container.appendChild(skeleton);

        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, { container, element: skeleton, type: 'skeleton' });
        
        return loaderId;
    }

    /**
     * 创建自定义骨架元素
     */
    createSkeletonElement(width, height, options = {}) {
        const config = {
            borderRadius: '4px',
            animationType: 'shimmer',
            ...options
        };

        return this.createElement('div', {
            className: `unified-skeleton-element ${config.animationType === 'pulse' ? 'unified-skeleton-pulse' : ''}`,
            style: `
                width: ${typeof width === 'number' ? width + 'px' : width};
                height: ${typeof height === 'number' ? height + 'px' : height};
                border-radius: ${config.borderRadius};
            `
        });
    }

    /**
     * 隐藏加载状态
     */
    hideLoading(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) {
            this.log('warn', '未找到加载器:', loaderId);
            return false;
        }

        if (loader.type === 'button') {
            // 按钮加载状态
            const button = loader.element;
            button.classList.remove('unified-loading-button');
            button.disabled = false;
            button.innerHTML = loader.originalHtml;
        } else {
            // 容器加载状态
            if (loader.element && loader.element.parentNode) {
                loader.element.remove();
            }
        }

        this.activeLoaders.delete(loaderId);
        return true;
    }

    /**
     * 隐藏所有加载状态
     */
    hideAllLoading() {
        const loaderIds = Array.from(this.activeLoaders.keys());
        loaderIds.forEach(id => this.hideLoading(id));
    }

    /**
     * 替换加载状态为内容
     */
    replaceLoadingWithContent(loaderId, content) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type === 'button') return false;

        const container = loader.container;
        container.innerHTML = '';
        
        if (typeof content === 'string') {
            container.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            container.appendChild(content);
        }

        this.activeLoaders.delete(loaderId);
        return true;
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        // 页面卸载时清理
        this.addEventListener(window, 'beforeunload', () => {
            this.hideAllLoading();
        });
    }

    // === 辅助方法 ===

    /**
     * 生成加载器ID
     */
    generateLoaderId() {
        return this.generateId('loader');
    }

    /**
     * 获取活动加载器数量
     */
    getActiveLoadersCount() {
        return this.activeLoaders.size;
    }

    /**
     * 销毁管理器
     */
    destroy() {
        // 清理所有加载状态
        this.hideAllLoading();

        // 调用父类销毁
        super.destroy();

        this.log('info', '统一加载管理系统已销毁');
    }
}

// 全局单例
window.UnifiedLoadingManager = UnifiedLoadingManager;

// 兼容性：提供旧API接口
window.LoadingUI = {
    show: (container, options) => {
        if (!window.unifiedLoadingManager) {
            window.unifiedLoadingManager = new UnifiedLoadingManager();
        }
        return window.unifiedLoadingManager.showLoading(container, options);
    },
    hide: (loaderId) => {
        if (!window.unifiedLoadingManager) return false;
        return window.unifiedLoadingManager.hideLoading(loaderId);
    },
    skeleton: (config) => {
        if (!window.unifiedLoadingManager) {
            window.unifiedLoadingManager = new UnifiedLoadingManager();
        }
        return window.unifiedLoadingManager.createSkeleton(config);
    }
};

// 兼容skeleton-list.js的SkeletonListUI
window.SkeletonListUI = {
    buildConversationsSkeleton: (count) => {
        if (!window.unifiedLoadingManager) {
            window.unifiedLoadingManager = new UnifiedLoadingManager();
        }
        return window.unifiedLoadingManager.createSkeleton({
            rows: count || 5,
            showAvatar: true,
            lines: 2
        });
    }
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.unifiedLoadingManager = new UnifiedLoadingManager();
    });
} else {
    window.unifiedLoadingManager = new UnifiedLoadingManager();
}

console.log('✅ 统一加载管理系统已加载 (UnifiedLoadingManager)');