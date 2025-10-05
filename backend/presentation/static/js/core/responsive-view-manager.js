/**
 * responsive-view-manager.js
 * 响应式视图管理器 - 统一处理移动端和桌面端的视图切换逻辑
 * 
 * 功能:
 * - 检测屏幕尺寸变化
 * - 管理移动端的视图栈
 * - 处理桌面端的多面板显示
 * - 提供统一的导航API
 */
(function() {
    'use strict';

    if (window.ResponsiveViewManager) return;

    const LOG_PREFIX = '[ResponsiveViewManager]';
    function log() { try { console.log(LOG_PREFIX, ...arguments); } catch(_) {} }

    class ResponsiveViewManager {
        constructor() {
            this.breakpoints = {
                sm: 576,
                md: 768,
                lg: 992,
                xl: 1200
            };
            
            this.currentBreakpoint = 'xs';
            this.isMobile = true;
            this.isTablet = false;
            this.isDesktop = false;
            
            // 移动端视图栈
            this.mobileViewStack = ['shopsListView'];
            this.currentMobileView = 'shopsListView';
            
            // 当前状态
            this.currentShopId = null;
            this.currentConversationId = null;
            
            this.init();
        }

        init() {
            this.detectBreakpoint();
            this.bindEvents();
            this.setupViewContainers();
            log('初始化完成', { breakpoint: this.currentBreakpoint });
        }

        detectBreakpoint() {
            const width = window.innerWidth;
            let newBreakpoint = 'xs';
            
            if (width >= this.breakpoints.xl) newBreakpoint = 'xl';
            else if (width >= this.breakpoints.lg) newBreakpoint = 'lg';
            else if (width >= this.breakpoints.md) newBreakpoint = 'md';
            else if (width >= this.breakpoints.sm) newBreakpoint = 'sm';
            
            const oldBreakpoint = this.currentBreakpoint;
            this.currentBreakpoint = newBreakpoint;
            
            this.isMobile = width < this.breakpoints.md;
            this.isTablet = width >= this.breakpoints.md && width < this.breakpoints.lg;
            this.isDesktop = width >= this.breakpoints.lg;
            
            if (oldBreakpoint !== newBreakpoint) {
                this.onBreakpointChange(oldBreakpoint, newBreakpoint);
            }
        }

        onBreakpointChange(oldBreakpoint, newBreakpoint) {
            log('断点变化', { from: oldBreakpoint, to: newBreakpoint });
            
            // 从移动端切换到桌面端
            if (oldBreakpoint === 'xs' || oldBreakpoint === 'sm') {
                if (newBreakpoint === 'md' || newBreakpoint === 'lg' || newBreakpoint === 'xl') {
                    this.switchToDesktopLayout();
                }
            }
            
            // 从桌面端切换到移动端
            if ((oldBreakpoint === 'md' || oldBreakpoint === 'lg' || oldBreakpoint === 'xl')) {
                if (newBreakpoint === 'xs' || newBreakpoint === 'sm') {
                    this.switchToMobileLayout();
                }
            }
            
            // 触发自定义事件
            this.dispatchEvent('breakpoint-change', {
                oldBreakpoint,
                newBreakpoint,
                isMobile: this.isMobile,
                isTablet: this.isTablet,
                isDesktop: this.isDesktop
            });
        }

        switchToDesktopLayout() {
            log('切换到桌面布局');
            
            // 显示所有视图
            this.showView('shopsListView', false);
            if (this.currentShopId) {
                this.showView('conversationsListView', false);
            }
            if (this.currentConversationId) {
                this.showView('chatView', false);
            }
        }

        switchToMobileLayout() {
            log('切换到移动端布局');
            
            // 根据当前状态决定显示哪个视图
            if (this.currentConversationId) {
                this.showMobileView('chatView');
            } else if (this.currentShopId) {
                this.showMobileView('conversationsListView');
            } else {
                this.showMobileView('shopsListView');
            }
        }

        setupViewContainers() {
            // 确保视图容器存在
            const viewIds = ['shopsListView', 'conversationsListView', 'chatView'];
            
            viewIds.forEach(id => {
                if (!document.getElementById(id)) {
                    const div = document.createElement('div');
                    div.id = id;
                    div.className = 'messages-view';
                    if (id !== 'shopsListView') div.style.display = 'none';
                    
                    const container = document.querySelector('.mobile-views');
                    if (container) {
                        container.appendChild(div);
                    }
                }
            });
        }

        // 移动端视图切换
        showMobileView(viewId) {
            if (!this.isMobile) return;
            
            log('显示移动端视图', viewId);
            
            // 隐藏所有移动端视图
            const mobileViews = document.querySelectorAll('.mobile-views .messages-view');
            mobileViews.forEach(view => {
                view.classList.remove('active');
                view.style.display = 'none';
            });
            
            // 显示目标视图
            const targetView = document.getElementById(viewId);
            if (targetView) {
                targetView.classList.add('active');
                targetView.style.display = 'flex';
            }
            
            this.currentMobileView = viewId;
            this.updateMobileViewStack(viewId);
        }

        // 统一视图显示（桌面端）
        showView(viewId, animate = true) {
            if (this.isMobile) {
                this.showMobileView(viewId);
                return;
            }
            
            log('显示视图', viewId);
            
            const view = document.getElementById(viewId) || 
                        document.querySelector(`[data-view="${viewId}"]`) ||
                        document.querySelector(`.${viewId.replace('View', '-view-content')}`);
            
            if (view) {
                view.style.display = 'flex';
                if (animate) {
                    view.classList.add('fade-in');
                    setTimeout(() => view.classList.remove('fade-in'), 300);
                }
            }
        }

        hideView(viewId) {
            const view = document.getElementById(viewId) || 
                        document.querySelector(`[data-view="${viewId}"]`) ||
                        document.querySelector(`.${viewId.replace('View', '-view-content')}`);
            
            if (view) {
                view.style.display = 'none';
            }
        }

        updateMobileViewStack(viewId) {
            // 移除之前的相同视图
            this.mobileViewStack = this.mobileViewStack.filter(id => id !== viewId);
            // 添加到栈顶
            this.mobileViewStack.push(viewId);
            
            // 限制栈深度
            if (this.mobileViewStack.length > 3) {
                this.mobileViewStack.shift();
            }
        }

        // 返回上一级视图
        goBack() {
            if (!this.isMobile) return false;
            
            if (this.mobileViewStack.length <= 1) return false;
            
            // 移除当前视图
            this.mobileViewStack.pop();
            // 显示上一个视图
            const previousView = this.mobileViewStack[this.mobileViewStack.length - 1];
            this.showMobileView(previousView);
            
            return true;
        }

        // 导航方法
        navigateToShopsList() {
            this.currentShopId = null;
            this.currentConversationId = null;
            
            if (this.isMobile) {
                this.showMobileView('shopsListView');
            } else {
                this.hideView('conversationsListView');
                this.hideView('chatView');
            }
            
            this.dispatchEvent('navigate', { view: 'shops' });
        }

        navigateToConversations(shopId) {
            this.currentShopId = shopId;
            this.currentConversationId = null;
            
            if (this.isMobile) {
                this.showMobileView('conversationsListView');
            } else {
                this.showView('conversationsListView');
                this.hideView('chatView');
            }
            
            this.dispatchEvent('navigate', { view: 'conversations', shopId });
        }

        navigateToChat(conversationId) {
            this.currentConversationId = conversationId;
            
            if (this.isMobile) {
                this.showMobileView('chatView');
            } else {
                this.showView('chatView');
            }
            
            this.dispatchEvent('navigate', { view: 'chat', conversationId });
        }

        bindEvents() {
            // 窗口大小变化
            window.addEventListener('resize', this.debounce(() => {
                this.detectBreakpoint();
            }, 250));
            
            // 监听返回按钮
            document.addEventListener('click', (e) => {
                if (e.target.matches('.back-btn, .back-button')) {
                    e.preventDefault();
                    this.goBack();
                }
            });
        }

        dispatchEvent(eventName, detail) {
            const event = new CustomEvent(`responsive-view:${eventName}`, {
                detail,
                bubbles: true
            });
            document.dispatchEvent(event);
        }

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // 公开方法
        getCurrentBreakpoint() {
            return this.currentBreakpoint;
        }

        getDeviceInfo() {
            return {
                breakpoint: this.currentBreakpoint,
                isMobile: this.isMobile,
                isTablet: this.isTablet,
                isDesktop: this.isDesktop,
                width: window.innerWidth
            };
        }
    }

    // 初始化并暴露到全局
    window.ResponsiveViewManager = ResponsiveViewManager;
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.responsiveViewManager = new ResponsiveViewManager();
        });
    } else {
        window.responsiveViewManager = new ResponsiveViewManager();
    }

    log('ResponsiveViewManager 模块已加载');
})();