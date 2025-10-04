/**
 * 应用启动器
 * 简化的应用初始化和模块协调
 * 
 * @author GitHub Copilot
 * @version 2.0
 * @date 2025-10-03
 */

class AppBootstrap {
    constructor() {
        this.isInitialized = false;
        this.services = {};
        this.startTime = Date.now();
    }

    /**
     * 初始化应用
     */
    async initialize() {
        if (this.isInitialized) {
            window.log.warn('AppBootstrap', '应用已初始化，跳过重复初始化');
            return;
        }

        try {
            window.log.info('AppBootstrap', '🚀 开始初始化应用...');

            // 1. 初始化核心服务
            await this._initializeCoreServices();

            // 2. 设置事件监听
            this._setupEventListeners();

            // 3. 启动后台任务
            this._startBackgroundTasks();

            // 4. 初始化UI组件
            await this._initializeUIComponents();

            this.isInitialized = true;
            const duration = Date.now() - this.startTime;

            window.log.info('AppBootstrap', `🎉 应用初始化完成 (耗时: ${duration}ms)`);

            // 发布初始化完成事件
            window.eventBus.emit('app.initialized', {
                duration,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            window.log.error('AppBootstrap', '❌ 应用初始化失败', error);
            throw error;
        }
    }

    /**
     * 获取服务实例
     */
    getService(name) {
        return this.services[name] || null;
    }

    /**
     * 检查是否已初始化
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * 初始化核心服务
     * @private
     */
    async _initializeCoreServices() {
        window.log.info('AppBootstrap', '初始化核心服务...');

        // 等待核心模块加载
        await this._waitForModules([
            'EventBus',
            'SessionDomainService', 
            'BadgeDomainService',
            'Conversation',
            'Message',
            'Shop'
        ]);

        // 创建服务实例
        this.services.sessionService = window.getModule('SessionDomainService');
        this.services.badgeService = window.getModule('BadgeDomainService');

        // 保持向后兼容
        window.sessionService = this.services.sessionService;
        window.badgeService = this.services.badgeService;

        window.log.info('AppBootstrap', '✅ 核心服务初始化完成');
    }

    /**
     * 设置事件监听
     * @private
     */
    _setupEventListeners() {
        window.log.info('AppBootstrap', '设置事件监听器...');

        // 监听WebSocket连接
        window.eventBus.on(window.APP_CONSTANTS.EVENTS.WS_CONNECTED, () => {
            window.log.info('AppBootstrap', '🔌 WebSocket 已连接');
        });

        window.eventBus.on(window.APP_CONSTANTS.EVENTS.WS_DISCONNECTED, () => {
            window.log.warn('AppBootstrap', '🔌 WebSocket 连接断开');
        });

        // 监听红点更新
        window.eventBus.on(window.APP_CONSTANTS.EVENTS.BADGE_UPDATE, (data) => {
            window.log.debug('AppBootstrap', `🔴 红点更新: ${data.target} (${data.newCount})`);
        });

        window.log.info('AppBootstrap', '✅ 事件监听器设置完成');
    }

    /**
     * 启动后台任务
     * @private
     */
    _startBackgroundTasks() {
        window.log.info('AppBootstrap', '启动后台任务...');

        // 定期清理和同步
        setInterval(() => {
            this._performMaintenance();
        }, 5 * 60 * 1000); // 5分钟

        window.log.info('AppBootstrap', '✅ 后台任务已启动');
    }

    /**
     * 初始化UI组件
     * @private
     */
    async _initializeUIComponents() {
        window.log.info('AppBootstrap', '初始化UI组件...');

        // 等待DOM准备就绪
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        // 初始化现有的UI组件（向后兼容）
        this._initializeLegacyComponents();
        
        // 加载初始数据
        await this._loadInitialData();

        window.log.info('AppBootstrap', '✅ UI组件初始化完成');
    }
    
    /**
     * 加载初始数据
     * @private
     */
    async _loadInitialData() {
        try {
            // 等待部分组件加载
            await new Promise(r => setTimeout(r, 300));
            
            // 加载首页统计数据
            if (typeof window.loadDashboardData === 'function') {
                await window.loadDashboardData();
                window.log.info('AppBootstrap', '✅ 首页数据已加载');
            }
            
            // 触发其他模块初始化
            if (window.DashboardBootstrap && typeof window.DashboardBootstrap.init === 'function') {
                window.DashboardBootstrap.init();
            }
        } catch (error) {
            window.log.error('AppBootstrap', '初始数据加载失败', error);
        }
    }

    /**
     * 初始化传统组件
     * @private
     */
    _initializeLegacyComponents() {
        // 创建传统数据同步管理器实例（如果存在）
        // 优先使用统一实例，避免重复与双更新
        if (!window.dataSyncManager) {
            if (window.unifiedDataSyncManager) {
                window.dataSyncManager = window.unifiedDataSyncManager;
                window.log.info('AppBootstrap', '✅ 复用 UnifiedDataSyncManager 作为 dataSyncManager');
            } else if (window.DataSyncManager) {
                try {
                    window.dataSyncManager = new window.DataSyncManager();
                } catch(_) {
                    // 兼容“薄代理”构造器直接返回实例的情况
                    window.dataSyncManager = window.DataSyncManager;
                }
                window.log.info('AppBootstrap', '✅ DataSyncManager 实例已创建');
            }
        }

        // 创建传统会话管理器实例（如果存在）
        if (window.SessionManager && !window.sessionManager) {
            window.sessionManager = new window.SessionManager();
            window.log.info('AppBootstrap', '✅ SessionManager 实例已创建');
        }

        // 创建导航红点管理器（如果存在）
        if (window.NavBadgeManager && !window.navBadgeManager) {
            try {
                // 允许外部先行创建并挂载的全局实例被复用
                window.navBadgeManager = window.navBadgeManager || new window.NavBadgeManager();
                window.log.info('AppBootstrap', '✅ NavBadgeManager 实例已创建/复用');
            } catch (e) {
                window.log.warn('AppBootstrap', 'NavBadgeManager 初始化失败（忽略）', e);
            }
        }

        // 创建店铺卡片管理器（如果存在）
        if (window.ShopCardManager && !window.shopCardManager) {
            window.shopCardManager = new window.ShopCardManager();
            window.log.info('AppBootstrap', '✅ ShopCardManager 实例已创建');
        }
    }

    /**
     * 等待模块加载
     * @private
     */
    async _waitForModules(moduleNames, timeout = 10000) {
        const startTime = Date.now();
        
        for (const moduleName of moduleNames) {
            while (!(window.ModuleRegistry.isReady(moduleName) || window.ModuleRegistry.isRegistered(moduleName))) {
                if (Date.now() - startTime > timeout) {
                    throw new Error(`模块加载超时: ${moduleName}`);
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
    }

    /**
     * 执行维护任务
     * @private
     */
    _performMaintenance() {
        try {
            // 清理过期数据
            if (this.services.sessionService) {
                // 会话服务会自动清理过期会话
            }

            // 日志清理
            if (window.logger && window.logger.logs.length > 1000) {
                const oldCount = window.logger.logs.length;
                window.logger.logs = window.logger.logs.slice(-500);
                window.log.debug('AppBootstrap', `清理日志: ${oldCount} -> ${window.logger.logs.length}`);
            }

            window.log.debug('AppBootstrap', '🧹 维护任务完成');
        } catch (error) {
            window.log.error('AppBootstrap', '维护任务失败', error);
        }
    }
}

// 创建全局实例
window.appBootstrap = new AppBootstrap();

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.appBootstrap.initialize();
        }, 100);
    });
} else {
    setTimeout(() => {
        window.appBootstrap.initialize();
    }, 100);
}

console.log('🚀 应用启动器已准备就绪');