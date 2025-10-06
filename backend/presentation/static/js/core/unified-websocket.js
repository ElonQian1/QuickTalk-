/**
 * 统一WebSocket管理器
 * 整合所有WebSocket相关功能，提供统一接口
 */
(function() {
    'use strict';

    class UnifiedWebSocket {
        constructor() {
            this.ws = null;
            this.url = this.getWebSocketUrl();
            this.reconnectDelay = 1000;
            this.maxReconnectDelay = 30000;
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 10;
            this.isIntentionallyClosed = false;
            this.messageQueue = [];
            this.listeners = new Map();
            this.logger = window.Logger?.createModuleLogger?.('UnifiedWebSocket') || console;
            
            this.connect();
            this.setupHeartbeat();
        }

        /**
         * 获取WebSocket URL
         */
        getWebSocketUrl() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            return `${protocol}//${host}/ws`;
        }

        /**
         * 建立连接
         */
        connect() {
            if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                return;
            }

            try {
                this.ws = new WebSocket(this.url);
                this.setupEventListeners();
                this.logger.info('WebSocket连接中...', this.url);
            } catch (error) {
                this.logger.error('WebSocket连接失败:', error);
                this.scheduleReconnect();
            }
        }

        /**
         * 设置事件监听器
         */
        setupEventListeners() {
            this.ws.onopen = (event) => {
                this.logger.info('WebSocket连接成功');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                this.isIntentionallyClosed = false;
                
                // 发送队列中的消息
                this.flushMessageQueue();
                
                // 触发连接事件
                this.emit('connected', event);
                this.dispatchGlobalEvent('websocket-connected', event);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    this.logger.error('消息解析失败:', error, event.data);
                }
            };

            this.ws.onclose = (event) => {
                this.logger.warn('WebSocket连接关闭', event.code, event.reason);
                this.emit('disconnected', event);
                this.dispatchGlobalEvent('websocket-disconnected', event);
                
                if (!this.isIntentionallyClosed) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                this.logger.error('WebSocket错误:', error);
                this.emit('error', error);
                this.dispatchGlobalEvent('websocket-error', error);
            };
        }

        /**
         * 处理接收到的消息
         */
        handleMessage(data) {
            this.logger.debug('收到WebSocket消息:', data);
            
            // 触发特定类型的监听器
            this.emit(data.type || 'message', data);
            
            // 触发通用消息监听器
            this.emit('message', data);
            
            // 触发全局事件
            this.dispatchGlobalEvent('websocket-message', data);
        }

        /**
         * 发送消息
         */
        send(data) {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            
            if (this.isConnected()) {
                try {
                    this.ws.send(message);
                    this.logger.debug('发送WebSocket消息:', data);
                } catch (error) {
                    this.logger.error('消息发送失败:', error);
                    this.messageQueue.push(message);
                }
            } else {
                this.logger.warn('WebSocket未连接，消息已加入队列');
                this.messageQueue.push(message);
            }
        }

        /**
         * 发送队列中的消息
         */
        flushMessageQueue() {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                try {
                    this.ws.send(message);
                } catch (error) {
                    this.logger.error('队列消息发送失败:', error);
                    this.messageQueue.unshift(message);
                    break;
                }
            }
        }

        /**
         * 检查连接状态
         */
        isConnected() {
            return this.ws && this.ws.readyState === WebSocket.OPEN;
        }

        /**
         * 安排重连
         */
        scheduleReconnect() {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.logger.error('WebSocket重连次数已达上限');
                return;
            }

            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
            
            this.logger.info(`${delay}ms后尝试第${this.reconnectAttempts}次重连`);
            
            setTimeout(() => {
                if (!this.isIntentionallyClosed) {
                    this.connect();
                }
            }, delay);
        }

        /**
         * 设置心跳
         */
        setupHeartbeat() {
            setInterval(() => {
                if (this.isConnected()) {
                    this.send({ type: 'ping', timestamp: Date.now() });
                }
            }, 30000); // 30秒心跳
        }

        /**
         * 添加事件监听器
         */
        on(event, callback) {
            if (!this.listeners.has(event)) {
                this.listeners.set(event, new Set());
            }
            this.listeners.get(event).add(callback);
        }

        /**
         * 移除事件监听器
         */
        off(event, callback) {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(callback);
            }
        }

        /**
         * 触发事件
         */
        emit(event, data) {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                for (const callback of eventListeners) {
                    try {
                        callback(data);
                    } catch (error) {
                        this.logger.error('事件监听器错误:', error);
                    }
                }
            }
        }

        /**
         * 派发全局事件
         */
        dispatchGlobalEvent(eventName, detail) {
            if (window.dispatchEvent) {
                const event = new CustomEvent(eventName, { detail });
                window.dispatchEvent(event);
            }
        }

        /**
         * 主动关闭连接
         */
        close() {
            this.isIntentionallyClosed = true;
            if (this.ws) {
                this.ws.close();
            }
            this.logger.info('WebSocket连接已主动关闭');
        }

        /**
         * 重新连接
         */
        reconnect() {
            this.close();
            this.isIntentionallyClosed = false;
            this.reconnectAttempts = 0;
            setTimeout(() => this.connect(), 1000);
        }

        /**
         * 获取连接状态信息
         */
        getStatus() {
            return {
                connected: this.isConnected(),
                url: this.url,
                reconnectAttempts: this.reconnectAttempts,
                maxReconnectAttempts: this.maxReconnectAttempts,
                queueLength: this.messageQueue.length,
                readyState: this.ws ? this.ws.readyState : -1
            };
        }
    }

    // 创建全局单例
    window.UnifiedWebSocket = new UnifiedWebSocket();
    
    // 向后兼容
    window.WebSocketManager = window.UnifiedWebSocket;

    // 模块注册
    if (typeof window.ModuleLoader?.registerModule === 'function') {
        window.ModuleLoader.registerModule('unified-websocket', 'core', 'UnifiedWebSocket 已加载');
    } else {
        console.log('✅ UnifiedWebSocket 已加载');
    }
})();