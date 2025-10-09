"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerServiceSDK = void 0;
exports.createCustomerServiceSDK = createCustomerServiceSDK;
/**
 * 客服系统 WebSocket SDK
 * 供独立站前端集成使用
 */
class CustomerServiceSDK {
    constructor(config) {
        this.ws = null;
        this.eventListeners = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.isConnecting = false;
        this.sessionId = null;
        this.config = {
            reconnectInterval: 3000,
            maxReconnectAttempts: 5,
            ...config,
        };
        // 初始化事件监听器映射
        ['connected', 'disconnected', 'message', 'typing', 'error', 'reconnecting', 'staffOnline', 'staffOffline'].forEach(eventType => {
            this.eventListeners.set(eventType, []);
        });
    }
    /**
     * 连接到服务器
     */
    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        this.isConnecting = true;
        try {
            const wsUrl = this.buildWebSocketUrl();
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
        }
        catch (error) {
            this.isConnecting = false;
            this.emit('error', { type: 'connection_failed', error });
            throw error;
        }
    }
    /**
     * 断开连接
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
    /**
     * 发送消息
     */
    sendMessage(content, messageType = 'text', fileUrl) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not connected');
        }
        const message = {
            messageType: 'send_message',
            content,
            senderType: 'customer',
            timestamp: new Date(),
            metadata: {
                messageType,
                fileUrl,
            }
        };
        this.ws.send(JSON.stringify(message));
    }
    /**
     * 上传文件并发送消息
     */
    async uploadFile(file, messageType = 'file') {
        if (!file) {
            throw new Error('No file provided');
        }
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('shopId', this.config.apiKey); // 使用 apiKey 作为 shopId
            formData.append('messageType', messageType);
            formData.append('customerCode', this.config.customerId);
            const uploadResponse = await fetch(`${this.config.serverUrl.replace('ws', 'http')}/api/customer/upload`, {
                method: 'POST',
                body: formData
            });
            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.status}`);
            }
            const uploadData = await uploadResponse.json();
            // 发送包含文件信息的消息
            this.sendMessage(uploadData.original_name, messageType, uploadData.url);
        }
        catch (error) {
            this.emit('error', { type: 'upload_error', error });
            throw error;
        }
    }
    /**
     * 上传图片
     */
    async uploadImage(file) {
        return this.uploadFile(file, 'image');
    }
    /**
     * 发送打字状态
     */
    sendTyping(isTyping) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        const message = {
            messageType: 'typing',
            metadata: { isTyping }
        };
        this.ws.send(JSON.stringify(message));
    }
    /**
     * 获取历史消息
     */
    async getMessageHistory(limit = 50, offset = 0) {
        if (!this.sessionId) {
            throw new Error('No active session');
        }
        try {
            const response = await fetch(`${this.config.serverUrl.replace('ws', 'http')}/api/sessions/${this.sessionId}/messages?limit=${limit}&offset=${offset}`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch message history');
            }
            return await response.json();
        }
        catch (error) {
            this.emit('error', { type: 'api_error', error });
            throw error;
        }
    }
    /**
     * 添加事件监听器
     */
    on(eventType, listener) {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.push(listener);
        this.eventListeners.set(eventType, listeners);
    }
    /**
     * 移除事件监听器
     */
    off(eventType, listener) {
        if (!listener) {
            this.eventListeners.set(eventType, []);
            return;
        }
        const listeners = this.eventListeners.get(eventType) || [];
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
    /**
     * 检查连接状态
     */
    isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    /**
     * 获取当前会话ID
     */
    getSessionId() {
        return this.sessionId;
    }
    // 私有方法
    buildWebSocketUrl() {
        const baseUrl = this.config.serverUrl.replace(/^http/, 'ws');
        return `${baseUrl}/ws/customer/${this.config.apiKey}/${this.config.customerId}`;
    }
    handleOpen() {
        var _a;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // 发送认证消息
        const authMessage = {
            messageType: 'auth',
            metadata: {
                apiKey: this.config.apiKey,
                customerId: this.config.customerId,
                customerName: this.config.customerName,
                customerEmail: this.config.customerEmail,
                customerAvatar: this.config.customerAvatar,
            }
        };
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(authMessage));
        this.emit('connected');
    }
    handleMessage(event) {
        var _a, _b, _c, _d, _e;
        try {
            const message = JSON.parse(event.data);
            switch (message.messageType) {
                case 'auth_success':
                    this.sessionId = message.sessionId || null;
                    break;
                case 'new_message':
                    this.emit('message', {
                        id: (_a = message.metadata) === null || _a === void 0 ? void 0 : _a.id,
                        content: message.content,
                        messageType: ((_b = message.metadata) === null || _b === void 0 ? void 0 : _b.messageType) || 'text',
                        senderId: message.senderId,
                        senderType: message.senderType,
                        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
                        sessionId: message.sessionId,
                        fileUrl: (_c = message.metadata) === null || _c === void 0 ? void 0 : _c.fileUrl,
                    });
                    break;
                case 'typing':
                    this.emit('typing', {
                        isTyping: (_d = message.metadata) === null || _d === void 0 ? void 0 : _d.isTyping,
                        senderId: message.senderId,
                    });
                    break;
                case 'staff_status':
                    if ((_e = message.metadata) === null || _e === void 0 ? void 0 : _e.isOnline) {
                        this.emit('staffOnline', message.metadata);
                    }
                    else {
                        this.emit('staffOffline', message.metadata);
                    }
                    break;
                default:
                    console.warn('Unknown message type:', message.messageType);
            }
        }
        catch (error) {
            this.emit('error', { type: 'message_parse_error', error });
        }
    }
    handleClose() {
        this.isConnecting = false;
        this.emit('disconnected');
        // 尝试重连
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });
            this.reconnectTimer = setTimeout(() => {
                this.reconnectAttempts++;
                this.connect().catch(() => {
                    // 重连失败，继续尝试
                });
            }, this.config.reconnectInterval);
        }
    }
    handleError(error) {
        this.isConnecting = false;
        this.emit('error', { type: 'websocket_error', error });
    }
    emit(eventType, data) {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            }
            catch (error) {
                console.error(`Error in event listener for ${eventType}:`, error);
            }
        });
    }
}
exports.CustomerServiceSDK = CustomerServiceSDK;
// 导出默认实例创建函数
function createCustomerServiceSDK(config) {
    return new CustomerServiceSDK(config);
}
// 默认导出
exports.default = CustomerServiceSDK;
if (typeof window !== 'undefined') {
    window.CustomerServiceSDK = CustomerServiceSDK;
    window.createCustomerServiceSDK = createCustomerServiceSDK;
}
//# sourceMappingURL=index.js.map