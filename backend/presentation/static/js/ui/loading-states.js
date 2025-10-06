/**
 * 加载状态UI组件
 * 统一管理各种加载状态的显示
 */
(function() {
    'use strict';

    const LoadingStates = {
        /**
         * 显示基础加载状态
         */
        show(container, options = {}) {
            if (!container) return;

            const config = {
                text: '加载中...',
                size: 'medium',
                overlay: false,
                ...options
            };

            const html = this.generateLoadingHTML(config);
            
            if (config.overlay) {
                this.showOverlay(container, html);
            } else {
                container.innerHTML = html;
                container.className = (container.className || '').replace(/\s*has-content\s*/g, '') + ' loading-state-container';
            }
        },

        /**
         * 显示对话加载状态
         */
        showConversations(container) {
            this.show(container, {
                text: '正在加载对话列表...',
                size: 'medium'
            });
        },

        /**
         * 显示消息加载状态
         */
        showMessages(container) {
            this.show(container, {
                text: '正在加载消息...',
                size: 'small'
            });
        },

        /**
         * 显示店铺加载状态
         */
        showShops(container) {
            this.show(container, {
                text: '正在加载店铺...',
                size: 'medium'
            });
        },

        /**
         * 显示发送消息加载状态
         */
        showSending(container) {
            this.show(container, {
                text: '发送中...',
                size: 'small',
                overlay: true
            });
        },

        /**
         * 显示保存加载状态
         */
        showSaving(container) {
            this.show(container, {
                text: '保存中...',
                size: 'small',
                overlay: true
            });
        },

        /**
         * 显示上传加载状态
         */
        showUploading(container, progress = null) {
            const text = progress !== null ? `上传中... ${progress}%` : '上传中...';
            this.show(container, {
                text,
                size: 'medium',
                overlay: true
            });
        },

        /**
         * 生成加载HTML
         */
        generateLoadingHTML(config) {
            const sizeClass = `loading-${config.size}`;
            
            return `
                <div class="loading-state ${sizeClass}">
                    <div class="loading-spinner">
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                    </div>
                    <div class="loading-text">${config.text}</div>
                </div>
            `;
        },

        /**
         * 显示覆盖层加载
         */
        showOverlay(container, html) {
            // 移除已存在的覆盖层
            this.hideOverlay(container);
            
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = html;
            
            container.style.position = 'relative';
            container.appendChild(overlay);
        },

        /**
         * 隐藏覆盖层加载
         */
        hideOverlay(container) {
            if (!container) return;
            
            const overlay = container.querySelector('.loading-overlay');
            if (overlay) {
                overlay.remove();
            }
        },

        /**
         * 清除加载状态
         */
        hide(container) {
            if (!container) return;
            
            // 移除覆盖层
            this.hideOverlay(container);
            
            // 移除内容加载状态
            const loadingState = container.querySelector('.loading-state');
            if (loadingState && !loadingState.closest('.loading-overlay')) {
                container.innerHTML = '';
                container.className = (container.className || '').replace(/\s*loading-state-container\s*/g, '') + ' has-content';
            }
        },

        /**
         * 检查是否正在加载
         */
        isLoading(container) {
            return container && (
                container.querySelector('.loading-state') ||
                container.querySelector('.loading-overlay')
            );
        },

        /**
         * 显示骨架屏加载
         */
        showSkeleton(container, type = 'list') {
            if (!container) return;

            let html = '';
            
            switch (type) {
                case 'conversation':
                    html = this.generateConversationSkeleton();
                    break;
                case 'message':
                    html = this.generateMessageSkeleton();
                    break;
                case 'list':
                default:
                    html = this.generateListSkeleton();
                    break;
            }
            
            container.innerHTML = html;
            container.className = (container.className || '').replace(/\s*has-content\s*/g, '') + ' skeleton-loading-container';
        },

        /**
         * 生成对话骨架屏
         */
        generateConversationSkeleton() {
            return Array(5).fill(0).map(() => `
                <div class="skeleton-item conversation-skeleton">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-line skeleton-title"></div>
                        <div class="skeleton-line skeleton-subtitle"></div>
                    </div>
                    <div class="skeleton-meta">
                        <div class="skeleton-line skeleton-time"></div>
                    </div>
                </div>
            `).join('');
        },

        /**
         * 生成消息骨架屏
         */
        generateMessageSkeleton() {
            return Array(3).fill(0).map((_, i) => `
                <div class="skeleton-item message-skeleton ${i % 2 ? 'right' : 'left'}">
                    <div class="skeleton-bubble">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                </div>
            `).join('');
        },

        /**
         * 生成列表骨架屏
         */
        generateListSkeleton() {
            return Array(3).fill(0).map(() => `
                <div class="skeleton-item list-skeleton">
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            `).join('');
        }
    };

    // 确保CSS样式存在
    if (!document.querySelector('#loading-states-css')) {
        const style = document.createElement('style');
        style.id = 'loading-states-css';
        style.textContent = `
            .loading-state-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100px;
                padding: 2rem;
            }
            
            .loading-state {
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1rem;
            }
            
            .loading-small { gap: 0.5rem; }
            .loading-large { gap: 1.5rem; }
            
            .loading-spinner {
                position: relative;
                width: 40px;
                height: 40px;
            }
            
            .loading-small .loading-spinner {
                width: 24px;
                height: 24px;
            }
            
            .loading-large .loading-spinner {
                width: 60px;
                height: 60px;
            }
            
            .spinner-ring {
                position: absolute;
                width: 100%;
                height: 100%;
                border: 2px solid transparent;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            .spinner-ring:nth-child(2) {
                animation-delay: 0.1s;
                opacity: 0.8;
            }
            
            .spinner-ring:nth-child(3) {
                animation-delay: 0.2s;
                opacity: 0.6;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .loading-text {
                color: #666;
                font-size: 0.9rem;
            }
            
            .loading-small .loading-text {
                font-size: 0.8rem;
            }
            
            .loading-large .loading-text {
                font-size: 1rem;
            }
            
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }
            
            /* 骨架屏样式 */
            .skeleton-loading-container {
                padding: 1rem;
            }
            
            .skeleton-item {
                margin-bottom: 1rem;
                animation: skeleton-pulse 1.5s ease-in-out infinite;
            }
            
            .skeleton-line {
                height: 1rem;
                background: #e2e8f0;
                border-radius: 0.25rem;
                margin-bottom: 0.5rem;
            }
            
            .skeleton-line.short {
                width: 60%;
            }
            
            .skeleton-line.skeleton-title {
                height: 1.2rem;
                width: 80%;
            }
            
            .skeleton-line.skeleton-subtitle {
                height: 0.9rem;
                width: 60%;
            }
            
            .skeleton-line.skeleton-time {
                height: 0.8rem;
                width: 40px;
            }
            
            .conversation-skeleton {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                border-bottom: 1px solid #f0f0f0;
            }
            
            .skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #e2e8f0;
                flex-shrink: 0;
            }
            
            .skeleton-content {
                flex: 1;
            }
            
            .skeleton-meta {
                flex-shrink: 0;
            }
            
            .message-skeleton {
                display: flex;
                margin-bottom: 1rem;
            }
            
            .message-skeleton.right {
                justify-content: flex-end;
            }
            
            .skeleton-bubble {
                max-width: 70%;
                padding: 0.75rem;
                background: #e2e8f0;
                border-radius: 1rem;
            }
            
            .list-skeleton {
                padding: 1rem;
                border-bottom: 1px solid #f0f0f0;
            }
            
            @keyframes skeleton-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }

    // 全局暴露
    window.LoadingStates = LoadingStates;

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('loading-states', 'ui', 'LoadingStates 已加载');
    } else {
        console.log('✅ LoadingStates 已加载');
    }
})();