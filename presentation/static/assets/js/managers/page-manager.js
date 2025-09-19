/**
 * 页面管理器 - 负责页面切换、导航和数据加载
 */
class PageManager {
    constructor() {
        this.pageStack = ['home']; // 页面栈，用于返回功能
        this.currentPage = 'home';
        this.eventBus = window.eventBus;
        this.bindEvents();
    }

    /**
     * 初始化页面管理器
     */
    static initialize() {
        if (!window.pageManager) {
            window.pageManager = new PageManager();
        }
        return window.pageManager;
    }

    /**
     * 绑定全局事件
     */
    bindEvents() {
        // 监听导航点击事件
        document.addEventListener('click', (event) => {
            const navItem = event.target.closest('[data-page]');
            if (navItem) {
                event.preventDefault();
                const pageName = navItem.dataset.page;
                this.switchPage(pageName);
            }
        });

        // 监听返回按钮
        document.addEventListener('click', (event) => {
            if (event.target.matches('.back-btn, .go-back')) {
                event.preventDefault();
                this.goBack();
            }
        });

        // 监听浏览器返回按钮
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.page) {
                this.switchPage(event.state.page, {}, false);
            }
        });
    }

    /**
     * 切换页面
     * @param {string} pageName - 页面名称
     * @param {Object} params - 页面参数
     * @param {boolean} updateHistory - 是否更新浏览器历史
     */
    switchPage(pageName, params = {}, updateHistory = true) {
        try {
            console.log(`📄 切换到页面: ${pageName}`, params);

            // 隐藏当前页面
            document.querySelectorAll('.page.active').forEach(page => {
                page.classList.remove('active');
            });

            // 显示目标页面
            const targetPage = document.getElementById(pageName + 'Page');
            if (!targetPage) {
                console.error(`页面不存在: ${pageName}`);
                return false;
            }

            targetPage.classList.add('active');

            // 更新导航栏状态
            this.updateNavigation(pageName);

            // 更新页面栈
            if (this.pageStack[this.pageStack.length - 1] !== pageName) {
                this.pageStack.push(pageName);
            }

            // 更新浏览器历史
            if (updateHistory) {
                this.updateBrowserHistory(pageName, params);
            }

            // 加载页面数据
            this.loadPageData(pageName, params);

            // 更新当前页面
            this.currentPage = pageName;

            // 触发页面切换事件
            if (this.eventBus) {
                this.eventBus.emit('page:changed', { 
                    from: this.currentPage, 
                    to: pageName, 
                    params 
                });
            }

            return true;

        } catch (error) {
            console.error('页面切换失败:', error);
            return false;
        }
    }

    /**
     * 返回上一页
     */
    goBack() {
        if (this.pageStack.length > 1) {
            this.pageStack.pop();
            const previousPage = this.pageStack[this.pageStack.length - 1];
            this.switchPage(previousPage, {}, false);
            
            // 触发返回事件
            if (this.eventBus) {
                this.eventBus.emit('page:back', { to: previousPage });
            }
        }
    }

    /**
     * 更新导航栏状态
     * @private
     */
    updateNavigation(pageName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-page="${pageName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }

    /**
     * 更新浏览器历史
     * @private
     */
    updateBrowserHistory(pageName, params) {
        const url = new URL(window.location);
        url.searchParams.set('page', pageName);
        
        if (params && Object.keys(params).length > 0) {
            Object.keys(params).forEach(key => {
                url.searchParams.set(key, params[key]);
            });
        }

        window.history.pushState(
            { page: pageName, params }, 
            `${pageName} - QuickTalk`, 
            url
        );
    }

    /**
     * 根据页面类型加载数据
     * @private
     */
    async loadPageData(pageName, params) {
        try {
            switch (pageName) {
                case 'home':
                    await this.loadHomePage();
                    break;
                case 'messages':
                    await this.loadMessagesPage(params);
                    break;
                case 'shops':
                    await this.loadShopsPage(params);
                    break;
                case 'chat':
                    await this.loadChatPage(params);
                    break;
                case 'profile':
                    await this.loadProfilePage();
                    break;
                default:
                    console.warn(`未知页面类型: ${pageName}`);
            }
        } catch (error) {
            console.error(`加载页面数据失败 (${pageName}):`, error);
            this.showPageError(pageName, error);
        }
    }

    /**
     * 加载首页数据
     * @private
     */
    async loadHomePage() {
        console.log('🏠 加载首页数据');
        
        // 获取首页管理器
        const homeManager = window.moduleLoader?.getModule('home-manager');
        if (homeManager && homeManager.default) {
            await homeManager.default.loadData();
        } else if (window.HomeManager) {
            window.HomeManager.loadData();
        }
    }

    /**
     * 加载消息页面
     * @private
     */
    async loadMessagesPage(params) {
        console.log('💬 加载消息页面', params);
        
        const messageContainer = document.getElementById('messageContent');
        if (!messageContainer) {
            console.error('消息容器不存在');
            return;
        }

        // 使用多店铺客服系统
        if (window.customerServiceManager) {
            console.log('🏪 使用多店铺客服系统');
            window.customerServiceManager.renderToContainer(messageContainer);
        } else {
            // 使用消息管理器
            const messageManager = window.moduleLoader?.getModule('message-manager');
            if (messageManager && messageManager.default) {
                await messageManager.default.showMessageOverview();
            } else if (window.MessageManager) {
                window.MessageManager.showMessageOverview();
            } else {
                this.showModuleNotFound(messageContainer, '消息系统');
            }
        }
    }

    /**
     * 加载店铺页面
     * @private
     */
    async loadShopsPage(params) {
        console.log('🏪 加载店铺页面', params);
        
        // 确保sessionId全局可访问
        window.sessionId = localStorage.getItem('sessionId') || localStorage.getItem('token');
        
        // 使用店铺管理器
        const shopManager = window.moduleLoader?.getModule('shop-manager');
        if (shopManager && shopManager.default) {
            await shopManager.default.loadShops();
        } else if (window.ShopManager) {
            window.ShopManager.loadShops();
        } else {
            console.error('❌ 店铺管理器未找到');
        }
    }

    /**
     * 加载聊天页面
     * @private
     */
    async loadChatPage(params) {
        console.log('💬 加载聊天页面', params);
        
        if (!params.shopId || !params.userId) {
            console.error('聊天页面缺少必要参数');
            return;
        }

        const messageManager = window.moduleLoader?.getModule('message-manager');
        if (messageManager && messageManager.default) {
            await messageManager.default.loadChatMessages(params.shopId, params.userId);
        } else if (window.MessageManager) {
            window.MessageManager.loadChatMessages(params.shopId, params.userId);
        }
    }

    /**
     * 加载个人资料页面
     * @private
     */
    async loadProfilePage() {
        console.log('👤 加载个人资料页面');
        
        const authManager = window.moduleLoader?.getModule('auth-manager');
        if (authManager && authManager.default) {
            await authManager.default.loadUserProfile();
        }
    }

    /**
     * 显示模块未找到错误
     * @private
     */
    showModuleNotFound(container, moduleName) {
        container.innerHTML = `
            <div class="error-container" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                text-align: center;
                color: #666;
            ">
                <div class="error-icon" style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div class="error-title" style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
                    ${moduleName}未初始化
                </div>
                <div class="error-message" style="font-size: 14px;">
                    请稍后重试或刷新页面
                </div>
                <button onclick="window.location.reload()" style="
                    margin-top: 16px;
                    padding: 8px 16px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">刷新页面</button>
            </div>
        `;
    }

    /**
     * 显示页面加载错误
     * @private
     */
    showPageError(pageName, error) {
        const pageElement = document.getElementById(pageName + 'Page');
        if (pageElement) {
            pageElement.innerHTML = `
                <div class="page-error">
                    <h3>页面加载失败</h3>
                    <p>错误信息: ${error.message}</p>
                    <button onclick="window.location.reload()">刷新页面</button>
                </div>
            `;
        }
    }

    /**
     * 获取当前页面
     */
    getCurrentPage() {
        return this.currentPage;
    }

    /**
     * 获取页面栈
     */
    getPageStack() {
        return [...this.pageStack];
    }

    /**
     * 清空页面栈并跳转到指定页面
     */
    resetToPage(pageName, params = {}) {
        this.pageStack = [pageName];
        this.switchPage(pageName, params);
    }
}

// 模块导出
export default PageManager;

// 全局注册（兼容性）
window.PageManager = PageManager;