/**
 * QuickTalk 应用程序主入口
 * 负责应用程序的初始化、模块加载和生命周期管理
 */
class QuickTalkApp {
    constructor() {
        this.name = 'QuickTalk客服系统';
        this.version = '2.0.0';
        this.modules = new Map();
        this.isInitialized = false;
        this.startTime = Date.now();
        
        // 绑定全局错误处理
        this.bindGlobalErrorHandlers();
    }

    /**
     * 初始化应用程序
     * @param {Object} options - 初始化选项
     */
    async init(options = {}) {
        if (this.isInitialized) {
            console.warn('应用程序已经初始化');
            return;
        }

        console.log(`🚀 正在启动 ${this.name} v${this.version}...`);

        try {
            // 第一阶段：加载核心模块
            await this.loadCoreModules();
            
            // 第二阶段：初始化配置
            await this.initializeConfig(options);
            
            // 第三阶段：加载业务模块
            await this.loadBusinessModules(options);
            
            // 第四阶段：初始化UI
            await this.initializeUI(options);
            
            // 第五阶段：启动服务
            await this.startServices(options);
            
            this.isInitialized = true;
            const initTime = Date.now() - this.startTime;
            
            console.log(`✅ ${this.name} 启动完成 (耗时: ${initTime}ms)`);
            
            // 触发应用启动完成事件
            if (window.eventBus) {
                window.eventBus.emit('app:initialized', { app: this, initTime });
            }
            
        } catch (error) {
            console.error('❌ 应用程序启动失败:', error);
            this.handleStartupError(error);
            throw error;
        }
    }

    /**
     * 加载核心模块
     * @private
     */
    async loadCoreModules() {
        console.log('📦 加载核心模块...');
        
        const coreModules = [
            { name: 'utils', path: 'core/utils.js' },
            { name: 'config', path: 'core/config.js' },
            { name: 'event-bus', path: 'core/event-bus.js' },
            { name: 'api-client', path: 'core/api-client.js' }
        ];

        const { loaded, failed } = await window.moduleLoader.loadModules(coreModules);
        
        if (failed.length > 0) {
            throw new Error(`核心模块加载失败: ${failed.map(f => f.name).join(', ')}`);
        }

        // 初始化核心模块
        for (const { name } of loaded) {
            await window.moduleLoader.initializeModule(name);
        }

        console.log('✅ 核心模块加载完成');
    }

    /**
     * 初始化配置
     * @private
     */
    async initializeConfig(options) {
        console.log('⚙️ 初始化配置...');
        
        // 合并用户配置
        if (options.config) {
            window.configManager.update(options.config);
        }

        // 验证配置
        const validation = window.configManager.validate();
        if (!validation.isValid) {
            console.warn('配置验证警告:', validation.errors);
        }

        console.log('✅ 配置初始化完成');
    }

    /**
     * 加载业务模块
     * @private
     */
    async loadBusinessModules(options) {
        console.log('📦 加载业务模块...');
        
        const businessModules = [
            // 管理器模块
            { name: 'auth-manager', path: 'managers/auth-manager.js' },
            { name: 'page-manager', path: 'managers/page-manager.js' },
            { name: 'shop-manager', path: 'managers/shop-manager.js' },
            { name: 'message-manager', path: 'managers/message-manager.js' },
            
            // 组件模块
            { name: 'modal', path: 'components/modal.js' },
            { name: 'toast', path: 'components/toast.js' },
            
            // 服务模块
            { name: 'websocket-service', path: 'services/websocket-service.js' }
        ];

        // 根据应用类型过滤模块
        const filteredModules = this.filterModulesByAppType(businessModules, options.appType);
        
        const { loaded, failed } = await window.moduleLoader.loadModules(filteredModules);
        
        // 记录失败但继续启动（非关键模块）
        if (failed.length > 0) {
            console.warn('部分业务模块加载失败:', failed);
        }

        // 初始化成功加载的模块
        for (const { name } of loaded) {
            try {
                await window.moduleLoader.initializeModule(name, options);
            } catch (error) {
                console.warn(`模块初始化失败: ${name}`, error);
            }
        }

        console.log(`✅ 业务模块加载完成 (成功: ${loaded.length}, 失败: ${failed.length})`);
    }

    /**
     * 根据应用类型过滤模块
     * @private
     */
    filterModulesByAppType(modules, appType) {
        // 根据不同的应用类型返回不同的模块列表
        const moduleFilters = {
            'admin': modules, // 管理端加载所有模块
            'customer': modules.filter(m => 
                !m.name.includes('admin') && 
                ['auth-manager', 'page-manager', 'message-manager', 'modal', 'toast', 'websocket-service'].includes(m.name)
            ),
            'analytics': modules.filter(m => 
                ['auth-manager', 'page-manager', 'modal', 'toast'].includes(m.name)
            )
        };

        return moduleFilters[appType] || modules;
    }

