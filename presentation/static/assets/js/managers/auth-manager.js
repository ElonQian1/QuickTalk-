/**
 * 认证管理器 - 负责用户登录、登出、会话管理等
 */
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.apiClient = window.apiClient;
        this.eventBus = window.eventBus;
        this.config = window.configManager;
        
        // 绑定登录表单事件
        this.bindLoginEvents();
    }

    /**
     * 初始化认证管理器
     */
    static initialize() {
        if (!window.authManager) {
            window.authManager = new AuthManager();
        }
        return window.authManager;
    }

    /**
     * 绑定登录相关事件
     */
    bindLoginEvents() {
        // 登录表单提交
        document.addEventListener('submit', (event) => {
            if (event.target.id === 'loginForm') {
                event.preventDefault();
                this.handleLoginSubmit(event.target);
            }
        });

        // 回车键登录
        document.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && event.target.closest('#loginForm')) {
                event.preventDefault();
                const form = document.getElementById('loginForm');
                if (form) {
                    this.handleLoginSubmit(form);
                }
            }
        });

        // 登出按钮
        document.addEventListener('click', (event) => {
            if (event.target.matches('.logout-btn, [onclick*="logout"]')) {
                event.preventDefault();
                this.logout();
            }
        });
    }

    /**
     * 处理登录表单提交
     * @private
     */
    async handleLoginSubmit(form) {
        const formData = new FormData(form);
        const username = formData.get('username')?.trim();
        const password = formData.get('password')?.trim();

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.textContent;
        
        try {
            // 显示加载状态
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '登录中...';
            }

            const result = await this.login(username, password);
            
            if (!result.success) {
                this.showError(result.error || '登录失败');
            }
            
        } catch (error) {
            this.showError('登录过程中发生错误，请稍后重试');
            console.error('登录错误:', error);
        } finally {
            // 恢复按钮状态
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }

    /**
     * 用户登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<Object>} - 登录结果
     */
    async login(username, password) {
        try {
            console.log('🔐 开始登录:', username);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                // 保存用户信息和会话
                this.currentUser = data.user;
                this.sessionId = data.sessionId;
                
                // 更新API客户端的会话ID
                if (this.apiClient) {
                    this.apiClient.updateSessionId(this.sessionId);
                }
                
                // 持久化到本地存储
                this.saveSession(data.user, data.sessionId);
                
                // 设置全局变量（兼容性）
                window.currentUser = this.currentUser;
                window.sessionId = this.sessionId;
                
                console.log('✅ 登录成功:', this.currentUser.username, 'Role:', this.currentUser.role);
                
                // 显示应用界面
                this.showApp();
                
                // 更新用户信息显示
                this.updateUserInfo();
                
                // 加载初始数据
                await this.loadInitialData();
                
                // 触发登录成功事件
                if (this.eventBus) {
                    this.eventBus.emit('auth:login', { 
                        user: this.currentUser, 
                        sessionId: this.sessionId 
                    });
                }
                
                return { success: true, user: this.currentUser };
                
            } else {
                console.error('❌ 登录失败:', data.error);
                return { success: false, error: data.error || '登录失败' };
            }
            
        } catch (error) {
            console.error('登录请求失败:', error);
            return { success: false, error: '网络错误，请稍后重试' };
        }
    }

    /**
     * 用户登出
     */
    async logout() {
        try {
            const confirmed = await this.showConfirm('确定要退出登录吗？');
            if (!confirmed) return;

            console.log('🚪 用户登出');

            // 调用后端登出接口
            try {
                if (this.sessionId) {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: { 'X-Session-Id': this.sessionId }
                    });
                }
            } catch (error) {
                console.warn('后端登出请求失败:', error);
            }

            // 清除本地状态
            this.clearSession();
            
            // 显示登录界面
            this.showLogin();
            
            // 重置应用状态
            this.resetAppState();
            
            // 触发登出事件
            if (this.eventBus) {
                this.eventBus.emit('auth:logout');
            }
            
        } catch (error) {
            console.error('登出过程中发生错误:', error);
        }
    }

    /**
     * 检查现有会话
     */
    async checkExistingSession() {
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUser = localStorage.getItem('currentUser');
        
        if (!storedSessionId || !storedUser) {
            console.log('🔍 没有保存的会话');
            this.showLogin();
            return false;
        }

        console.log('🔍 发现保存的会话，验证中...', storedSessionId);
        
        try {
            // 验证会话是否仍然有效
            const response = await fetch('/api/auth/me', {
                headers: { 'X-Session-Id': storedSessionId }
            });
            
            if (response.ok) {
                const user = await response.json();
                
                // 恢复会话
                this.currentUser = user;
                this.sessionId = storedSessionId;
                
                // 更新API客户端
                if (this.apiClient) {
                    this.apiClient.updateSessionId(this.sessionId);
                }
                
                // 设置全局变量
                window.currentUser = this.currentUser;
                window.sessionId = this.sessionId;
                
                console.log('✅ 会话恢复成功:', user.username);
                
                // 显示应用界面
                this.showApp();
                this.updateUserInfo();
                await this.loadInitialData();
                
                // 触发会话恢复事件
                if (this.eventBus) {
                    this.eventBus.emit('auth:refresh', { user: this.currentUser });
                }
                
                return true;
                
            } else {
                console.log('❌ 会话已过期');
                this.clearSession();
                this.showLogin();
                return false;
            }
            
        } catch (error) {
            console.error('会话验证失败:', error);
            this.clearSession();
            this.showLogin();
            return false;
        }
    }

    /**
     * 保存会话到本地存储
     * @private
     */
    saveSession(user, sessionId) {
        try {
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('loginTime', Date.now().toString());
        } catch (error) {
            console.error('保存会话失败:', error);
        }
    }

    /**
     * 清除会话
     * @private
     */
    clearSession() {
        this.currentUser = null;
        this.sessionId = null;
        
        // 清除本地存储
        localStorage.removeItem('sessionId');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loginTime');
        
        // 清除全局变量
        window.currentUser = null;
        window.sessionId = null;
        window.currentShops = [];
        
        // 重置API客户端
        if (this.apiClient) {
            this.apiClient.updateSessionId(null);
        }
    }

    /**
     * 显示登录界面
     * @private
     */
    showLogin() {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
    }

    /**
     * 显示应用界面
     * @private
     */
    showApp() {
        const loginContainer = document.getElementById('loginContainer');
        const appContainer = document.getElementById('appContainer');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'flex';
    }

    /**
     * 更新用户信息显示
     * @private
     */
    updateUserInfo() {
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement && this.currentUser) {
            const roleText = this.getRoleText(this.currentUser.role);
            userInfoElement.textContent = `${this.currentUser.username} (${roleText})`;
        }
    }

    /**
     * 获取角色显示文本
     * @private
     */
    getRoleText(role) {
        const roleMap = {
            'super_admin': '超级管理员',
            'admin': '管理员',
            'shop_owner': '店主',
            'staff': '员工',
            'user': '用户'
        };
        return roleMap[role] || '用户';
    }

    /**
     * 加载初始数据
     * @private
     */
    async loadInitialData() {
        try {
            // 加载首页数据
            const homeManager = window.moduleLoader?.getModule('home-manager');
            if (homeManager && homeManager.default) {
                await homeManager.default.loadData();
            } else if (window.HomeManager) {
                window.HomeManager.loadData();
            }

            // 预加载店铺数据
            const shopManager = window.moduleLoader?.getModule('shop-manager');
            if (shopManager && shopManager.default) {
                await shopManager.default.loadShops();
            } else if (window.ShopManager) {
                window.ShopManager.loadShops();
            }

        } catch (error) {
            console.warn('加载初始数据失败:', error);
        }
    }

    /**
     * 重置应用状态
     * @private
     */
    resetAppState() {
        // 重置页面到首页
        const pageManager = window.moduleLoader?.getModule('page-manager');
        if (pageManager && pageManager.default) {
            pageManager.default.resetToPage('home');
        } else if (window.PageManager) {
            window.PageManager.switchPage('home');
            window.pageStack = ['home'];
        }

        // 清除缓存数据
        window.currentShops = [];
        window.messageCounters = {};
    }

    /**
     * 显示错误信息
     * @private
     */
    showError(message) {
        // 使用Toast组件显示错误
        if (window.Toast) {
            window.Toast.error(message);
        } else {
            // 回退到alert
            alert(`❌ ${message}`);
        }
    }

    /**
     * 显示确认对话框
     * @private
     */
    async showConfirm(message) {
        // 使用Modal组件显示确认对话框
        if (window.Modal) {
            return window.Modal.confirm('确认操作', message);
        } else {
            // 回退到confirm
            return confirm(message);
        }
    }

    /**
     * 获取当前用户
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * 获取会话ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * 检查是否已登录
     */
    isLoggedIn() {
        return !!(this.currentUser && this.sessionId);
    }

    /**
     * 检查用户权限
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        const userRole = this.currentUser.role;
        
        // 超级管理员拥有所有权限
        if (userRole === 'super_admin') return true;
        
        // 根据权限类型检查
        const permissions = {
            'admin': ['admin', 'super_admin'],
            'shop_management': ['shop_owner', 'admin', 'super_admin'],
            'staff': ['staff', 'shop_owner', 'admin', 'super_admin']
        };
        
        return permissions[permission]?.includes(userRole) || false;
    }

    /**
     * 加载用户资料
     */
    async loadUserProfile() {
        if (!this.sessionId) return null;
        
        try {
            const profile = await this.apiClient.get('/api/user/profile');
            return profile;
        } catch (error) {
            console.error('加载用户资料失败:', error);
            return null;
        }
    }
}

// 直接注册到全局，不使用ES6模块
window.AuthManager = AuthManager;

// 自动初始化
document.addEventListener('DOMContentLoaded', function() {
    if (!window.authManager) {
        window.authManager = AuthManager.initialize();
        console.log('🔐 AuthManager 自动初始化完成');
    }
});