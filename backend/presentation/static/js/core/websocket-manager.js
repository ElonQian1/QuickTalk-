/**
 * 统一WebSocket管理器 - 消除WebSocket重复代码
 * 
 * 设计目标:
 * 1. 统一WebSocket连接逻辑，避免重复的连接代码
 * 2. 提供标准的事件处理和消息路由功能
 * 3. 统一重连机制和错误处理
 * 4. 支持多监听器和消息分发
 * 
 * 这个管理器将替代各文件中的重复WebSocket操作：
 * - mobile-message-manager.js 的WebSocket初始化
 * - admin-mobile*.html 中的WebSocket连接代码
 * - notification-manager.js 的WebSocket设置
 * - 各种测试文件中的WebSocket逻辑
 */

class UnifiedWebSocketManager {
    constructor(options = {}) {
        this.name = 'UnifiedWebSocketManager';
        
        // 初始化统一日志器
        this.logger = window.Loggers?.WebSocket || {
            debug: (...args) => console.log('[WebSocket]', ...args),
            info: (...args) => console.info('[WebSocket]', ...args),
            warn: (...args) => console.warn('[WebSocket]', ...args),
            error: (...args) => console.error('[WebSocket]', ...args)
        };
        
        this.options = {
            url: this._getDefaultWebSocketUrl(),
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000,
            authTimeout: 10000,
            debug: false,
            ...options
        };

        // WebSocket实例
        this.ws = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        
        // 重连管理
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        
        // 心跳管理
        this.heartbeatTimer = null;
        this.lastPongTime = 0;
        
        // 认证管理
        this.authTimer = null;
        this.sessionId = null;
        
        // 事件管理
        this.eventListeners = new Map();
        this.messageQueue = []; // 未连接时的消息队列
        
        // 状态追踪
        this.connectionStats = {
            totalConnections: 0,
            totalReconnections: 0,
            messagesReceived: 0,
            messagesSent: 0,
            lastConnectedTime: null,
            lastDisconnectedTime: null
        };

        this._initializeEventListeners();
    }

    /**
     * 连接WebSocket
     */
    connect(authData = null) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._log('warn', 'WebSocket已经连接');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this._log('info', `开始连接WebSocket: ${this.options.url}`);
                
                this.ws = new WebSocket(this.options.url);
                
                // 连接成功处理
                this.ws.onopen = () => {
                    this._onOpen(resolve, authData);
                };
                
                // 消息处理
                this.ws.onmessage = (event) => {
                    this._onMessage(event);
                };
                
                // 连接关闭处理
                this.ws.onclose = (event) => {
                    this._onClose(event);
                };
                
                // 错误处理
                this.ws.onerror = (error) => {
                    this._onError(error, reject);
                };
                
