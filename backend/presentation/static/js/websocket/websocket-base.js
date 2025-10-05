/**
 * WebSocketBase - WebSocket模块基础类
 * 
 * 设计目标：
 * - 消除所有WebSocket相关模块的重复代码
 * - 统一事件总线、状态管理、错误处理模式
 * - 提供可重用的连接状态和重连逻辑
 * - 支持统一的调试和监控接口
 * 
 * 适用模块：
 * - SimpleWebSocketAdapter (连接管理)
 * - WsEventRouter (事件路由)  
 * - MessageSendChannel (消息发送)
 */
(function() {
    'use strict';
    const T = (k,f)=> (typeof window.getText==='function') ? window.getText(k,f) : ((window.StateTexts && window.StateTexts[k]) || f || k);

    // WebSocket连接状态枚举
    const WS_STATE = {
        DISCONNECTED: 'disconnected',
        CONNECTING: 'connecting',
        CONNECTED: 'connected', 
        RECONNECTING: 'reconnecting',
        FAILED: 'failed',
        CLOSING: 'closing'
    };

    // WebSocket消息类型枚举
    const WS_MESSAGE_TYPE = {
        TEXT: 'text',
        FILE: 'file', 
        VOICE: 'voice',
        IMAGE: 'image',
        SYSTEM: 'system',
        HEARTBEAT: 'heartbeat'
    };

    class WebSocketBase {
        constructor(moduleName, options = {}) {
            this.moduleName = moduleName;
            this.options = {
                debug: false,
                maxReconnectAttempts: 10,
                reconnectInterval: 1000,
                maxReconnectInterval: 30000,
                heartbeatInterval: 25000,
                enableAutoHeartbeat: false,
                enableAdaptiveHeartbeat: false, // 新增：基于质量评分自适应调节心跳
                adaptiveHeartbeatMap: { // Level -> interval(ms)
                    Excellent: 40000,
                    Good: 30000,
                    Fair: 25000,
                    Poor: 18000,
                    Critical: 12000
                },
                adaptiveMinChangeDelta: 2000, // 少于该差值不调整
                adaptiveCooldown: 30000, // 调整冷却期
                heartbeatPayloadBuilder: () => ({ type:'heartbeat', clientSentAt: Date.now() }),
                heartbeatLossThreshold: 3,
                messageTimeout: 10000,
                ...options
            };

            // 统一状态管理
            this.state = {
                connectionState: WS_STATE.DISCONNECTED,
                reconnectAttempts: 0,
                lastConnectedTime: null,
                lastError: null,
                messageQueue: [],
                pendingMessages: new Map()
            };

            // 事件系统统一化
            this.eventBus = this._initializeEventBus(options.eventBus);
            
            // 统一定时器管理
            this.timers = {
                reconnect: null,
                heartbeat: null,
                cleanup: null
            };

            // 事件监听器注册表
            this.eventListeners = new Map();
            // 诊断标记
            this._diag = { emitted:0 };

            // 自适应心跳内部状态
            this._adaptive = {
                lastAppliedLevel: null,
                lastAdjustAt: 0,
                qualityHandler: null
            };
            if (this.options.enableAdaptiveHeartbeat) {
                this._bindAdaptiveHeartbeat();
            }
        }

        /**
         * 初始化事件总线
         */
        _initializeEventBus(providedBus) {
            // 优先级：传入的 > MessageEventBus > Events > 降级实现
            if (providedBus) return providedBus;
            
            if (window.MessageEventBus) return window.MessageEventBus;
            
            if (window.Events && window.Events.Events) return window.Events;
            
            // 降级实现：简单的事件发布器
            return this._createFallbackEventBus();
        }

        /**
         * 创建降级事件总线
         */
        _createFallbackEventBus() {
            const listeners = new Map();
            
            return {
                emit: (eventName, data) => {
                    const eventListeners = listeners.get(eventName) || [];
                    eventListeners.forEach(listener => {
                        try {
                            listener(data);
                        } catch (error) {
                            this.log('error', T('EVENT_LISTENER_FAIL','事件监听器执行失败'), error);
                        }
                    });
                },
                
                on: (eventName, listener) => {
                    if (!listeners.has(eventName)) {
                        listeners.set(eventName, []);
                    }
                    listeners.get(eventName).push(listener);
                },
                
                off: (eventName, listener) => {
                    const eventListeners = listeners.get(eventName) || [];
                    const index = eventListeners.indexOf(listener);
                    if (index > -1) {
                        eventListeners.splice(index, 1);
                    }
                }
            };
        }

        /**
         * 统一日志记录
         */
        log(level, message, ...args) {
            if (!this.options.debug && level === 'debug') return;
            
            const timestamp = new Date().toLocaleTimeString();
            const prefix = `[${this.moduleName}:${timestamp}]`;
            
            if (window.QT_LOG) {
                const fn = window.QT_LOG[level] || window.QT_LOG.info;
                fn(this.moduleName.toLowerCase(), message, ...args);
            } else {
                const fn = console[level] || console.log;
                fn(prefix, message, ...args);
            }
        }

        /**
         * 发布事件
         */
        emit(eventName, data) {
            try {
                if (this.eventBus && typeof this.eventBus.emit === 'function') {
                    this.eventBus.emit(eventName, data);
                }
                
                // 同时触发DOM事件（用于跨模块通信）
                if (typeof document !== 'undefined') {
                    document.dispatchEvent(new CustomEvent(`ws:${eventName}`, {
                        detail: data
                    }));
                    this._diag.emitted++;
                }
            } catch (error) {
                this.log('error', T('EVENT_EMIT_FAIL','事件发布失败'), eventName, error);
            }
        }

        /**
         * 监听事件
         */
        on(eventName, handler) {
            if (this.eventBus && typeof this.eventBus.on === 'function') {
                this.eventBus.on(eventName, handler);
                
                // 记录监听器，用于清理
                if (!this.eventListeners.has(eventName)) {
                    this.eventListeners.set(eventName, []);
                }
                this.eventListeners.get(eventName).push(handler);
            }
        }

        /**
         * 移除事件监听
         */
        off(eventName, handler) {
            if (this.eventBus && typeof this.eventBus.off === 'function') {
                this.eventBus.off(eventName, handler);
                
                // 从注册表移除
                const handlers = this.eventListeners.get(eventName) || [];
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
            }
        }

        /**
         * 更新连接状态
         */
        updateConnectionState(newState, error = null) {
            const oldState = this.state.connectionState;
            this.state.connectionState = newState;
            this.state.lastError = error;
            if (newState === WS_STATE.CONNECTED) {
                this.state.lastConnectedTime = Date.now();
                this.state.reconnectAttempts = 0;
                try { window.__WsMetrics && window.__WsMetrics.record('RECONNECT_SUCCESS'); } catch(_){}
                try { window.recordWsEventCategory && window.recordWsEventCategory('reconnectSuccess'); } catch(_){}
            }
            if (oldState !== newState) {
                this.log('info', `${T('NETWORK_STATE_CHANGE','连接状态变更')}: ${oldState} -> ${newState}`);
                this.emit('connectionStateChanged', { oldState, newState, error, timestamp: Date.now() });
                if (newState === WS_STATE.CONNECTING){ this.emit('connecting', { timestamp: Date.now() }); try { window.recordWsEventCategory && window.recordWsEventCategory('reconnectAttempt'); } catch(_){} }
                if (newState === WS_STATE.CONNECTED){ this.emit('open', { timestamp: Date.now() }); try { window.recordWsEventCategory && window.recordWsEventCategory('open'); } catch(_){} try { window.recordWsEventRateEvent && window.recordWsEventRateEvent(); } catch(_){} if (this.options.enableAutoHeartbeat) { this._startHeartbeatLoop(); } }
                if (newState === WS_STATE.RECONNECTING){ this.emit('reconnecting', { attempts: this.state.reconnectAttempts }); try { window.recordWsEventCategory && window.recordWsEventCategory('reconnectAttempt'); } catch(_){} }
                if (newState === WS_STATE.FAILED){ this.emit('failed', { error, attempts: this.state.reconnectAttempts }); try { window.recordWsEventCategory && window.recordWsEventCategory('reconnectFail'); } catch(_){} }
                if (newState === WS_STATE.CLOSING){ this.emit('closing', {}); }
                if (newState === WS_STATE.DISCONNECTED){ this.emit('close', { reason: error || 'disconnected' }); try { window.recordWsEventCategory && window.recordWsEventCategory('close'); } catch(_){} }
            }
        }

        /**
         * 启动自动心跳循环
         */
        _startHeartbeatLoop(){
            this._stopHeartbeatLoop();
            const send = () => {
                if (this.state.connectionState !== WS_STATE.CONNECTED) return;
                try {
                    const payload = this.options.heartbeatPayloadBuilder();
                    const sentAt = Date.now();
                    payload.clientSentAt = sentAt;
                    if (this.ws && this.ws.readyState === 1) {
                        this.ws.send(JSON.stringify(payload));
                        this.emit('heartbeatSent', payload);
                        this._pendingHeartbeat = { sentAt, payload };
                        try { window.recordWsHeartbeatSent && window.recordWsHeartbeatSent(sentAt); } catch(_){}
                        try { window.recordWsEventRateEvent && window.recordWsEventRateEvent(); } catch(_){ }
                        setTimeout(()=>{
                            if (this._pendingHeartbeat && Date.now() - this._pendingHeartbeat.sentAt > this.options.heartbeatInterval * 1.5) {
                                this.emit('heartbeatLost', { since: this._pendingHeartbeat.sentAt });
                            }
                        }, this.options.heartbeatInterval * 1.6);
                    }
                } catch(err){ this.log('error', T('HEARTBEAT_SEND_FAIL','发送心跳失败'), err); }
                this.timers.heartbeat = setTimeout(send, this.options.heartbeatInterval);
            };
            send();
        }

        _stopHeartbeatLoop(){
            if (this.timers.heartbeat) { clearTimeout(this.timers.heartbeat); this.timers.heartbeat = null; }
            this._pendingHeartbeat = null;
        }

        /**
         * 绑定质量评分事件以自适应心跳
         */
        _bindAdaptiveHeartbeat(){
            if (this._adaptive.qualityHandler) return; // 防重复
            const handler = (e)=>{
                try {
                    const detail = e.detail; if(!detail) return;
                    this._maybeAdjustHeartbeat(detail.newLevel);
                } catch(err){ this.log('error', T('ADAPTIVE_HANDLER_FAIL','adaptiveHeartbeat处理失败'), err); }
            };
            document.addEventListener('ws:qualityChanged', handler);
            this._adaptive.qualityHandler = handler;
        }

        _maybeAdjustHeartbeat(level){
            if (!this.options.enableAdaptiveHeartbeat) return;
            const map = this.options.adaptiveHeartbeatMap || {};
            const target = map[level];
            if (!target) return;
            const now = Date.now();
            if (now - this._adaptive.lastAdjustAt < this.options.adaptiveCooldown) return; // 冷却期
            const current = this.options.heartbeatInterval;
            if (Math.abs(current - target) < (this.options.adaptiveMinChangeDelta||0)) return; // 变化太小
                this.log('info', `${T('ADAPTIVE_HEARTBEAT','自适应心跳')}: ${current}ms -> ${target}ms (level=${level})`);
            this.options.heartbeatInterval = target;
            this._adaptive.lastAdjustAt = now;
            this._adaptive.lastAppliedLevel = level;
            try { window.__WsMetrics && window.__WsMetrics.record('HEARTBEAT_ADJUST', { level, interval: target }); } catch(_){ }
            // 若正在运行自动心跳循环，则重启以应用新间隔
            if (this.options.enableAutoHeartbeat && this.state.connectionState === WS_STATE.CONNECTED) {
                this._startHeartbeatLoop();
            }
            this.emit('adaptiveHeartbeatChanged', { level, interval: target, timestamp: now });
        }

        /**
         * 外部可在 onMessage 中调用 confirmHeartbeat(message) 来确认心跳 RTT
         */
        confirmHeartbeat(msg){
            if (!msg) return;
            const t = msg.type || msg.message_type;
            if (t === 'heartbeat' && this._pendingHeartbeat) {
                try { const clientSentAt = msg.clientSentAt || (msg.payload && msg.payload.clientSentAt); window.recordWsHeartbeatAck && window.recordWsHeartbeatAck(clientSentAt); } catch(_){}
                try { window.maybeSampleHeartbeatTrend && window.maybeSampleHeartbeatTrend(); } catch(_){}
                try { window.recordWsEventRateEvent && window.recordWsEventRateEvent(); } catch(_){}
                this._pendingHeartbeat = null;
            }
        }

        /**
         * 统一的重连逻辑
         */
    scheduleReconnect(reason = T('RECONNECT_UNKNOWN_REASON','未知原因')) {
            if (this.state.reconnectAttempts >= this.options.maxReconnectAttempts) {
                this.log('error', T('RECONNECT_LIMIT_REACHED','达到最大重连次数，停止重连'));
                this.updateConnectionState(WS_STATE.FAILED, '重连次数超限');
                try { window.__WsMetrics && window.__WsMetrics.record('RECONNECT_FAIL', { limit: true }); } catch(_){ }
                return;
            }

            this.state.reconnectAttempts++;
            try { window.__WsMetrics && window.__WsMetrics.record('RECONNECT_ATTEMPT', { attempt: this.state.reconnectAttempts, reason }); } catch(_){ }
            
            // 指数退避算法
            const delay = Math.min(
                this.options.reconnectInterval * Math.pow(2, this.state.reconnectAttempts - 1),
                this.options.maxReconnectInterval
            );

            this.log('info', `${delay}ms${T('RECONNECT_IN_SUFFIX','后进行第')}${this.state.reconnectAttempts}${T('RECONNECT_ATTEMPT_SUFFIX','次重连')} (原因: ${reason})`);
            
            this.updateConnectionState(WS_STATE.RECONNECTING);
            
            this.timers.reconnect = setTimeout(() => {
                this.connect && this.connect();
            }, delay);
        }

        /**
         * 清理定时器
         */
        clearTimers() {
            Object.values(this.timers).forEach(timer => {
                if (timer) clearTimeout(timer);
            });
            
            this.timers = {
                reconnect: null,
                heartbeat: null,
                cleanup: null
            };
        }

        /**
         * 清理事件监听器
         */
        clearEventListeners() {
            this.eventListeners.forEach((handlers, eventName) => {
                handlers.forEach(handler => this.off(eventName, handler));
            });
            this.eventListeners.clear();
        }

        /**
         * 生成消息ID
         */
        generateMessageId() {
            return `${this.moduleName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 延迟执行
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 延迟调用方法（带超时处理）
         */
        delayCall(method, delayMs = 100, context = this) {
            return setTimeout(() => {
                if (typeof method === 'function') {
                    method.call(context);
                } else if (typeof context[method] === 'function') {
                    context[method]();
                }
            }, delayMs);
        }

        /**
         * 获取连接状态信息
         */
        getConnectionInfo() {
            return {
                state: this.state.connectionState,
                reconnectAttempts: this.state.reconnectAttempts,
                lastConnectedTime: this.state.lastConnectedTime,
                lastError: this.state.lastError,
                uptime: this.state.lastConnectedTime ? 
                    Date.now() - this.state.lastConnectedTime : 0
            };
        }

        /**
         * 销毁实例
         */
        destroy() {
            this.clearTimers();
            this.clearEventListeners();
            this._stopHeartbeatLoop();
            if (this._adaptive && this._adaptive.qualityHandler) {
                document.removeEventListener('ws:qualityChanged', this._adaptive.qualityHandler);
                this._adaptive.qualityHandler = null;
            }
            this.state = null;
            this.options = null;
            this.log('info', T('WS_INSTANCE_DESTROYED','实例已销毁'));
            try { window.__WsMetrics && window.__WsMetrics.record('DISCONNECT'); } catch(_){ }
        }
    }

    // 暴露常量和基类
    window.WS_STATE = WS_STATE;
    window.WS_MESSAGE_TYPE = WS_MESSAGE_TYPE;
    window.WebSocketBase = WebSocketBase;

    console.log('✅ WebSocket基础类已加载 (WebSocketBase)');

})();