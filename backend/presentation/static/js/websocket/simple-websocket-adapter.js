/**
 * SimpleWebSocketAdapter - 简化的WebSocket适配器
 * 继承自WebSocketBase，专注于连接管理和消息传输
 * 
 * 优化内容：
 * - 移除重复的状态管理、事件发布、日志记录等代码
 * - 使用WebSocketBase提供的统一接口
 * - 保持原有的心跳和重连逻辑
 */
(function() {
    'use strict';

    class SimpleWebSocketAdapter extends WebSocketBase {
        constructor(options = {}) {
            super('WebSocketAdapter', {
                maxReconnectAttempts: 10,
                reconnectInterval: 1000,
                maxReconnectInterval: 30000,
                heartbeatInterval: 25000,
                debug: false,
                ...options
            });

            this.url = options.url || this._buildWebSocketUrl();
            this.ws = null;
            this.heartbeatTimer = null;

            // 绑定方法
            this._onOpen = this._onOpen.bind(this);
            this._onMessage = this._onMessage.bind(this);
            this._onError = this._onError.bind(this);
            this._onClose = this._onClose.bind(this);

            this.log('info', 'WebSocket适配器初始化完成');
        }

        /**
         * 构建WebSocket URL
         */
        _buildWebSocketUrl() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            return `${protocol}//${host}/ws`;
        }

        /**
         * 建立连接
         */
        connect() {
            if (this.state.connectionState === WS_STATE.CONNECTING || 
                this.state.connectionState === WS_STATE.CONNECTED) {
                this.log('debug', '连接已存在或正在连接中');
                return;
            }

            this.updateConnectionState(WS_STATE.CONNECTING);
            this.log('info', '正在连接WebSocket:', this.url);

            try {
                this.ws = new WebSocket(this.url);
                this.ws.onopen = this._onOpen;
                this.ws.onmessage = this._onMessage;
                this.ws.onerror = this._onError;
                this.ws.onclose = this._onClose;
            } catch (error) {
                this.log('error', '创建WebSocket连接失败:', error);
                this.scheduleReconnect(`连接创建失败: ${error.message}`);
            }
        }

        /**
         * 断开连接
         */
        disconnect() {
            this.log('info', '主动断开WebSocket连接');
            
            this._clearHeartbeat();
            this.clearTimers();
            this.updateConnectionState(WS_STATE.DISCONNECTED);
            
            if (this.ws) {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onerror = null;
                this.ws.onclose = null;
                
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                this.ws = null;
            }
        }

        /**
         * 发送消息
         */
        send(data) {
            if (this.state.connectionState !== WS_STATE.CONNECTED) {
                this.log('warn', '连接未就绪，无法发送消息');
                return false;
            }

            try {
                const message = typeof data === 'string' ? data : JSON.stringify(data);
                this.ws.send(message);
                this.log('debug', '消息已发送:', data);
                return true;
            } catch (error) {
                this.log('error', '发送消息失败:', error);
                return false;
            }
        }

        /**
         * 连接成功处理
         */
        _onOpen(event) {
            this.log('info', 'WebSocket连接已建立');
            
            this.updateConnectionState(WS_STATE.CONNECTED);
            this._startHeartbeat();
            this.emit('ws:connected', { event });
        }

        /**
         * 接收消息处理
         */
        _onMessage(event) {
            try {
                const data = JSON.parse(event.data);
                this.log('debug', '收到WebSocket消息:', data);
                
                // 忽略心跳响应
                if (data.type === 'pong') {
                    return;
                }

                // 发布到事件总线
                this.emit('ws:message', data);
                
                // 根据消息类型发布具体事件
                if (data.type) {
                    this.emit(`ws:${data.type}`, data);
                }
            } catch (error) {
                this.log('error', '解析WebSocket消息失败:', error, event.data);
            }
        }

        /**
         * 连接错误处理
         */
        _onError(event) {
            this.log('error', 'WebSocket连接错误:', event);
            this.emit('ws:error', { event });
        }

        /**
         * 连接关闭处理
         */
        _onClose(event) {
            this.log('info', 'WebSocket连接已关闭:', event.code, event.reason);
            
            this._clearHeartbeat();
            this.clearTimers();
            
            // 如果不是主动断开，尝试重连
            if (this.state.connectionState !== WS_STATE.DISCONNECTED) {
                this.scheduleReconnect(`连接关闭: ${event.reason || '未知原因'}`);
            }

            this.emit('ws:disconnected', { event });
        }

        /**
         * 开始心跳
         */
        _startHeartbeat() {
            if (!this.options.heartbeatInterval) return;

            this._clearHeartbeat();
            
            this.heartbeatTimer = setInterval(() => {
                if (this.state.connectionState === WS_STATE.CONNECTED) {
                    this.send({ type: 'ping', timestamp: Date.now() });
                }
            }, this.options.heartbeatInterval);
        }

        /**
         * 清理心跳定时器
         */
        _clearHeartbeat() {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }

        /**
         * 获取连接状态 (扩展基类方法)
         */
        getState() {
            return {
                ...this.getConnectionInfo(),
                readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
                url: this.url
            };
        }

        /**
         * 获取连接统计
         */
        getStats() {
            const baseInfo = this.getConnectionInfo();
            return {
                connectionState: baseInfo.state,
                reconnectAttempts: baseInfo.reconnectAttempts,
                lastConnectedTime: baseInfo.lastConnectedTime,
                uptime: baseInfo.uptime,
                hasError: !!baseInfo.lastError,
                url: this.url
            };
        }

        /**
         * 手动重连
         */
        reconnect() {
            this.log('info', '手动触发重连');
            this.disconnect();
            this.delayCall('connect', 100);
        }

        /**
         * 销毁适配器
         */
        destroy() {
            this.log('info', '销毁WebSocket适配器');
            this._clearHeartbeat();
            this.disconnect();
            super.destroy(); // 调用基类销毁方法
        }
    }

    // 工厂函数
    function createWebSocketAdapter(options) {
        return new SimpleWebSocketAdapter(options);
    }

    // 暴露到全局
    window.SimpleWebSocketAdapter = SimpleWebSocketAdapter;
    window.createWebSocketAdapter = createWebSocketAdapter;

    console.info('✅ 优化的WebSocket适配器已加载 (继承WebSocketBase)');

})();