/**
 * 空状态UI组件
 * 统一管理各种空状态的显示
 */
(function() {
    'use strict';

    const EmptyStates = {
        /**
         * 显示无对话状态
         */
        showNoConversations(container) {
            this.render(container, {
                icon: '💬',
                title: '暂无对话',
                message: '当前没有任何对话记录',
                action: null
            });
        },

        /**
         * 显示无消息状态
         */
        showNoMessages(container) {
            this.render(container, {
                icon: '📝',
                title: '暂无消息',
                message: '该对话暂无消息记录',
                action: null
            });
        },

        /**
         * 显示无店铺状态
         */
        showNoShops(container) {
            this.render(container, {
                icon: '🏪',
                title: '暂无店铺',
                message: '您还没有创建任何店铺',
                action: {
                    text: '创建店铺',
                    onclick: 'window.ShopActions?.openCreateModal?.()'
                }
            });
        },

        /**
         * 显示搜索无结果状态
         */
        showNoSearchResults(container, keyword) {
            this.render(container, {
                icon: '🔍',
                title: '无搜索结果',
                message: `未找到与"${keyword}"相关的内容`,
                action: {
                    text: '清除搜索',
                    onclick: 'window.SearchUtils?.clearSearch?.()'
                }
            });
        },

        /**
         * 显示网络错误状态
         */
        showNetworkError(container) {
            this.render(container, {
                icon: '🌐',
                title: '网络连接失败',
                message: '请检查网络连接后重试',
                action: {
                    text: '重新加载',
                    onclick: 'window.location.reload()'
                }
            });
        },

        /**
         * 显示权限不足状态
         */
        showNoPermission(container) {
            this.render(container, {
                icon: '🔒',
                title: '权限不足',
                message: '您没有访问该内容的权限',
                action: null
            });
        },

        /**
         * 通用渲染方法
         */
        render(container, options) {
            if (!container) return;

            const { icon, title, message, action } = options;
            
            const html = `
                <div class="empty-state">
                    <div class="empty-state-icon">${icon}</div>
                    <h3 class="empty-state-title">${title}</h3>
                    <p class="empty-state-message">${message}</p>
                    ${action ? `
                        <button class="empty-state-action" onclick="${action.onclick}">
                            ${action.text}
                        </button>
                    ` : ''}
                </div>
            `;

            container.innerHTML = html;
            container.className = (container.className || '').replace(/\s*has-content\s*/g, '') + ' empty-state-container';
        },

        /**
         * 清除空状态
         */
        clear(container) {
            if (!container) return;
            
            container.innerHTML = '';
            container.className = (container.className || '').replace(/\s*empty-state-container\s*/g, '') + ' has-content';
        },

        /**
         * 检查是否为空状态
         */
        isEmpty(container) {
            return container && container.querySelector('.empty-state');
        }
    };

    // 确保CSS样式存在
    if (!document.querySelector('#empty-states-css')) {
        const style = document.createElement('style');
        style.id = 'empty-states-css';
        style.textContent = `
            .empty-state-container {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 200px;
                padding: 2rem;
            }
            
            .empty-state {
                text-align: center;
                max-width: 300px;
            }
            
            .empty-state-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                opacity: 0.6;
            }
            
            .empty-state-title {
                margin: 0 0 0.5rem 0;
                font-size: 1.2rem;
                color: #333;
                font-weight: 500;
            }
            
            .empty-state-message {
                margin: 0 0 1.5rem 0;
                color: #666;
                line-height: 1.4;
            }
            
            .empty-state-action {
                background: #007bff;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 0.375rem;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.2s;
            }
            
            .empty-state-action:hover {
                background: #0056b3;
            }
            
            .empty-state-action:active {
                transform: translateY(1px);
            }
        `;
        document.head.appendChild(style);
    }

    // 全局暴露
    window.EmptyStates = EmptyStates;

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('empty-states', 'ui', 'EmptyStates 已加载');
    } else {
        console.log('✅ EmptyStates 已加载');
    }
})();