    /**
     * 初始化UI
     * @private
     */
    async initializeUI(options) {
        console.log('🎨 初始化UI...');
        
        // 应用主题
        this.applyTheme(options.theme);
        
        // 设置语言
        this.setLanguage(options.language);
        
        // 初始化页面管理器
        const pageManager = window.moduleLoader.getModule('page-manager');
        if (pageManager && pageManager.default) {
            pageManager.default.initialize();
        }

        console.log('✅ UI初始化完成');
    }

    /**
     * 启动服务
     * @private
     */
    async startServices(options) {
        console.log('🔄 启动服务...');
        
        // 启动WebSocket服务
        try {
            const wsService = window.moduleLoader.getModule('websocket-service');
            if (wsService && wsService.default) {
                await wsService.default.connect();
            }
        } catch (error) {
            console.warn('WebSocket服务启动失败:', error);
        }

        // 检查现有会话
        try {
            const authManager = window.moduleLoader.getModule('auth-manager');
            if (authManager && authManager.default) {
                await authManager.default.checkExistingSession();
            }
        } catch (error) {
            console.warn('会话检查失败:', error);
        }

        console.log('✅ 服务启动完成');
    }

    /**
     * 应用主题
     * @private
     */
    applyTheme(theme) {
        if (!theme) return;
        
        document.body.setAttribute('data-theme', theme);
        window.configManager.set('ui.theme', theme);
    }

    /**
     * 设置语言
     * @private
     */
    setLanguage(language) {
        if (!language) return;
        
        document.documentElement.setAttribute('lang', language);
        window.configManager.set('ui.language', language);
    }

    /**
     * 绑定全局错误处理
     * @private
     */
    bindGlobalErrorHandlers() {
        // JavaScript错误处理
        window.addEventListener('error', (event) => {
            console.error('全局JavaScript错误:', event.error);
            this.handleGlobalError(event.error);
        });

        // Promise未处理拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.handleGlobalError(event.reason);
        });

        // 资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.error('资源加载错误:', event.target.src || event.target.href);
            }
        }, true);
    }

    /**
     * 处理启动错误
     * @private
     */
    handleStartupError(error) {
        // 显示启动错误页面或提示
        document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 400px;
                ">
                    <div style="color: #dc3545; font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <h2 style="color: #333; margin-bottom: 16px;">应用启动失败</h2>
                    <p style="color: #666; margin-bottom: 20px;">抱歉，系统遇到问题无法正常启动</p>
                    <button onclick="window.location.reload()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                    ">重新加载</button>
                </div>
            </div>
        `;
    }

    /**
     * 处理全局错误
     * @private
     */
    handleGlobalError(error) {
        // 发送错误到事件总线
        if (window.eventBus) {
            window.eventBus.emit('system:error', { error, timestamp: Date.now() });
        }

        // 在调试模式下显示错误详情
        if (window.configManager && window.configManager.isDebugMode()) {
            console.group('🐛 全局错误详情');
            console.error('错误对象:', error);
            console.error('错误堆栈:', error.stack);
            console.groupEnd();
        }
    }

    /**
     * 获取应用信息
     */
    getInfo() {
        return {
            name: this.name,
            version: this.version,
            isInitialized: this.isInitialized,
            startTime: this.startTime,
            loadedModules: window.moduleLoader ? window.moduleLoader.getLoadedModules() : [],
            uptime: Date.now() - this.startTime
        };
    }

    /**
     * 销毁应用程序
     */
    destroy() {
        console.log('🗑️ 销毁应用程序...');
        
        // 清理模块
        if (window.moduleLoader) {
            window.moduleLoader.clear();
        }
        
        // 清理事件监听器
        if (window.eventBus) {
            window.eventBus.removeAllListeners();
        }
        
        this.isInitialized = false;
        console.log('✅ 应用程序销毁完成');
    }
}

// 创建全局应用实例
window.quickTalkApp = new QuickTalkApp();

// 自动初始化（如果不需要自定义配置）
document.addEventListener('DOMContentLoaded', () => {
    // 从script标签的data属性读取配置
    const appScript = document.querySelector('script[src*="app.js"]');
    const config = appScript ? JSON.parse(appScript.dataset.config || '{}') : {};
    
    // 自动启动应用（除非明确禁用）
    if (config.autoStart !== false) {
        window.quickTalkApp.init(config).catch(error => {
            console.error('应用自动启动失败:', error);
        });
    }
});

export default QuickTalkApp;