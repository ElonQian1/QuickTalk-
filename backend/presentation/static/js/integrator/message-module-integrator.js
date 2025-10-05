/**
 * MessageModuleIntegrator - 消息模块集成器
 * 
 * 目的：将重构后的轻量化模块集成在一起，提供统一的初始化和管理
 * 特点：
 * - 依赖注入：自动装配各个模块
 * - 优雅降级：模块缺失时提供回退方案
 * - 生命周期管理：统一的初始化和销毁
 * - 向后兼容：提供Legacy接口适配
 */
(function() {
    'use strict';

    class MessageModuleIntegrator {
        constructor(options = {}) {
            this.options = {
                enableLegacyCompat: true,
                enableWebSocket: true,
                enableAutoInit: true,
                debug: false,
                ...options
            };

            this.modules = {
                coordinator: null,
                legacyCompat: null,
                wsAdapter: null,
                eventBus: null,
                stateStore: null
            };

            this.state = {
                initialized: false,
                initializationOrder: [],
                errors: []
            };

            if (this.options.enableAutoInit) {
                this._autoInit();
            }
        }

        /**
         * 自动初始化
         */
        _autoInit() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initialize());
            } else {
                setTimeout(() => this.initialize(), 100);
            }
        }

        /**
         * 初始化所有模块
         */
        async initialize() {
            if (this.state.initialized) {
                this._log('warn', '模块已初始化');
                return;
            }

            this._log('info', '开始初始化消息模块集成器');

            try {
                // 1. 初始化事件总线
                await this._initEventBus();

                // 2. 初始化状态存储
                await this._initStateStore();

                // 3. 初始化WebSocket适配器
                if (this.options.enableWebSocket) {
                    await this._initWebSocketAdapter();
                }

                // 4. 初始化核心协调器
                await this._initCoreCoordinator();

                // 5. 初始化Legacy兼容层
                if (this.options.enableLegacyCompat) {
                    await this._initLegacyCompat();
                }

                // 6. 设置全局引用
                this._setupGlobalReferences();

                this.state.initialized = true;
                this._log('info', '消息模块集成器初始化完成');

                // 发布初始化完成事件
                this._emit('modules:initialized', {
                    modules: Object.keys(this.modules).filter(key => this.modules[key]),
                    initOrder: this.state.initializationOrder
                });

            } catch (error) {
                this._log('error', '初始化失败:', error);
                this.state.errors.push(error);
                throw error;
            }
        }

        /**
         * 初始化事件总线
         */
        async _initEventBus() {
            this.modules.eventBus = window.MessageEventBus || window.EventBus || null;
            
            if (!this.modules.eventBus) {
                this._log('warn', '事件总线不可用，创建简单实现');
                this.modules.eventBus = this._createSimpleEventBus();
            }

            this.state.initializationOrder.push('eventBus');
            this._log('debug', '事件总线已初始化');
        }

        /**
         * 初始化状态存储
         */
        async _initStateStore() {
            this.modules.stateStore = window.MessageStateStore || null;
            
            if (!this.modules.stateStore) {
                this._log('warn', '状态存储不可用');
            }

            this.state.initializationOrder.push('stateStore');
            this._log('debug', '状态存储已初始化');
        }

        /**
         * 初始化WebSocket适配器
         */
        async _initWebSocketAdapter() {
            if (window.SimpleWebSocketAdapter) {
                this.modules.wsAdapter = new window.SimpleWebSocketAdapter({
                    eventBus: this.modules.eventBus,
                    debug: this.options.debug
                });
            } else {
                this._log('warn', 'SimpleWebSocketAdapter不可用');
            }

            this.state.initializationOrder.push('wsAdapter');
            this._log('debug', 'WebSocket适配器已初始化');
        }

        /**
         * 初始化核心协调器
         */
        async _initCoreCoordinator() {
            if (!window.MessageCoordinator) {
                throw new Error('MessageCoordinator不可用');
            }

            // 收集依赖
            const dependencies = {
                eventBus: this.modules.eventBus,
                stateStore: this.modules.stateStore,
                wsAdapter: this.modules.wsAdapter,
                shopsManager: window.ShopsManager || null,
                conversationsManager: window.ConversationsManager || null,
                messagesManager: window.MessagesManager || null,
                mediaHandler: window.MediaHandler || null
            };

            this.modules.coordinator = new window.MessageCoordinator(dependencies);

            this.state.initializationOrder.push('coordinator');
            this._log('debug', '核心协调器已初始化');
        }

        /**
         * 初始化Legacy兼容层
         */
        async _initLegacyCompat() {
            if (!window.MessageLegacyCompatLayer) {
                this._log('warn', 'MessageLegacyCompatLayer不可用');
                return;
            }

            this.modules.legacyCompat = new window.MessageLegacyCompatLayer(this.modules.coordinator);

            this.state.initializationOrder.push('legacyCompat');
            this._log('debug', 'Legacy兼容层已初始化');
        }

        /**
         * 设置全局引用
         */
        _setupGlobalReferences() {
            // 设置主要的全局引用
            window.MessageModuleInstance = this.modules.coordinator;
            window.messageModule = this.modules.coordinator;

            // 设置Legacy兼容引用
            if (this.modules.legacyCompat) {
                window.MessageLegacyCompat = this.modules.legacyCompat;
            }

            // 设置WebSocket引用
            if (this.modules.wsAdapter) {
                window.WebSocketAdapter = this.modules.wsAdapter;
            }

            this._log('debug', '全局引用已设置');
        }

        /**
         * 创建简单的事件总线
         */
        _createSimpleEventBus() {
            const listeners = new Map();

            return {
                on(event, handler) {
                    if (!listeners.has(event)) {
                        listeners.set(event, []);
                    }
                    listeners.get(event).push(handler);
                },

                off(event, handler) {
                    if (listeners.has(event)) {
                        const handlers = listeners.get(event);
                        const index = handlers.indexOf(handler);
                        if (index > -1) {
                            handlers.splice(index, 1);
                        }
                    }
                },

                emit(event, data) {
                    if (listeners.has(event)) {
                        listeners.get(event).forEach(handler => {
                            try {
                                handler({ type: event, detail: data });
                            } catch (error) {
                                console.error('[SimpleEventBus] 事件处理错误:', error);
                            }
                        });
                    }
                }
            };
        }

        /**
         * 发送事件
         */
        _emit(eventName, data) {
            if (this.modules.eventBus) {
                this.modules.eventBus.emit(eventName, data);
            }
        }

        /**
         * 日志记录
         */
        _log(level, ...args) {
            const prefix = '[MessageIntegrator]';
            if (window.QT_LOG && window.QT_LOG[level]) {
                window.QT_LOG[level]('Integrator', ...args);
            } else {
                console[level](prefix, ...args);
            }
        }

        /**
         * 获取模块状态
         */
        getModuleStatus() {
            const status = {};
            Object.keys(this.modules).forEach(key => {
                status[key] = {
                    available: !!this.modules[key],
                    instance: this.modules[key] ? 'loaded' : 'missing'
                };
            });
            return status;
        }

        /**
         * 获取初始化状态
         */
        getInitializationStatus() {
            return {
                initialized: this.state.initialized,
                initializationOrder: [...this.state.initializationOrder],
                errors: [...this.state.errors],
                moduleCount: Object.values(this.modules).filter(m => m).length
            };
        }

        /**
         * 重新初始化
         */
        async reinitialize() {
            this._log('info', '重新初始化模块集成器');
            await this.destroy();
            this.state.initialized = false;
            this.state.initializationOrder = [];
            this.state.errors = [];
            await this.initialize();
        }

        /**
         * 销毁所有模块
         */
        async destroy() {
            this._log('info', '销毁消息模块集成器');

            // 销毁各个模块
            Object.values(this.modules).forEach(module => {
                if (module && typeof module.destroy === 'function') {
                    try {
                        module.destroy();
                    } catch (error) {
                        this._log('error', '模块销毁失败:', error);
                    }
                }
            });

            // 清理全局引用
            if (window.MessageModuleInstance === this.modules.coordinator) {
                window.MessageModuleInstance = null;
            }
            if (window.messageModule === this.modules.coordinator) {
                window.messageModule = null;
            }

            // 重置状态
            this.modules = {
                coordinator: null,
                legacyCompat: null,
                wsAdapter: null,
                eventBus: null,
                stateStore: null
            };

            this.state.initialized = false;
        }
    }

    // 工厂函数
    function createMessageIntegrator(options) {
        return new MessageModuleIntegrator(options);
    }

    // 暴露到全局
    window.MessageModuleIntegrator = MessageModuleIntegrator;
    window.createMessageIntegrator = createMessageIntegrator;

    // 自动创建全局实例
    if (!window.MessageIntegratorInstance) {
        window.MessageIntegratorInstance = new MessageModuleIntegrator({
            enableAutoInit: true,
            debug: false
        });
    }

    console.info('[Integrator] 消息模块集成器已加载');
})();