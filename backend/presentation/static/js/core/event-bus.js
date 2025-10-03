/**
 * 事件总线
 * 模块间通信的统一事件系统
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.isDebugMode = false;
    }

    /**
     * 订阅事件
     * @param {string} event 事件名
     * @param {Function} handler 处理函数
     * @param {Object} context 上下文对象
     */
    on(event, handler, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const listener = { handler, context, id: this._generateId() };
        this.listeners.get(event).push(listener);

        if (this.isDebugMode) {
            console.log(`📡 事件订阅: ${event} (ID: ${listener.id})`);
        }

        return listener.id;
    }

    /**
     * 取消订阅
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
            if (this.isDebugMode) {
                console.log(`📡 取消订阅: ${event}`);
            }
        }
    }

    /**
     * 发布事件
     * @param {string} event 事件名
     * @param {*} data 事件数据
     */
    emit(event, data = null) {
        if (!this.listeners.has(event)) {
            if (this.isDebugMode) {
                console.log(`📡 事件无监听者: ${event}`);
            }
            return;
        }

        const listeners = this.listeners.get(event);
        
        if (this.isDebugMode) {
            console.log(`📡 发布事件: ${event} (监听者: ${listeners.length})`);
        }

        listeners.forEach(listener => {
            try {
                const { handler, context } = listener;
                if (context) {
                    handler.call(context, data);
                } else {
                    handler(data);
                }
            } catch (error) {
                console.error(`❌ 事件处理错误 ${event}:`, error);
            }
        });
    }

    /**
     * 一次性订阅
     * @param {string} event 事件名
     * @param {Function} handler 处理函数
     * @param {Object} context 上下文对象
     */
    once(event, handler, context = null) {
        const wrappedHandler = (data) => {
            handler(data);
            this.off(event, wrappedHandler);
        };

        return this.on(event, wrappedHandler, context);
    }

    /**
     * 清理事件
     * @param {string} event 事件名（可选，不传则清理所有）
     */
    clear(event = null) {
        if (event) {
            this.listeners.delete(event);
            console.log(`🧹 已清理事件: ${event}`);
        } else {
            this.listeners.clear();
            console.log('🧹 已清理所有事件');
        }
    }

    /**
     * 开启/关闭调试模式
     */
    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        console.log(`🔧 事件总线调试模式: ${enabled ? '开启' : '关闭'}`);
    }

    /**
     * 获取事件统计
     */
    getStats() {
        const stats = {};
        this.listeners.forEach((listeners, event) => {
            stats[event] = listeners.length;
        });
        return stats;
    }

    /**
     * 生成唯一ID
     * @private
     */
    _generateId() {
        return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// 注册到模块系统
window.registerModule('EventBus', EventBus);

// 创建全局实例
window.eventBus = window.getModule('EventBus');

console.log('📡 事件总线已初始化');