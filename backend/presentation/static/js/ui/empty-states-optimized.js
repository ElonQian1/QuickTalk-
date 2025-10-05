/**
 * EmptyStates - 空状态组件
 * 继承自UIBase，专注于各种空状态的显示和管理
 * 
 * 优化内容：
 * - 移除重复的DOM创建代码
 * - 使用UIBase提供的统一接口
 * - 增强空状态的功能和可定制性
 */
(function(){
    'use strict';

    class EmptyStates extends UIBase {
        constructor(options = {}) {
            super('EmptyStates', {
                debug: false,
                ...options
            });

            // 注入样式
            this._injectEmptyStateStyles();
            
            this.log('info', 'EmptyStates组件初始化完成');
        }

        /**
         * 注入空状态样式
         */
        _injectEmptyStateStyles() {
            const styles = `
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    text-align: center;
                    color: #666;
                    min-height: 200px;
                }
                
                .empty-icon {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.8;
                }
                
                .empty-title {
                    font-size: 18px;
                    font-weight: 500;
                    color: #333;
                    margin-bottom: 8px;
                }
                
                .empty-desc {
                    font-size: 14px;
                    color: #666;
                    line-height: 1.5;
                    max-width: 300px;
                    margin-bottom: 20px;
                }
                
                .empty-actions {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .empty-action-btn {
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    background: #fff;
                    color: #666;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    display: inline-block;
                }
                
                .empty-action-btn:hover {
                    border-color: #3498db;
                    color: #3498db;
                }
                
                .empty-action-btn.primary {
                    background: #3498db;
                    border-color: #3498db;
                    color: #fff;
                }
                
                .empty-action-btn.primary:hover {
                    background: #2980b9;
                }
                
                .empty-state.compact {
                    min-height: 120px;
                    padding: 20px;
                }
                
                .empty-state.compact .empty-icon {
                    font-size: 32px;
                    margin-bottom: 12px;
                }
                
                .empty-state.compact .empty-title {
                    font-size: 16px;
                }
                
                .empty-state.compact .empty-desc {
                    font-size: 13px;
                }
            `;
            
            this.injectStyles(styles);
        }

        /**
         * 构建空状态组件
         */
        build(icon, title, desc, actions = []) {
            const elements = this.createElements({
                wrapper: {
                    tag: 'div',
                    className: 'empty-state'
                },
                icon: {
                    tag: 'div',
                    className: 'empty-icon',
                    textContent: icon
                },
                title: {
                    tag: 'div',
                    className: 'empty-title',
                    textContent: title
                },
                desc: {
                    tag: 'div',
                    className: 'empty-desc',
                    textContent: desc
                }
            });

            elements.wrapper.appendChild(elements.icon);
            elements.wrapper.appendChild(elements.title);
            if (desc) {
                elements.wrapper.appendChild(elements.desc);
            }

            // 添加操作按钮
            if (actions.length > 0) {
                const actionsContainer = this._createActionsContainer(actions);
                elements.wrapper.appendChild(actionsContainer);
            }

            return elements.wrapper;
        }

        /**
         * 创建操作按钮容器
         */
        _createActionsContainer(actions) {
            const container = this.createElement('div', {
                className: 'empty-actions'
            });

            actions.forEach(action => {
                const button = this.createElement('button', {
                    className: `empty-action-btn ${action.primary ? 'primary' : ''}`,
                    textContent: action.text
                });

                if (action.onClick) {
                    this.addEventListener(button, 'click', action.onClick);
                }

                if (action.href) {
                    button.onclick = () => window.location.href = action.href;
                }

                container.appendChild(button);
            });

            return container;
        }

        /**
         * 预定义的空状态
         */
        conversations(actions = []) {
            return this.build(
                '💬', 
                '暂无对话', 
                '等待客户发起对话',
                actions
            );
        }

        shops(actions = []) {
            const defaultActions = [
                {
                    text: '刷新页面',
                    onClick: () => window.location.reload()
                }
            ];
            
            return this.build(
                '🏪', 
                '暂无可用店铺', 
                '只有审核通过的店铺才会在此显示；请在店铺通过审核后再来处理客服消息',
                actions.length > 0 ? actions : defaultActions
            );
        }

        messages(actions = []) {
            return this.build(
                '📭', 
                '暂无消息', 
                '当前对话还没有消息记录',
                actions
            );
        }

        search(keyword = '', actions = []) {
            const defaultActions = [
                {
                    text: '清除搜索',
                    onClick: () => {
                        const searchInput = document.querySelector('input[type="search"], .search-input');
                        if (searchInput) {
                            searchInput.value = '';
                            searchInput.dispatchEvent(new Event('input'));
                        }
                    }
                }
            ];

            return this.build(
                '🔍', 
                '未找到匹配结果', 
                keyword ? `没有找到包含"${keyword}"的内容` : '试试其他搜索关键词',
                actions.length > 0 ? actions : defaultActions
            );
        }

        workbench(actions = []) {
            return this.build(
                '📊', 
                '暂无数据', 
                '当前统计周期内没有数据',
                actions
            );
        }

        network(actions = []) {
            const defaultActions = [
                {
                    text: '重试',
                    primary: true,
                    onClick: () => window.location.reload()
                }
            ];

            return this.build(
                '🌐', 
                '网络连接异常', 
                '请检查网络连接后重试',
                actions.length > 0 ? actions : defaultActions
            );
        }

        error(message = '发生未知错误', actions = []) {
            const defaultActions = [
                {
                    text: '刷新页面',
                    primary: true,
                    onClick: () => window.location.reload()
                }
            ];

            return this.build(
                '⚠️', 
                '出现错误', 
                message,
                actions.length > 0 ? actions : defaultActions
            );
        }

        /**
         * 通用空状态
         */
        generic(icon = '📋', title = '暂无内容', desc = '', actions = []) {
            return this.build(icon, title, desc, actions);
        }

        /**
         * 紧凑版空状态
         */
        compact(icon, title, desc = '', actions = []) {
            const element = this.build(icon, title, desc, actions);
            element.classList.add('compact');
            return element;
        }

        /**
         * 带加载提示的空状态
         */
        loading(text = '正在加载...') {
            return this.build(
                '⏳', 
                text, 
                '请稍等片刻'
            );
        }

        /**
         * 替换元素内容为空状态
         */
        replaceContent(element, emptyStateElement) {
            if (!element || !emptyStateElement) {
                this.log('warn', '元素参数无效');
                return;
            }

            // 保存原始内容（可选）
            if (!element.hasAttribute('data-original-content')) {
                element.setAttribute('data-original-content', element.innerHTML);
            }

            element.innerHTML = '';
            element.appendChild(emptyStateElement);

            this.log('debug', '空状态已替换元素内容');
        }

        /**
         * 恢复元素原始内容
         */
        restoreContent(element) {
            if (!element) return;

            const originalContent = element.getAttribute('data-original-content');
            if (originalContent) {
                element.innerHTML = originalContent;
                element.removeAttribute('data-original-content');
                this.log('debug', '元素内容已恢复');
            }
        }
    }

    // 创建全局实例
    const emptyStatesInstance = new EmptyStates();

    // 兼容旧版API
    window.EmptyStatesUI = {
        build: (icon, title, desc) => emptyStatesInstance.build(icon, title, desc),
        conversations: () => emptyStatesInstance.conversations(),
        shops: () => emptyStatesInstance.shops(),
        messages: () => emptyStatesInstance.messages(),
        search: (keyword) => emptyStatesInstance.search(keyword),
        workbench: () => emptyStatesInstance.workbench(),
        network: () => emptyStatesInstance.network(),
        error: (message) => emptyStatesInstance.error(message),
        generic: (icon, title, desc) => emptyStatesInstance.generic(icon, title, desc),
        compact: (icon, title, desc) => emptyStatesInstance.compact(icon, title, desc),
        loading: (text) => emptyStatesInstance.loading(text),
        replaceContent: (element, emptyState) => emptyStatesInstance.replaceContent(element, emptyState),
        restoreContent: (element) => emptyStatesInstance.restoreContent(element)
    };

    console.log('✅ 优化的EmptyStates组件已加载 (继承UIBase)');

})();