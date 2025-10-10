"use strict";
/**
 * 高级客服聊天SDK - 支持多媒体消息
 * 功能：文本、图片、文件、语音消息
 * 一键集成到独立站
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedCustomerServiceSDK = void 0;
/**
 * 高级客服聊天SDK主类
 */
class AdvancedCustomerServiceSDK {
    constructor(config) {
        this.ws = null;
        this.eventListeners = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.isConnecting = false;
        this.sessionId = null;
        // 文件上传相关
        this.uploadEndpoint = '/api/upload';
        this.currentUploads = new Map();
        // 音频录制相关
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.config = {
            features: {
                enableFileUpload: true,
                enableImageUpload: true,
                enableAudioRecording: true,
                enableVideoCall: false,
                maxFileSize: 10, // 10MB
                allowedFileTypes: ['image/*', 'application/pdf', 'text/*', '.doc', '.docx', '.xls', '.xlsx']
            },
            ui: {
                theme: 'light',
                primaryColor: '#007bff',
                position: 'bottom-right',
                language: 'zh-CN',
                showTypingIndicator: true,
                showOnlineStatus: true
            },
            connection: {
                reconnectInterval: 3000,
                maxReconnectAttempts: 5,
                timeout: 30000
            },
            ...config
        };
        this.initializeEventListeners();
        this.createChatWidget();
    }
    /**
     * 连接到客服系统
     */
    async connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        this.isConnecting = true;
        try {
            const wsUrl = `${this.config.serverUrl}/ws/customer/${this.config.shopId}/${encodeURIComponent(this.config.customerId)}`;
            console.log(`[CustomerService] 连接到: ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = this.handleOpen.bind(this);
            this.ws.onmessage = this.handleMessage.bind(this);
            this.ws.onclose = this.handleClose.bind(this);
            this.ws.onerror = this.handleError.bind(this);
        }
        catch (error) {
            this.isConnecting = false;
            this.emit('error', error);
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
            this.ws.close(1000, 'User disconnected');
            this.ws = null;
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;
    }
    /**
     * 发送文本消息
     */
    sendMessage(content) {
        this.sendChatMessage({
            messageType: 'text',
            content,
            senderType: 'customer',
            timestamp: new Date()
        });
    }
    /**
     * 发送图片消息
     */
    async sendImage(file) {
        var _a;
        if (!((_a = this.config.features) === null || _a === void 0 ? void 0 : _a.enableImageUpload)) {
            throw new Error('图片上传功能未启用');
        }
        if (!file.type.startsWith('image/')) {
            throw new Error('请选择图片文件');
        }
        try {
            const uploadResult = await this.uploadFile(file);
            this.sendChatMessage({
                messageType: 'image',
                content: file.name,
                fileUrl: uploadResult.url,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                thumbnail: uploadResult.thumbnail,
                senderType: 'customer',
                timestamp: new Date()
            });
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * 发送文件消息
     */
    async sendFile(file) {
        var _a;
        if (!((_a = this.config.features) === null || _a === void 0 ? void 0 : _a.enableFileUpload)) {
            throw new Error('文件上传功能未启用');
        }
        const maxSize = (this.config.features.maxFileSize || 10) * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error(`文件大小超过限制 (${this.config.features.maxFileSize}MB)`);
        }
        try {
            const uploadResult = await this.uploadFile(file);
            this.sendChatMessage({
                messageType: 'file',
                content: file.name,
                fileUrl: uploadResult.url,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                senderType: 'customer',
                timestamp: new Date()
            });
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * 开始录音
     */
    async startAudioRecording() {
        var _a;
        if (!((_a = this.config.features) === null || _a === void 0 ? void 0 : _a.enableAudioRecording)) {
            throw new Error('语音录制功能未启用');
        }
        if (this.isRecording) {
            throw new Error('正在录音中');
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.isRecording = true;
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                const audioFile = new File([audioBlob], `voice_${Date.now()}.wav`, { type: 'audio/wav' });
                try {
                    await this.sendAudio(audioFile);
                }
                catch (error) {
                    this.emit('error', error);
                }
                // 清理资源
                stream.getTracks().forEach(track => track.stop());
                this.isRecording = false;
            };
            this.mediaRecorder.start();
            this.emit('audio-recording-start', null);
        }
        catch (error) {
            this.emit('error', new Error('无法访问麦克风'));
            throw error;
        }
    }
    /**
     * 停止录音
     */
    stopAudioRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.emit('audio-recording-stop', null);
        }
    }
    /**
     * 发送语音消息
     */
    async sendAudio(file) {
        try {
            const uploadResult = await this.uploadFile(file);
            this.sendChatMessage({
                messageType: 'audio',
                content: '语音消息',
                fileUrl: uploadResult.url,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type,
                duration: uploadResult.duration,
                senderType: 'customer',
                timestamp: new Date()
            });
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    /**
     * 文件上传
     */
    async uploadFile(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('shopId', this.config.shopId.toString());
            formData.append('customerId', this.config.customerId);
            const xhr = new XMLHttpRequest();
            const uploadId = `upload_${Date.now()}`;
            this.currentUploads.set(uploadId, xhr);
            xhr.upload.onprogress = (event) => {
                var _a, _b;
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100;
                    this.emit('file-upload-progress', { uploadId, progress });
                    (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onFileUploadProgress) === null || _b === void 0 ? void 0 : _b.call(_a, progress);
                }
            };
            xhr.onload = () => {
                var _a, _b;
                this.currentUploads.delete(uploadId);
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        this.emit('file-upload-complete', result);
                        (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onFileUploadComplete) === null || _b === void 0 ? void 0 : _b.call(_a, result.url);
                        resolve(result);
                    }
                    catch (error) {
                        reject(new Error('上传响应解析失败'));
                    }
                }
                else {
                    reject(new Error(`上传失败: ${xhr.status} ${xhr.statusText}`));
                }
            };
            xhr.onerror = () => {
                this.currentUploads.delete(uploadId);
                reject(new Error('网络错误，上传失败'));
            };
            xhr.open('POST', `${this.config.serverUrl}${this.uploadEndpoint}`);
            xhr.send(formData);
        });
    }
    /**
     * 发送聊天消息（内部方法）
     */
    sendChatMessage(message) {
        var _a;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket连接未建立');
        }
        const fullMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            ...message,
            timestamp: ((_a = message.timestamp) === null || _a === void 0 ? void 0 : _a.toISOString()) || new Date().toISOString()
        };
        const wsMessage = {
            messageType: 'send_message',
            ...fullMessage
        };
        this.ws.send(JSON.stringify(wsMessage));
        // 触发消息事件（显示在界面上）
        this.emit('message', fullMessage);
    }
    /**
     * WebSocket事件处理
     */
    handleOpen() {
        var _a, _b;
        console.log('[CustomerService] WebSocket连接成功');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // 发送认证信息
        this.sendAuthMessage();
        this.emit('connected', null);
        (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onConnect) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    handleMessage(event) {
        var _a, _b;
        try {
            const message = JSON.parse(event.data);
            console.log('[CustomerService] 收到消息:', message);
            switch (message.messageType) {
                case 'auth_success':
                    this.sessionId = message.sessionId;
                    break;
                case 'message':
                case 'image':
                case 'file':
                case 'audio':
                    this.emit('message', message);
                    (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onMessage) === null || _b === void 0 ? void 0 : _b.call(_a, message);
                    break;
                case 'staff_online':
                    this.emit('staff-online', message);
                    break;
                case 'staff_offline':
                    this.emit('staff-offline', message);
                    break;
                case 'typing':
                    this.emit('typing', message);
                    break;
                default:
                    console.log('[CustomerService] 未知消息类型:', message.messageType);
            }
        }
        catch (error) {
            console.error('[CustomerService] 消息解析错误:', error);
        }
    }
    handleClose(event) {
        var _a, _b, _c;
        console.log('[CustomerService] WebSocket连接关闭');
        this.isConnecting = false;
        this.emit('disconnected', { code: event.code, reason: event.reason });
        (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onDisconnect) === null || _b === void 0 ? void 0 : _b.call(_a);
        // 自动重连
        if (!event.wasClean && this.reconnectAttempts < (((_c = this.config.connection) === null || _c === void 0 ? void 0 : _c.maxReconnectAttempts) || 5)) {
            this.scheduleReconnect();
        }
    }
    handleError(error) {
        var _a, _b;
        console.error('[CustomerService] WebSocket错误:', error);
        this.emit('error', error);
        (_b = (_a = this.config.callbacks) === null || _a === void 0 ? void 0 : _a.onError) === null || _b === void 0 ? void 0 : _b.call(_a, error);
    }
    /**
     * 发送认证消息
     */
    sendAuthMessage() {
        const authMessage = {
            messageType: 'auth',
            customerId: this.config.customerId,
            customerName: this.config.customerName,
            customerEmail: this.config.customerEmail,
            customerAvatar: this.config.customerAvatar,
            shopId: this.config.shopId,
            timestamp: new Date().toISOString()
        };
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(authMessage));
        }
    }
    /**
     * 计划重连
     */
    scheduleReconnect() {
        var _a;
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`[CustomerService] ${delay / 1000}秒后重连 (${this.reconnectAttempts}/${(_a = this.config.connection) === null || _a === void 0 ? void 0 : _a.maxReconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
    /**
     * 初始化事件监听器映射
     */
    initializeEventListeners() {
        const events = [
            'connected', 'disconnected', 'message', 'typing', 'staff-online', 'staff-offline',
            'error', 'file-upload-progress', 'file-upload-complete', 'audio-recording-start', 'audio-recording-stop'
        ];
        events.forEach(event => {
            this.eventListeners.set(event, []);
        });
    }
    /**
     * 事件监听
     */
    on(event, callback) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.push(callback);
        this.eventListeners.set(event, listeners);
    }
    /**
     * 移除事件监听
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event) || [];
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
    /**
     * 触发事件
     */
    emit(event, data) {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            }
            catch (error) {
                console.error(`[CustomerService] 事件回调错误 (${event}):`, error);
            }
        });
    }
    /**
     * 创建聊天组件UI（可选的内置UI）
     */
    createChatWidget() {
        // 这里可以创建一个完整的聊天UI组件
        // 包括消息列表、输入框、文件上传按钮、录音按钮等
        // 具体实现会很长，可以单独创建
    }
    /**
     * 销毁SDK
     */
    destroy() {
        this.disconnect();
        this.eventListeners.clear();
        this.currentUploads.forEach(xhr => xhr.abort());
        this.currentUploads.clear();
        if (this.mediaRecorder && this.isRecording) {
            this.stopAudioRecording();
        }
    }
}
exports.AdvancedCustomerServiceSDK = AdvancedCustomerServiceSDK;
// 默认导出
exports.default = AdvancedCustomerServiceSDK;
//# sourceMappingURL=advanced-sdk.js.map