                // 连接超时处理
                setTimeout(() => {
                    if (this.ws.readyState !== WebSocket.OPEN) {
                        reject(new Error('WebSocket连接超时'));
                    }
                }, 10000);
                
            } catch (error) {
                this._log('error', 'WebSocket连接失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 断开WebSocket连接
     */
    disconnect() {
        this._log('info', '主动断开WebSocket连接');
        
        // 清理定时器
        this._clearAllTimers();
        
        // 重置状态
        this.isConnected = false;
        this.isAuthenticated = false;
        this.reconnectAttempts = 0;
        
        // 关闭连接
        if (this.ws) {
            this.ws.close(1000, '主动断开');
            this.ws = null;
        }
        
        // 触发断开事件
        this._emit('disconnected', { reason: 'manual' });
    }

    /**
     * 发送消息
     */
    send(message) {
        if (!this.isConnected) {
            this._log('warn', '连接未建立，消息加入队列');
            this.messageQueue.push(message);
            return false;
        }

        try {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            this.ws.send(messageStr);
            this.connectionStats.messagesSent++;
            this._log('debug', '发送消息:', message);
            return true;
        } catch (error) {
            this._log('error', '发送消息失败:', error);
            return false;
        }
    }

    /**
     * 认证
     */
    authenticate(authData = null) {
        const defaultAuthData = {
            type: 'auth',
            sessionId: this.sessionId || this._generateSessionId(),
            timestamp: Date.now()
        };

        const finalAuthData = { ...defaultAuthData, ...authData };
        
        this._log('info', '发送认证信息:', finalAuthData);
        
        // 设置认证超时
        this.authTimer = setTimeout(() => {
            this._log('error', '认证超时');
            this._emit('authTimeout');
        }, this.options.authTimeout);
        
        return this.send(finalAuthData);
    }

    /**
     * 注册事件监听器
     */
    on(eventName, listener, options = {}) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }

        const listenerInfo = {
            fn: listener,
            once: options.once || false,
            priority: options.priority || 0,
            id: this._generateListenerId()
        };

        const listeners = this.eventListeners.get(eventName);
        listeners.push(listenerInfo);
        
        // 按优先级排序
        listeners.sort((a, b) => b.priority - a.priority);
        
        this._log('debug', `注册事件监听器: ${eventName}, ID: ${listenerInfo.id}`);
        
        return listenerInfo.id;
    }

    /**
     * 移除事件监听器
     */
    off(eventName, listenerId = null) {
        if (!this.eventListeners.has(eventName)) return false;

        const listeners = this.eventListeners.get(eventName);
        
        if (listenerId) {
            // 移除特定监听器
            const index = listeners.findIndex(l => l.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                return true;
            }
        } else {
            // 移除所有监听器
            this.eventListeners.set(eventName, []);
            return true;
        }
        
        return false;
    }

    /**
     * 获取连接状态
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            isAuthenticated: this.isAuthenticated,
            reconnectAttempts: this.reconnectAttempts,
            connectionStats: { ...this.connectionStats },
            readyState: this.ws ? this.ws.readyState : null,
            url: this.options.url
        };
    }

    /**
     * 设置会话ID
     */
    setSessionId(sessionId) {
        this.sessionId = sessionId;
        this._log('info', '设置会话ID:', sessionId);
    }

    // === 私有方法 ===

    /**
     * 连接成功处理
     */
    _onOpen(resolve, authData) {
        this._log('info', 'WebSocket连接已建立');
        
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionStats.totalConnections++;
        this.connectionStats.lastConnectedTime = new Date();
        
        // 清除重连定时器
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // 开始心跳
        this._startHeartbeat();
        
        // 处理消息队列
        this._processMessageQueue();
        
        // 自动认证
        if (authData || this.sessionId) {
            this.authenticate(authData);
        }
        
        // 触发连接事件
        this._emit('connected');
        
        if (resolve) resolve();
    }

    /**
     * 消息处理
     */
    _onMessage(event) {
        try {
            this.connectionStats.messagesReceived++;
            
            let data;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                // 处理非JSON消息
                data = { type: 'raw', data: event.data };
            }
            
            this._log('debug', '收到消息:', data);
            
            // 处理系统消息
            this._handleSystemMessage(data);
            
            // 分发消息给监听器
            this._emit('message', data);
            
            // 按消息类型分发
            if (data.type) {
                this._emit(`message:${data.type}`, data);
            }
            
        } catch (error) {
            this._log('error', '消息处理失败:', error, '原始数据:', event.data);
        }
    }

    /**
     * 连接关闭处理
     */
    _onClose(event) {
        this._log('info', `WebSocket连接关闭: 代码=${event.code}, 原因=${event.reason}`);
        
        this.isConnected = false;
        this.isAuthenticated = false;
        this.connectionStats.lastDisconnectedTime = new Date();
        
        // 清理定时器
        this._clearAllTimers();
        
        // 触发断开事件
        this._emit('disconnected', { code: event.code, reason: event.reason });
        
        // 自动重连(除非是主动关闭)
        if (event.code !== 1000) {
            this._attemptReconnect();
        }
    }

    /**
     * 错误处理
     */
    _onError(error, reject = null) {
        this._log('error', 'WebSocket错误:', error);
        this._emit('error', error);
        
        if (reject) reject(error);
    }

    /**
     * 处理系统消息
     */
    _handleSystemMessage(data) {
        switch (data.type) {
            case 'auth_success':
                this._log('info', '认证成功');
                this.isAuthenticated = true;
                if (this.authTimer) {
                    clearTimeout(this.authTimer);
                    this.authTimer = null;
                }
                this._emit('authenticated', data);
                break;
                
            case 'auth_failed':
                this._log('error', ((window.StateTexts && window.StateTexts.AUTH_FAIL) || '认证失败') + ':', data.message);
                this.isAuthenticated = false;
                if (this.authTimer) {
                    clearTimeout(this.authTimer);
                    this.authTimer = null;
                }
                this._emit('authFailed', data);
                break;
                
            case 'pong':
                this.lastPongTime = Date.now();
                this._log('debug', '收到心跳响应');
                break;
                
            case 'error':
                this._log('error', '服务器错误:', data.message);
                this._emit('serverError', data);
                break;
        }
    }

    /**
     * 尝试重连
     */
    _attemptReconnect() {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this._log('error', '达到最大重连次数，停止重连');
            this._emit('maxReconnectAttemptsReached');
            return;
        }

        this.reconnectAttempts++;
        this.connectionStats.totalReconnections++;
        
        const delay = this.options.reconnectInterval * Math.pow(2, Math.min(this.reconnectAttempts - 1, 5));
        
        this._log('info', `第${this.reconnectAttempts}次重连，${delay}ms后开始...`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
        
        this._emit('reconnecting', { attempt: this.reconnectAttempts });
    }

    /**
     * 开始心跳
     */
    _startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', timestamp: Date.now() });
                
                // 检查心跳响应
                const now = Date.now();
                if (this.lastPongTime > 0 && (now - this.lastPongTime) > (this.options.heartbeatInterval * 2)) {
                    this._log('warn', '心跳超时，可能连接异常');
                    this._emit('heartbeatTimeout');
                }
            }
        }, this.options.heartbeatInterval);
    }

    /**
     * 处理消息队列
     */
    _processMessageQueue() {
        if (this.messageQueue.length > 0) {
            this._log('info', `处理消息队列，数量: ${this.messageQueue.length}`);
            
            const messages = [...this.messageQueue];
            this.messageQueue = [];
            
            messages.forEach(message => {
                this.send(message);
            });
        }
    }

    /**
     * 清理所有定时器
     */
    _clearAllTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.authTimer) {
            clearTimeout(this.authTimer);
            this.authTimer = null;
        }
    }

    /**
     * 触发事件
     */
    _emit(eventName, data = null) {
        if (!this.eventListeners.has(eventName)) return;

        const listeners = this.eventListeners.get(eventName);
        const toRemove = [];

        listeners.forEach((listenerInfo, index) => {
            try {
                listenerInfo.fn(data);
                
                if (listenerInfo.once) {
                    toRemove.push(index);
                }
            } catch (error) {
                this._log('error', `事件监听器执行失败 [${eventName}]:`, error);
            }
        });

        // 移除once监听器
        toRemove.reverse().forEach(index => {
            listeners.splice(index, 1);
        });
    }

    /**
     * 初始化默认事件监听器
     */
    _initializeEventListeners() {
        // 连接状态变化时的默认处理
        this.on('connected', () => {
            this._updateConnectionStatus(true);
        });
        
        this.on('disconnected', () => {
            this._updateConnectionStatus(false);
        });
    }

    /**
     * 更新连接状态UI
     */
    _updateConnectionStatus(isConnected) {
        // 尝试更新常见的状态指示器
        const indicators = [
            { id: 'connectionStatus', classes: ['connected', 'disconnected'] },
            { id: 'wsStatus', classes: ['online', 'offline'] },
            { id: 'connection-indicator', classes: ['active', 'inactive'] }
        ];

        indicators.forEach(indicator => {
            const element = document.getElementById(indicator.id);
            if (element) {
                element.classList.remove(...indicator.classes);
                element.classList.add(isConnected ? indicator.classes[0] : indicator.classes[1]);
            }
        });

        // 更新状态文本
        const statusTexts = ['connectionText', 'wsStatusText', 'connection-text'];
        const statusText = isConnected ? '已连接' : '连接断开';
        
        statusTexts.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = statusText;
            }
        });
    }

    /**
     * 获取默认WebSocket URL
     */
    _getDefaultWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws`;
    }

    /**
     * 生成会话ID
     */
    _generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 生成监听器ID
     */
    _generateListenerId() {
        return 'listener_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 统一日志记录 (使用UnifiedLogger)
     */
    _log(level, ...args) {
        if (this.logger && this.logger[level]) {
            this.logger[level](...args);
        } else {
            // 回退到console
            const method = console[level] || console.log;
            method(`[${this.name}]`, ...args);
        }
    }

    /**
     * 销毁WebSocket管理器
     */
    destroy() {
        this._log('info', '销毁WebSocket管理器');
        
        this.disconnect();
        this.eventListeners.clear();
        this.messageQueue = [];
        
        this.ws = null;
    }
}

// 导出单例模式的WebSocket管理器
window.UnifiedWebSocketManager = new UnifiedWebSocketManager();

export default UnifiedWebSocketManager;