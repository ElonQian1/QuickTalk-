/**
 * 统一WebSocket客户端库
 * 替换分散在各处的重复WebSocket实现
 * 支持桌面端、移动端、嵌入代码等多种场景
 */

class UnifiedWebSocketClient {
    constructor(options = {}) {
        // 基础配置
        this.serverUrl = options.serverUrl || this.getDefaultServerUrl();
        this.wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws';
        
        // 功能配置
        this.enableReconnect = options.reconnect !== false;
        this.enableHeartbeat = options.heartbeat !== false;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.reconnectInterval = options.reconnectInterval || 3000;
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        
        // 环境适配
        this.isMobile = options.mobile || this.detectMobile();
        this.isEmbed = options.embed || false;
        this.debug = options.debug || false;
        
        // 状态管理
        this.ws = null;
        this.isConnected = false;
        this.reconnectCount = 0;
        this.lastPingTime = 0;
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        
        // 事件回调
        this.onOpenCallback = null;
        this.onMessageCallback = null;
        this.onCloseCallback = null;
        this.onErrorCallback = null;
        this.onReconnectCallback = null;
        
        // 用户信息
        this.userId = options.userId || null;
        this.shopId = options.shopId || null;
        this.sessionId = options.sessionId || this.generateSessionId();
        
        this.log('🔌 UnifiedWebSocketClient 初始化完成');
    }

    /**
     * 建立WebSocket连接
     */
    async connect() {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.log('⚠️ WebSocket已连接，无需重复连接');
            return;
        }

        try {
            this.log(`🔗 连接WebSocket: ${this.wsUrl}`);
            
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
            
        } catch (error) {
            this.log('❌ WebSocket连接失败:', error);
            this.handleConnectionError(error);
        }
    }

    /**
     * 发送消息
     */
    send(data) {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.log('⚠️ WebSocket未连接，无法发送消息');
            return false;
        }

        try {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.ws.send(message);
            this.log('📤 发送消息:', data);
            return true;
        } catch (error) {
            this.log('❌ 发送消息失败:', error);
            return false;
        }
    }

    /**
     * 发送认证消息
     */
    authenticate() {
        return this.send({
            type: 'auth',
            userId: this.userId,
            shopId: this.shopId,
            sessionId: this.sessionId,
            clientType: this.getClientType()
        });
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.enableReconnect = false;
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.log('🔌 WebSocket连接已断开');
    }

    // ========== 事件处理方法 ==========

    handleOpen() {
        this.isConnected = true;
        this.reconnectCount = 0;
        
        this.log('✅ WebSocket连接成功');
        
        // 发送认证
        if (this.userId || this.shopId) {
            this.authenticate();
        }
        
        // 启动心跳
        if (this.enableHeartbeat) {
            this.startHeartbeat();
        }
        
        // 触发回调
        if (this.onOpenCallback) {
            this.onOpenCallback();
        }
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            this.log('📥 收到消息:', data);
            
            // 处理心跳响应
            if (data.type === 'pong') {
                this.lastPingTime = Date.now();
                return;
            }
            
            // 处理认证响应
            if (data.type === 'auth_success') {
                this.log('🔐 认证成功');
                return;
            }
            
            // 触发用户回调
            if (this.onMessageCallback) {
                this.onMessageCallback(data);
            }
            
        } catch (error) {
            this.log('❌ 消息解析失败:', error);
            
            // 原始消息回调
            if (this.onMessageCallback) {
                this.onMessageCallback(event.data);
            }
        }
    }

    handleClose(event) {
        this.isConnected = false;
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        this.log(`🔌 WebSocket连接关闭: ${event.code} - ${event.reason || '无原因'}`);
        
        // 触发回调
        if (this.onCloseCallback) {
            this.onCloseCallback(event);
        }
        
        // 尝试重连
        if (this.enableReconnect && this.reconnectCount < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    handleError(error) {
        this.log('❌ WebSocket错误:', error);
        
        if (this.onErrorCallback) {
            this.onErrorCallback(error);
        }
    }

    handleConnectionError(error) {
        this.log('❌ 连接错误:', error);
        
        if (this.enableReconnect && this.reconnectCount < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }

    // ========== 重连机制 ==========

    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }
        
        this.reconnectCount++;
        const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectCount - 1);
        
        this.log(`🔄 ${delay}ms 后尝试第 ${this.reconnectCount} 次重连...`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            
            if (this.onReconnectCallback) {
                this.onReconnectCallback(this.reconnectCount);
            }
            
            this.connect();
        }, delay);
    }

    // ========== 心跳机制 ==========

    startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
        
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, this.heartbeatInterval);
    }

    // ========== 事件监听器 ==========

    onOpen(callback) {
        this.onOpenCallback = callback;
        return this;
    }

    onMessage(callback) {
        this.onMessageCallback = callback;
        return this;
    }

    onClose(callback) {
        this.onCloseCallback = callback;
        return this;
    }

    onError(callback) {
        this.onErrorCallback = callback;
        return this;
    }

    onReconnect(callback) {
        this.onReconnectCallback = callback;
        return this;
    }

    // ========== 工具方法 ==========

    getDefaultServerUrl() {
        if (typeof window !== 'undefined' && window.location) {
            return `${window.location.protocol}//${window.location.host}`;
        }
        return 'ws://localhost:3030';
    }

    detectMobile() {
        if (typeof window === 'undefined') return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    }

    getClientType() {
        if (this.isEmbed) return 'embed';
        if (this.isMobile) return 'mobile';
        return 'desktop';
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    log(...args) {
        if (this.debug) {
            console.log('[UnifiedWebSocket]', ...args);
        }
    }

    // ========== 状态查询 ==========

    getConnectionState() {
        return {
            isConnected: this.isConnected,
            readyState: this.ws ? this.ws.readyState : WebSocket.CLOSED,
            reconnectCount: this.reconnectCount,
            userId: this.userId,
            shopId: this.shopId,
            sessionId: this.sessionId
        };
    }
}

// ========== 静态工厂方法 ==========

/**
 * 为桌面端创建WebSocket客户端
 */
UnifiedWebSocketClient.createDesktop = function(options = {}) {
    return new UnifiedWebSocketClient({
        ...options,
        mobile: false,
        embed: false,
        debug: options.debug || true
    });
};

/**
 * 为移动端创建WebSocket客户端
 */
UnifiedWebSocketClient.createMobile = function(options = {}) {
    return new UnifiedWebSocketClient({
        ...options,
        mobile: true,
        embed: false,
        heartbeatInterval: 45000, // 移动端心跳间隔更长
        debug: options.debug || true
    });
};

/**
 * 为嵌入代码创建WebSocket客户端
 */
UnifiedWebSocketClient.createEmbed = function(options = {}) {
    return new UnifiedWebSocketClient({
        ...options,
        embed: true,
        debug: options.debug || false, // 嵌入代码默认不输出调试信息
        heartbeatInterval: 60000 // 嵌入代码心跳间隔最长
    });
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UnifiedWebSocketClient;
} else if (typeof window !== 'undefined') {
    window.UnifiedWebSocketClient = UnifiedWebSocketClient;
}