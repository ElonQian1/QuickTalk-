/**
 * 统一事件总线系统 - UnifiedEventBus
 * 
 * 设计目标：
 * - 消除EventBus和MessageEventBus的重复代码
 * - 提供统一的事件订阅/发布接口
 * - 支持两种API风格（向后兼容）
 * - 集成DOM桥接和调试功能
 * - 优化性能和内存管理
 */
(function() {
    'use strict';

    // 检查是否已初始化，避免重复加载
    if (window.UnifiedEventBus) {
        console.warn('⚠️ UnifiedEventBus已存在，跳过重复初始化');
        return;
    }

    const T = (k, f) => (typeof window.getText === 'function') ? window.getText(k, f) : ((window.StateTexts && window.StateTexts[k]) || f || k);

    class UnifiedEventBus {
        constructor(options = {}) {
            this.listeners = new Map();
            this.options = {
                debug: false,
                domBridge: false,
                namespace: 'qt',
                maxListeners: 100,
                ...options
            };

            this._idCounter = 0;
            this._stats = {
                eventsEmitted: 0,
                listenersAdded: 0,
                listenersRemoved: 0
            };

            // 使用统一日志系统
            this.logger = window.getLogger ? window.getLogger('EventBus', { enableDebug: this.options.debug }) : null;

            this.log('info', T('EVENT_BUS_INIT', '统一事件总线初始化完成'));
        }

        /**
         * 生成唯一监听器ID
         */
        _generateId() {
            return `listener_${++this._idCounter}_${Date.now()}`;
        }

        /**
         * 统一日志记录 - 使用 UnifiedLogger
         */
        log(level, message, ...args) {
            if (this.logger) {
                this.logger[level](message, ...args);
            } else {
                // 降级处理
                if (!this.options.debug && level === 'debug') return;
                const prefix = '[UnifiedEventBus]';
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 订阅事件 - 标准API (on)
         * @param {string} event 事件名
         * @param {Function} handler 处理函数
         * @param {Object} context 上下文对象
         * @returns {string} 监听器ID
         */
        on(event, handler, context = null) {
            return this._addListener(event, handler, context, false);
        }

        /**
         * 订阅事件 - 消息域API (subscribe)
         * @param {string} event 事件名
         * @param {Function} handler 处理函数
         * @returns {Function} 取消订阅函数
         */
        subscribe(event, handler) {
            const id = this._addListener(event, handler, null, false);
            return () => this.off(event, id);
        }

        /**
         * 一次性订阅 - 消息域API (once)
         * @param {string} event 事件名
         * @param {Function} handler 处理函数
         * @returns {Function} 取消订阅函数
         */
        once(event, handler) {
            const id = this._addListener(event, handler, null, true);
            return () => this.off(event, id);
        }

        /**
         * 内部添加监听器
         */
        _addListener(event, handler, context, isOnce) {
            if (typeof handler !== 'function') {
                this.log('error', T('INVALID_HANDLER', '无效的事件处理函数'), event);
                return null;
            }

            if (!this.listeners.has(event)) {
                this.listeners.set(event, []);
            }

            const listeners = this.listeners.get(event);
            
            // 防止监听器过多
            if (listeners.length >= this.options.maxListeners) {
                this.log('warn', T('TOO_MANY_LISTENERS', '事件监听器过多'), event, listeners.length);
            }

            const listener = {
                id: this._generateId(),
                handler,
                context,
                isOnce,
                addedAt: Date.now()
            };

            listeners.push(listener);
            this._stats.listenersAdded++;

            this.log('debug', `${T('EVENT_SUBSCRIBED', '事件订阅')}: ${event} (ID: ${listener.id})`);
            return listener.id;
        }

        /**
         * 取消订阅 - 标准API (off)
         * @param {string} event 事件名
         * @param {string|Function} handlerOrId 处理函数或ID
         */
        off(event, handlerOrId) {
            if (!this.listeners.has(event)) return;

            const listeners = this.listeners.get(event);
            const isId = typeof handlerOrId === 'string';

            const index = listeners.findIndex(listener =>
                isId ? listener.id === handlerOrId : listener.handler === handlerOrId
            );

            if (index !== -1) {
                listeners.splice(index, 1);
                this._stats.listenersRemoved++;

                // 清理空事件
                if (listeners.length === 0) {
                    this.listeners.delete(event);
                }

                this.log('debug', `${T('EVENT_UNSUBSCRIBED', '取消订阅')}: ${event}`);
            }
        }

        /**
         * 发布事件 - 标准API (emit)
         * @param {string} event 事件名
         * @param {*} data 事件数据
         */
        emit(event, data = null) {
            this._publishEvent(event, data);
        }

        /**
         * 发布事件 - 消息域API (publish)
         * @param {string} event 事件名
         * @param {*} payload 事件载荷
         */
        publish(event, payload = null) {
            this._publishEvent(event, payload);
        }

        /**
         * 内部发布事件逻辑
         */
        _publishEvent(event, data) {
            this._stats.eventsEmitted++;

            if (!this.listeners.has(event)) {
                this.log('debug', `${T('NO_LISTENERS', '事件无监听者')}: ${event}`);
                return;
            }

            const listeners = this.listeners.get(event);
            const listenersToRemove = [];

            this.log('debug', `${T('EVENT_PUBLISHED', '发布事件')}: ${event} (${T('LISTENERS', '监听者')}: ${listeners.length})`);

            // 执行监听器
            listeners.forEach((listener, index) => {
                try {
                    if (listener.context) {
                        listener.handler.call(listener.context, data);
                    } else {
                        listener.handler(data);
                    }

                    // 标记一次性监听器待删除
                    if (listener.isOnce) {
                        listenersToRemove.push(index);
                    }
                } catch (error) {
                    this.log('error', T('LISTENER_ERROR', '事件监听器执行失败'), event, error);
                }
            });

            // 删除一次性监听器（倒序删除避免索引问题）
            listenersToRemove.reverse().forEach(index => {
                listeners.splice(index, 1);
                this._stats.listenersRemoved++;
            });

            // 清理空事件
            if (listeners.length === 0) {
                this.listeners.delete(event);
            }

            // DOM桥接（可选）
            this._bridgeToDom(event, data);
        }

        /**
         * DOM事件桥接
         */
        _bridgeToDom(event, data) {
            if (!this.options.domBridge || typeof document === 'undefined') return;

            try {
                const domEventName = `${this.options.namespace}:${event}`;
                document.dispatchEvent(new CustomEvent(domEventName, {
                    detail: data,
                    bubbles: false,
                    cancelable: false
                }));

                this.log('debug', `${T('DOM_BRIDGE', 'DOM桥接')}: ${domEventName}`);
            } catch (error) {
                this.log('error', T('DOM_BRIDGE_ERROR', 'DOM桥接失败'), event, error);
            }
        }

        /**
         * 获取事件统计信息
         */
        getStats() {
            return {
                ...this._stats,
                totalEvents: this.listeners.size,
                totalListeners: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0)
            };
        }

        /**
         * 获取事件列表
         */
        getEvents() {
            return Array.from(this.listeners.keys());
        }

        /**
         * 获取事件的监听器数量
         */
        getListenerCount(event) {
            return this.listeners.has(event) ? this.listeners.get(event).length : 0;
        }

        /**
         * 清除所有监听器
         */
        clear() {
            const eventsCleared = this.listeners.size;
            const listenersCleared = Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0);

            this.listeners.clear();
            this._stats.listenersRemoved += listenersCleared;

            this.log('info', T('EVENT_BUS_CLEARED', '事件总线已清空'), {
                eventsCleared,
                listenersCleared
            });
        }

        /**
         * 销毁事件总线
         */
        destroy() {
            this.clear();
            this.options = null;
            this.log('info', T('EVENT_BUS_DESTROYED', '事件总线已销毁'));
        }

        /**
         * 调试信息
         */
        debug() {
            console.group('🔍 UnifiedEventBus调试信息');
            console.log('📊 统计信息:', this.getStats());
            console.log('📋 事件列表:', this.getEvents());
            
            this.listeners.forEach((listeners, event) => {
                console.log(`📡 ${event}: ${listeners.length}个监听器`);
            });
            
            console.groupEnd();
        }
    }

    // 创建全局单例
    const globalEventBus = new UnifiedEventBus({
        debug: window.QT_CONFIG?.debug || false,
        domBridge: window.QT_CONFIG?.features?.messageDomBridge || false
    });

    // 暴露统一接口
    window.UnifiedEventBus = UnifiedEventBus;
    window.eventBus = globalEventBus;

    // 为消息域提供兼容接口
    window.MessageEventBus = {
        subscribe: (event, handler) => globalEventBus.subscribe(event, handler),
        publish: (event, payload) => globalEventBus.publish(event, payload),
        once: (event, handler) => globalEventBus.once(event, handler),
        off: (event, handler) => globalEventBus.off(event, handler)
    };

    // 为传统模块提供兼容接口
    if (window.registerModule) {
        window.registerModule('EventBus', globalEventBus);
    }

    console.log('✅ 统一事件总线已加载 (UnifiedEventBus)');

})();