/**
 * 事件系统迁移兼容层
 * 
 * 目标：平滑迁移，避免破坏现有功能
 * 策略：保持原有API兼容，内部委托给UnifiedEventBus
 */
(function() {
    'use strict';

    // 确保UnifiedEventBus已加载
    if (!window.UnifiedEventBus || !window.eventBus) {
        console.error('❌ 事件系统迁移失败：UnifiedEventBus未加载');
        return;
    }

    console.log('🔄 开始事件系统迁移兼容层初始化...');

    /**
     * 兼容旧版EventBus类
     */
    if (!window.EventBus) {
        window.EventBus = class EventBus extends window.UnifiedEventBus {
            constructor(options = {}) {
                super({
                    debug: false,
                    domBridge: false,
                    ...options
                });
            }
        };
    }

    /**
     * 确保MessageEventBus完全兼容
     */
    if (window.MessageEventBus && typeof window.MessageEventBus !== 'object') {
        // MessageEventBus已由UnifiedEventBus提供，无需重复创建
        console.log('📋 MessageEventBus兼容接口已由UnifiedEventBus统一提供');
    }

    /**
     * 兼容WebSocketBase中的事件总线访问
     */
    const originalWebSocketBase = window.WebSocketBase;
    if (originalWebSocketBase) {
        const originalInitializeEventBus = originalWebSocketBase.prototype._initializeEventBus;
        originalWebSocketBase.prototype._initializeEventBus = function(providedBus) {
            // 优先使用传入的事件总线，否则使用统一事件总线
            if (providedBus) return providedBus;
            
            // 统一返回全局事件总线
            return window.eventBus;
        };
    }

    /**
     * 确保Events模块能正确访问统一事件总线
     */
    if (window.Events && window.Events.emit) {
        // 覆盖Events.emit以使用统一事件总线
        window.Events.emit = function(eventName, data) {
            try {
                // 优先使用统一事件总线
                if (window.eventBus && typeof window.eventBus.emit === 'function') {
                    window.eventBus.emit(eventName, data);
                    return;
                }

                // 兜底：DOM事件
                if (typeof document !== 'undefined') {
                    document.dispatchEvent(new CustomEvent(eventName, {
                        detail: data,
                        bubbles: false
                    }));
                }
            } catch (error) {
                console.error('❌ Events.emit失败:', eventName, error);
            }
        };
    }

    /**
     * 为域服务提供事件总线依赖注入
     */
    if (window.SessionService) {
        // 确保SessionService使用统一事件总线
        const originalSessionServiceConstructor = window.SessionService;
        window.SessionService = function(dependencies = {}) {
            dependencies.eventBus = dependencies.eventBus || window.eventBus;
            return originalSessionServiceConstructor.call(this, dependencies);
        };
    }

    if (window.BadgeService) {
        // 确保BadgeService使用统一事件总线
        const originalBadgeServiceConstructor = window.BadgeService;
        window.BadgeService = function(dependencies = {}) {
            dependencies.eventBus = dependencies.eventBus || window.eventBus;
            return originalBadgeServiceConstructor.call(this, dependencies);
        };
    }

    /**
     * 迁移检查工具
     */
    window.EventMigrationChecker = {
        /**
         * 检查事件系统是否正确迁移
         */
        check() {
            const results = {
                unified: !!window.UnifiedEventBus,
                globalBus: !!window.eventBus,
                messageBus: !!window.MessageEventBus,
                eventBus: !!window.EventBus,
                events: !!window.Events,
                webSocketBase: !!window.WebSocketBase,
                compatibility: true
            };

            // 功能测试
            try {
                const testEvent = 'test:migration:' + Date.now();
                let received = false;

                // 测试订阅和发布
                const unsubscribe = window.eventBus.subscribe(testEvent, () => {
                    received = true;
                });

                window.eventBus.publish(testEvent, { test: true });
                unsubscribe();

                results.functionalTest = received;
            } catch (error) {
                results.functionalTest = false;
                results.error = error.message;
            }

            console.log('🔍 事件系统迁移检查结果:', results);
            return results;
        },

        /**
         * 获取事件统计信息
         */
        getStats() {
            if (window.eventBus && typeof window.eventBus.getStats === 'function') {
                return window.eventBus.getStats();
            }
            return null;
        },

        /**
         * 调试当前事件状态
         */
        debug() {
            if (window.eventBus && typeof window.eventBus.debug === 'function') {
                window.eventBus.debug();
            }
        }
    };

    console.log('✅ 事件系统迁移兼容层初始化完成');

    // 自动运行迁移检查
    setTimeout(() => {
        window.EventMigrationChecker.check();
    }, 100);

})();