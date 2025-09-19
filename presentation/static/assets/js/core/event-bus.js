/**
 * 事件总线 - 跨模块通信的事件系统
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 50; // 防止内存泄漏
    }

    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    on(event, listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new Error('监听器必须是函数');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        
        // 检查监听器数量限制
        if (listeners.length >= this.maxListeners) {
            console.warn(`事件 ${event} 的监听器数量已达到限制 (${this.maxListeners})`);
        }

        const listenerInfo = {
            fn: listener,
            once: options.once || false,
            priority: options.priority || 0,
            context: options.context || null
        };

        listeners.push(listenerInfo);

        // 按优先级排序（优先级高的先执行）
        listeners.sort((a, b) => b.priority - a.priority);

        return this;
    }

    /**
     * 注册一次性事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    once(event, listener, options = {}) {
        return this.on(event, listener, { ...options, once: true });
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听器函数
     */
    off(event, listener) {
        if (!this.events.has(event)) {
            return this;
        }

        const listeners = this.events.get(event);
        const index = listeners.findIndex(l => l.fn === listener);

        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // 如果没有监听器了，删除事件
        if (listeners.length === 0) {
            this.events.delete(event);
        }

        return this;
    }

    /**
     * 移除事件的所有监听器
     * @param {string} event - 事件名称
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
        return this;
    }

    /**
     * 发射事件
     * @param {string} event - 事件名称
     * @param {...any} args - 传递给监听器的参数
     */
    emit(event, ...args) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event).slice(); // 创建副本避免修改时的问题
        let hasListeners = false;

        for (let i = 0; i < listeners.length; i++) {
            const { fn, once, context } = listeners[i];
            hasListeners = true;

            try {
                // 执行监听器
                if (context) {
                    fn.apply(context, args);
                } else {
                    fn(...args);
                }

                // 如果是一次性监听器，移除它
                if (once) {
                    this.off(event, fn);
                }
            } catch (error) {
                console.error(`事件监听器执行错误 (${event}):`, error);
            }
        }

        return hasListeners;
    }

    /**
     * 异步发射事件
     * @param {string} event - 事件名称
     * @param {...any} args - 传递给监听器的参数
     */
    async emitAsync(event, ...args) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = this.events.get(event).slice();
        let hasListeners = false;

        for (const { fn, once, context } of listeners) {
            hasListeners = true;

            try {
                let result;
                if (context) {
                    result = fn.apply(context, args);
                } else {
                    result = fn(...args);
                }

                // 如果返回Promise，等待完成
                if (result && typeof result.then === 'function') {
                    await result;
                }

                if (once) {
                    this.off(event, fn);
                }
            } catch (error) {
                console.error(`异步事件监听器执行错误 (${event}):`, error);
            }
        }

        return hasListeners;
    }

    /**
     * 获取事件的监听器数量
     * @param {string} event - 事件名称
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * 获取所有事件名称
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * 获取事件的所有监听器
     * @param {string} event - 事件名称
     */
    listeners(event) {
        return this.events.has(event) 
            ? this.events.get(event).map(l => l.fn) 
            : [];
    }

    /**
     * 设置最大监听器数量
     * @param {number} max - 最大数量
     */
    setMaxListeners(max) {
        this.maxListeners = max;
        return this;
    }

    /**
     * 创建命名空间事件总线
     * @param {string} namespace - 命名空间
     */
    namespace(namespace) {
        return new NamespacedEventBus(this, namespace);
    }
}

/**
 * 命名空间事件总线
 */
class NamespacedEventBus {
    constructor(eventBus, namespace) {
        this.eventBus = eventBus;
        this.namespace = namespace;
    }

    _getEventName(event) {
        return `${this.namespace}:${event}`;
    }

    on(event, listener, options) {
        return this.eventBus.on(this._getEventName(event), listener, options);
    }

    once(event, listener, options) {
        return this.eventBus.once(this._getEventName(event), listener, options);
    }

    off(event, listener) {
        return this.eventBus.off(this._getEventName(event), listener);
    }

    emit(event, ...args) {
        return this.eventBus.emit(this._getEventName(event), ...args);
    }

    emitAsync(event, ...args) {
        return this.eventBus.emitAsync(this._getEventName(event), ...args);
    }

    listenerCount(event) {
        return this.eventBus.listenerCount(this._getEventName(event));
    }

    listeners(event) {
        return this.eventBus.listeners(this._getEventName(event));
    }
}

// 预定义的系统事件
EventBus.EVENTS = {
    // 认证事件
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_FAILED: 'auth:failed',
    AUTH_REFRESH: 'auth:refresh',

    // 店铺事件
    SHOP_CREATED: 'shop:created',
    SHOP_UPDATED: 'shop:updated',
    SHOP_DELETED: 'shop:deleted',
    SHOP_STATUS_CHANGED: 'shop:status_changed',

    // 消息事件
    MESSAGE_RECEIVED: 'message:received',
    MESSAGE_SENT: 'message:sent',
    MESSAGE_READ: 'message:read',
    MESSAGE_TYPING: 'message:typing',

    // 用户事件
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    USER_UPDATED: 'user:updated',

    // 系统事件
    SYSTEM_ERROR: 'system:error',
    SYSTEM_WARNING: 'system:warning',
    SYSTEM_INFO: 'system:info',

    // UI事件
    PAGE_CHANGED: 'ui:page_changed',
    MODAL_OPENED: 'ui:modal_opened',
    MODAL_CLOSED: 'ui:modal_closed',
    THEME_CHANGED: 'ui:theme_changed'
};

// 创建全局事件总线实例
window.eventBus = new EventBus();

export default EventBus;