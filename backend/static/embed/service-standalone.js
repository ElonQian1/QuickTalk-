
/* QuickTalk SDK v2.0.0 - 模块化重构版本 */
/* 解决独立站样式覆盖问题，支持响应式字体和布局 */
(function() {
  'use strict';
  
  // ===== 工具函数模块 =====
  /**
 * 事件管理工具
 * 提供简单的事件发布订阅机制
 */
class EventEmitter {
    constructor() {
        this.listeners = {};
    }
    /**
     * 添加事件监听器
     */
    on(event, handler) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(handler);
    }
    /**
     * 添加一次性事件监听器
     */
    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
    /**
     * 移除事件监听器
     */
    off(event, handler) {
        const eventListeners = this.listeners[event];
        if (eventListeners) {
            const index = eventListeners.indexOf(handler);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }
    /**
     * 触发事件
     */
    emit(event, data) {
        const eventListeners = this.listeners[event];
        if (eventListeners) {
            eventListeners.forEach(handler => {
                try {
                    handler(data);
                }
                catch (error) {
                    console.error(`事件处理器错误 (${String(event)}):`, error);
                }
            });
        }
    }
    /**
     * 移除所有监听器
     */
    removeAllListeners(event) {
        if (event) {
            delete this.listeners[event];
        }
        else {
            this.listeners = {};
        }
    }
    /**
     * 获取事件监听器数量
     */
    listenerCount(event) {
        var _a, _b;
        return (_b = (_a = this.listeners[event]) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    }
}
/**
 * 工具函数：检查页面是否已准备好
 */
function onReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    }
    else {
        callback();
    }
}
/**
 * 工具函数：防抖
 */
function debounce(func, wait) {
    let timeout = null;
    return (...args) => {
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = window.setTimeout(() => func(...args), wait);
    };
}
/**
 * 工具函数：节流
 */
function throttle(func, wait) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, wait);
        }
    };
}
/**
 * 工具函数：延迟执行
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 工具函数：获取设备信息
 */
function getDeviceInfo() {
    const userAgent = navigator.userAgent;
    return {
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
        isIOS: /iPad|iPhone|iPod/.test(userAgent),
        isAndroid: /Android/.test(userAgent),
        isChrome: /Chrome/.test(userAgent),
        isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
        isFirefox: /Firefox/.test(userAgent),
        hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        devicePixelRatio: window.devicePixelRatio || 1,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
    };
}

  
  // ===== 文本格式化模块 =====
  // SDK专用的文本格式化工具
// 不依赖React，可在纯JavaScript环境中使用
// 表情列表
const EMOJI_LIST = [
    '😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵',
    '👋', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞',
    '❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖',
    '🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '💎', '💫', '🌟'
];
/**
 * 检测是否为纯表情消息
 */
function isEmojiOnlyMessage(content) {
    const trimmed = content.trim();
    // 长度检查
    if (trimmed.length === 0 || trimmed.length > 6) {
        return false;
    }
    // 检查是否为常见表情
    if (EMOJI_LIST.includes(trimmed)) {
        return true;
    }
    // 检查是否包含字母、数字或中文
    const hasAlphanumeric = /[a-zA-Z0-9\u4e00-\u9fff]/.test(trimmed);
    return !hasAlphanumeric;
}
/**
 * 将URL转换为可点击的链接
 */
function linkifyText(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1976d2; text-decoration: underline;">$1</a>');
}
/**
 * 格式化文本内容，处理换行、链接等
 */
function formatMessageContent(content) {
    if (!content)
        return '';
    // 1. 处理链接
    let formatted = linkifyText(content);
    return formatted;
}
/**
 * 为DOM元素设置格式化文本内容
 */
function setFormattedTextContent(element, content) {
    if (!content) {
        element.textContent = '';
        return;
    }
    // 检查是否为纯表情消息
    if (isEmojiOnlyMessage(content)) {
        element.innerHTML = content;
        element.style.fontSize = '28px';
        element.style.lineHeight = '1.2';
        element.style.textAlign = 'center';
        element.style.padding = '6px 0';
        element.style.minWidth = '40px';
        return;
    }
    // 设置样式以保留换行符
    element.style.whiteSpace = 'pre-wrap';
    element.style.wordWrap = 'break-word';
    element.style.lineHeight = '1.4';
    // 格式化内容并设置
    const formattedContent = formatMessageContent(content);
    element.innerHTML = formattedContent;
    // 为链接添加点击事件处理
    const links = element.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(link.getAttribute('href') || '', '_blank', 'noopener,noreferrer');
        });
    });
}
/**
 * 文本格式化工具类
 */
const TextFormatter = {
    isEmojiOnly: isEmojiOnlyMessage,
    linkify: linkifyText,
    format: formatMessageContent,
    setDOMContent: setFormattedTextContent,
    emojiList: EMOJI_LIST
};

  
  // ===== 核心配置模块 =====
  /**
 * 核心配置管理模块
 * 负责服务器检测、配置缓存、版本管理
 */
class ConfigManager {
    constructor() {
        this.serverConfigCache = null;
        this.configCacheTime = 10 * 60 * 1000; // 10分钟缓存
        this.lastConfigFetch = 0;
        this.clientVersion = '2.0.0';
    }
    static getInstance() {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }
    /**
     * 智能服务器地址检测
     * 优先检测当前域名的标准端口，然后尝试备选方案
     */
    detectServerCandidates() {
        const currentUrl = window.location;
        const candidates = [
            // 优先尝试当前域名的标准端口
            `${currentUrl.protocol}//${currentUrl.hostname}:8080`,
            // 尝试相同协议和端口
            `${currentUrl.protocol}//${currentUrl.host}`,
            // 开发环境后备选项 - 支持HTTPS
            'https://localhost:8080',
            'http://localhost:8080',
            'https://127.0.0.1:8080',
            'http://127.0.0.1:8080'
        ];
        // 去重处理
        return Array.from(new Set(candidates));
    }
    /**
     * 异步检测可用的服务器地址
     */
    async findAvailableServer() {
        // 检查缓存
        if (this.serverConfigCache &&
            (Date.now() - this.lastConfigFetch) < this.configCacheTime) {
            return this.serverConfigCache;
        }
        const candidates = this.detectServerCandidates();
        const errors = [];
        for (const url of candidates) {
            try {
                const config = await this.testServerConnection(url);
                // 成功获取配置，缓存结果
                this.serverConfigCache = config;
                this.lastConfigFetch = Date.now();
                console.log(`✅ 服务器连接成功: ${url}`);
                return config;
            }
            catch (error) {
                errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
                console.warn(`❌ 服务器连接失败: ${url}`);
            }
        }
        throw new Error(`所有服务器候选地址都无法连接: ${errors.join(', ')}`);
    }
    /**
     * 测试单个服务器连接
     */
    async testServerConnection(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        try {
            const response = await fetch(`${url}/api/config`, {
                method: 'GET',
                mode: 'cors',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const config = await response.json();
            return {
                version: config.version || 'unknown',
                serverUrl: url,
                wsUrl: config.wsUrl || url.replace(/^https?/, url.startsWith('https') ? 'wss' : 'ws'),
                endpoints: config.endpoints
            };
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * 版本检测和更新提醒
     */
    async checkForUpdates(serverUrl) {
        try {
            const response = await fetch(`${serverUrl}/api/sdk/version`);
            const data = await response.json();
            if (data.version && data.version !== this.clientVersion) {
                console.log(`🔄 检测到新版本: ${data.version} (当前版本: ${this.clientVersion})`);
                // 可以在这里添加更新通知逻辑
            }
        }
        catch (error) {
            // 忽略版本检查错误
            console.debug('版本检查失败:', error);
        }
    }
    /**
     * 获取客户端版本
     */
    getClientVersion() {
        return this.clientVersion;
    }
    /**
     * 清除配置缓存（用于重连等场景）
     */
    clearCache() {
        this.serverConfigCache = null;
        this.lastConfigFetch = 0;
    }
    /**
     * 生成随机客户ID
     */
    generateCustomerId() {
        return 'guest-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
}

  
  // ===== WebSocket客户端模块 =====
  /**
 * WebSocket 客户端模块
 * 负责WebSocket连接管理、消息处理、文件上传
 */
class WebSocketClient {
    /**
     * 协议适配工具函数 - 统一的协议适配策略
     */
    adaptUrlProtocol(url) {
        var _a;
        if (!url || typeof url !== 'string') {
            return url;
        }
        // 如果是相对路径、数据URL或已经是HTTPS，直接返回
        if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('https://')) {
            return url;
        }
        // 判断是否为开发环境：当前页面域名是localhost或127.0.0.1
        const isCurrentHostDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        // 判断目标URL是否为localhost开发服务器
        const isTargetLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
        // 若目标是 localhost/127.0.0.1 且我们已探测到后端真实对外地址，则将主机与协议改写为后端 serverUrl
        // 这样第三方 HTTPS 页面不会去请求 https://localhost:xxxx（既跨主机又常无证书）
        try {
            const parsed = new URL(url);
            const isLocalHostName = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
            if (isLocalHostName && ((_a = this.serverConfig) === null || _a === void 0 ? void 0 : _a.serverUrl)) {
                const server = new URL(this.serverConfig.serverUrl);
                const rewritten = `${server.protocol}//${server.host}${parsed.pathname}${parsed.search}`;
                console.log('🔧 WebSocketClient 改写本地地址为服务器地址:', {
                    original: url,
                    rewritten,
                    serverUrl: this.serverConfig.serverUrl,
                    reason: '避免第三方站点访问 localhost 导致加载失败/证书错误'
                });
                return rewritten;
            }
        }
        catch (e) {
            // 非法URL或解析失败，继续走后续逻辑
        }
        // 如果当前页面是HTTPS且URL是HTTP，通常需要转换
        if (window.location.protocol === 'https:' && url.startsWith('http://')) {
            // 对于 localhost/127.0.0.1 场景，不强制转换为 HTTPS，以避免目标端口未启用 TLS 导致的协议错误
            if (isTargetLocalhost) {
                console.log('🔧 WebSocketClient 保持本地开发URL协议（避免 ERR_SSL_PROTOCOL_ERROR）:', { url });
                return url;
            }
            // 生产环境HTTPS页面访问外部HTTP资源，需要转换
            const adaptedUrl = url.replace('http://', 'https://');
            console.log('🔧 WebSocketClient协议适配:', {
                original: url,
                adapted: adaptedUrl,
                reason: 'HTTPS页面访问外部HTTP资源',
                currentHost: window.location.hostname,
                isCurrentHostDev,
                isTargetLocalhost
            });
            return adaptedUrl;
        }
        // HTTP页面或无需转换
        console.log('🔧 WebSocketClient URL保持原样:', {
            url,
            currentProtocol: window.location.protocol,
            currentHost: window.location.hostname,
            reason: 'HTTP页面或无需转换'
        });
        return url;
    }
    constructor(shopId, customerId) {
        this.ws = null;
        this.serverConfig = null;
        // 事件处理器
        this.messageHandlers = [];
        this.connectHandlers = [];
        this.errorHandlers = [];
        this.disconnectHandlers = [];
        // 连接状态
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.shopId = shopId;
        this.configManager = ConfigManager.getInstance();
        this.customerId = customerId || this.generateCustomerId();
    }
    /**
     * 生成随机客户ID
     */
    generateCustomerId() {
        return this.configManager.generateCustomerId();
    }
    /**
     * 连接到WebSocket服务器
     */
    async connect(serverUrl) {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return;
        }
        this.isConnecting = true;
        try {
            // 获取服务器配置
            if (serverUrl) {
                // 使用指定的服务器地址
                this.serverConfig = {
                    serverUrl,
                    wsUrl: serverUrl.replace(/^https?/, serverUrl.startsWith('https') ? 'wss' : 'ws'),
                    version: 'manual'
                };
            }
            else {
                // 自动检测服务器
                this.serverConfig = await this.configManager.findAvailableServer();
            }
            await this.connectWebSocket();
        }
        catch (error) {
            this.isConnecting = false;
            const errorMsg = error instanceof Error ? error.message : '连接失败';
            this.notifyError(new Error(`WebSocket连接失败: ${errorMsg}`));
            throw error;
        }
    }
    /**
     * 建立WebSocket连接
     */
    async connectWebSocket() {
        var _a, _b;
        if (!this.serverConfig) {
            throw new Error('服务器配置未找到');
        }
        // 构建WebSocket URL
        let wsUrl;
        if ((_b = (_a = this.serverConfig.endpoints) === null || _a === void 0 ? void 0 : _a.websocket) === null || _b === void 0 ? void 0 : _b.customer) {
            wsUrl = `${this.serverConfig.endpoints.websocket.customer}/${this.shopId}/${this.customerId}`;
        }
        else {
            const wsBase = this.serverConfig.wsUrl ||
                this.serverConfig.serverUrl.replace(/^https?/, this.serverConfig.serverUrl.startsWith('https') ? 'wss' : 'ws');
            wsUrl = `${wsBase}/ws/customer/${this.shopId}/${this.customerId}`;
        }
        console.log(`🔗 连接WebSocket: ${wsUrl}`);
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);
                this.ws.onopen = () => {
                    console.log('✅ WebSocket连接成功');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0;
                    // 发送认证消息
                    this.sendAuthMessage();
                    // 通知连接成功
                    this.notifyConnect(this.serverConfig);
                    // 开始版本检查
                    this.configManager.checkForUpdates(this.serverConfig.serverUrl);
                    resolve();
                };
                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
                this.ws.onclose = (event) => {
                    console.log('🔌 WebSocket连接关闭', event.code, event.reason);
                    this.isConnecting = false;
                    this.notifyDisconnect();
                    // 如果不是正常关闭，尝试重连
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.scheduleReconnect();
                    }
                };
                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket错误:', error);
                    this.isConnecting = false;
                    this.notifyError(new Error('WebSocket连接错误'));
                    reject(error);
                };
                // 连接超时处理
                setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
                        this.ws.close();
                        reject(new Error('WebSocket连接超时'));
                    }
                }, 10000);
            }
            catch (error) {
                this.isConnecting = false;
                reject(error);
            }
        });
    }
    /**
     * 发送认证消息
     */
    sendAuthMessage() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const authMessage = {
                messageType: 'auth',
                metadata: {
                    apiKey: this.shopId,
                    customerId: this.customerId
                }
            };
            this.ws.send(JSON.stringify(authMessage));
        }
    }
    /**
     * 处理接收到的消息
     */
    handleMessage(data) {
        var _a;
        try {
            const message = JSON.parse(data);
            // 添加调试日志
            console.log('🔍 收到原始WebSocket消息:', {
                messageType: message.messageType,
                content: message.content,
                senderType: message.senderType,
                file_url: message.file_url,
                fileUrl: message.fileUrl, // 检查驼峰命名
                file_name: message.file_name,
                fileName: message.fileName,
                metadata: message.metadata
            });
            if (message.messageType === 'new_message' && message.content) {
                // 获取文件URL并进行协议适配
                const rawFileUrl = message.fileUrl || message.file_url;
                const adaptedFileUrl = rawFileUrl ? this.adaptUrlProtocol(rawFileUrl) : undefined;
                const chatMessage = {
                    content: message.content,
                    messageType: ((_a = message.metadata) === null || _a === void 0 ? void 0 : _a.messageType) || 'text',
                    senderType: message.senderType || 'staff',
                    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
                    fileUrl: adaptedFileUrl, // 使用协议适配后的URL
                    fileName: message.fileName || message.file_name, // 优先使用驼峰命名，备用下划线命名
                    sessionId: message.sessionId,
                    senderId: message.senderId
                };
                // 添加解析后的消息调试日志
                console.log('📨 解析后的聊天消息:', {
                    content: chatMessage.content,
                    messageType: chatMessage.messageType,
                    senderType: chatMessage.senderType,
                    fileUrl: chatMessage.fileUrl,
                    fileName: chatMessage.fileName
                });
                // 只处理来自客服人员的消息，忽略客户自己发送的消息回显
                if (chatMessage.senderType === 'staff') {
                    console.log('✅ 处理客服消息');
                    this.notifyMessage(chatMessage);
                }
                else {
                    console.log('🔄 忽略客户消息回显:', chatMessage.content);
                }
            }
        }
        catch (error) {
            console.error('消息解析错误:', error);
        }
    }
    /**
     * 发送文本消息
     */
    sendMessage(content, messageType = 'text') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket未连接，无法发送消息');
            return;
        }
        const messageData = {
            messageType: 'send_message',
            content,
            senderType: 'customer',
            metadata: { messageType }
        };
        this.ws.send(JSON.stringify(messageData));
        console.log('📤 发送消息:', content);
    }
    /**
     * 发送文件消息（图片、文件、语音等）
     */
    sendFileMessage(fileUrl, fileName, messageType) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ WebSocket未连接，无法发送文件消息');
            return;
        }
        const messageData = {
            messageType: 'send_message',
            content: messageType === 'image' ? fileName : fileUrl, // 图片消息显示文件名，其他显示URL
            senderType: 'customer',
            metadata: {
                messageType,
                mediaUrl: fileUrl, // 文件URL放在metadata中
                fileName: fileName
            }
        };
        this.ws.send(JSON.stringify(messageData));
        console.log('📤 发送文件消息:', { fileUrl, fileName, messageType });
    }
    /**
     * 上传文件
     */
    async uploadFile(file, messageType = 'file') {
        var _a;
        if (!this.serverConfig) {
            throw new Error('服务器配置未加载');
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('shopId', this.shopId);
        formData.append('messageType', messageType);
        formData.append('customerCode', this.customerId);
        // 构建上传URL
        const uploadUrl = ((_a = this.serverConfig.endpoints) === null || _a === void 0 ? void 0 : _a.upload) ||
            `${this.serverConfig.serverUrl}/api/customer/upload`;
        try {
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                throw new Error(`上传失败: HTTP ${response.status}`);
            }
            const result = await response.json();
            // 协议适配 - 确保URL协议与当前页面一致
            const adaptedUrl = this.adaptUrlProtocol(result.url);
            // 自动发送文件消息
            this.sendFileMessage(adaptedUrl, file.name, messageType);
            console.log('📎 文件上传成功:', { ...result, adaptedUrl });
            return {
                url: adaptedUrl,
                fileName: file.name
            };
        }
        catch (error) {
            console.error('📎 文件上传失败:', error);
            throw error;
        }
    }
    /**
     * 计划重连
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
        console.log(`🔄 ${delay}ms后尝试第${this.reconnectAttempts}次重连...`);
        setTimeout(() => {
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                this.connect();
            }
            else {
                console.error('❌ 达到最大重连次数，停止重连');
                this.notifyError(new Error('连接失败，请刷新页面重试'));
            }
        }, delay);
    }
    /**
     * 手动重连
     */
    reconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.configManager.clearCache(); // 清除配置缓存
        this.connect();
    }
    /**
     * 断开连接
     */
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, '用户主动断开');
            this.ws = null;
        }
        this.isConnecting = false;
    }
    /**
     * 获取连接状态
     */
    getConnectionState() {
        if (!this.ws)
            return 'closed';
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'open';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'closed';
        }
    }
    /**
     * 获取服务器配置
     */
    getServerConfig() {
        return this.serverConfig;
    }
    /**
     * 获取客户ID
     */
    getCustomerId() {
        return this.customerId;
    }
    // 事件监听器管理
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }
    onConnect(handler) {
        this.connectHandlers.push(handler);
    }
    onError(handler) {
        this.errorHandlers.push(handler);
    }
    onDisconnect(handler) {
        this.disconnectHandlers.push(handler);
    }
    // 移除事件监听器
    removeMessageHandler(handler) {
        const index = this.messageHandlers.indexOf(handler);
        if (index > -1)
            this.messageHandlers.splice(index, 1);
    }
    removeConnectHandler(handler) {
        const index = this.connectHandlers.indexOf(handler);
        if (index > -1)
            this.connectHandlers.splice(index, 1);
    }
    removeErrorHandler(handler) {
        const index = this.errorHandlers.indexOf(handler);
        if (index > -1)
            this.errorHandlers.splice(index, 1);
    }
    removeDisconnectHandler(handler) {
        const index = this.disconnectHandlers.indexOf(handler);
        if (index > -1)
            this.disconnectHandlers.splice(index, 1);
    }
    // 事件通知方法
    notifyMessage(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            }
            catch (error) {
                console.error('消息处理器错误:', error);
            }
        });
    }
    notifyConnect(config) {
        this.connectHandlers.forEach(handler => {
            try {
                handler(config);
            }
            catch (error) {
                console.error('连接处理器错误:', error);
            }
        });
    }
    notifyError(error) {
        this.errorHandlers.forEach(handler => {
            try {
                handler(error);
            }
            catch (error) {
                console.error('错误处理器错误:', error);
            }
        });
    }
    notifyDisconnect() {
        this.disconnectHandlers.forEach(handler => {
            try {
                handler();
            }
            catch (error) {
                console.error('断开处理器错误:', error);
            }
        });
    }
    /**
     * 清理资源
     */
    cleanup() {
        this.disconnect();
        this.messageHandlers = [];
        this.connectHandlers = [];
        this.errorHandlers = [];
        this.disconnectHandlers = [];
    }
}

  
  // ===== 样式系统模块 =====
  /**
 * 响应式样式系统
 * 解决独立站样式覆盖问题，确保字体和窗口按比例缩放
 */
class StyleSystem {
    constructor() {
        this.styleElement = null;
        this.cssPrefix = 'qt-sdk-'; // CSS类名前缀，避免冲突
        this.namespace = 'quicktalk-embed'; // 命名空间
    }
    static getInstance() {
        if (!StyleSystem.instance) {
            StyleSystem.instance = new StyleSystem();
        }
        return StyleSystem.instance;
    }
    /**
     * 检测当前视口信息
     */
    detectViewport() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        // 断点定义 - 基于常见设备尺寸
        let breakpoint;
        if (width < 480)
            breakpoint = 'xs'; // 小屏手机
        else if (width < 768)
            breakpoint = 'sm'; // 大屏手机
        else if (width < 1024)
            breakpoint = 'md'; // 平板
        else if (width < 1440)
            breakpoint = 'lg'; // 小屏桌面
        else
            breakpoint = 'xl'; // 大屏桌面
        // 设备类型判断 - 与calculateStyleConfig保持一致
        const userAgent = navigator.userAgent;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        // 使用与calculateStyleConfig相同的逻辑
        const isRealMobile = width < 600 || (isMobileUA && width < 900);
        const isRealTablet = (width >= 600 && width <= 1300 && height >= 800) ||
            (width >= 1000 && width <= 1100 && height >= 1300);
        const isRealDesktop = width > 1300 || (width > 1100 && height < 900);
        // 最终设备类型
        const isMobile = isRealMobile;
        const isTablet = isRealTablet && !isRealMobile;
        const isDesktop = isRealDesktop && !isRealMobile && !isRealTablet;
        const orientation = width > height ? 'landscape' : 'portrait';
        return {
            width,
            height,
            breakpoint,
            isMobile,
            isTablet,
            isDesktop,
            devicePixelRatio: dpr,
            orientation
        };
    }
    /**
     * 基于视口计算响应式样式配置
     * 重点解决字体过小问题，确保字体和窗口按比例缩放
     */
    calculateStyleConfig(viewport) {
        const { width, height, breakpoint, isMobile, devicePixelRatio } = viewport;
        // 基础字体大小计算 - 高分辨率友好的响应式算法
        let baseFontSize;
        // 计算设备的实际使用场景和分辨率
        // 优化移动设备检测，特别针对F12模拟器场景
        const isRealMobile = width < 600 || (isMobile && width < 900) ||
            (width <= 480); // F12模拟器中的小屏设备
        const isRealTablet = !isRealMobile && ((width >= 600 && width <= 1300 && height >= 800) ||
            (width >= 1000 && width <= 1100 && height >= 1300));
        const isRealDesktop = !isRealMobile && !isRealTablet &&
            (width > 1300 || (width > 1100 && height < 900));
        // 高分辨率检测 - 降低阈值，包含更多设备
        const isHighRes = height > 1200 || (devicePixelRatio >= 2 && height > 1000);
        if (isRealMobile) {
            // 移动端：特别照顾高分辨率设备
            if (isHighRes) {
                // 高分辨率移动端：基于高度的激进算法
                const heightFactor = Math.max(1.2, Math.min(3.0, height / 800));
                baseFontSize = Math.round(20 * heightFactor * Math.max(1, devicePixelRatio / 2));
                baseFontSize = Math.max(35, Math.min(60, baseFontSize));
            }
            else {
                // 普通移动端：温和的响应式
                const heightFactor = Math.max(1.0, Math.min(2.0, height / 800));
                baseFontSize = Math.round(18 * heightFactor);
                baseFontSize = Math.max(20, Math.min(35, baseFontSize));
            }
        }
        else if (isRealTablet) {
            // 平板：基于屏幕面积和分辨率
            const sizeFactor = Math.max(1.0, Math.min(2.0, Math.sqrt(width * height) / 1000));
            const dpiFactor = Math.max(1, Math.min(1.5, devicePixelRatio / 1.5));
            baseFontSize = Math.round(22 * sizeFactor * dpiFactor);
            baseFontSize = Math.max(26, Math.min(45, baseFontSize));
        }
        else {
            // 桌面端：相对保守但考虑高分辨率显示器
            const sizeFactor = Math.max(0.9, Math.min(1.8, Math.sqrt(width * height) / 1200));
            const dpiFactor = Math.max(1, Math.min(1.3, devicePixelRatio / 1.5));
            baseFontSize = Math.round(18 * sizeFactor * dpiFactor);
            baseFontSize = Math.max(18, Math.min(32, baseFontSize));
        }
        // 其他尺寸基于基础字体按比例计算
        const scale = baseFontSize / 16; // 以16px为基准的缩放比例
        const config = {
            baseFontSize,
            baseLineHeight: 1.5,
            // FAB按钮尺寸 - 确保足够大以便点击，但不能过大
            fabSize: Math.max(56, Math.min(120, Math.round(baseFontSize * 3))), // 限制在56-120px之间
            // 面板尺寸 - 基于视口大小动态计算，分别处理X/Y维度
            panelWidth: (() => {
                // X维度计算：根据视口宽度的百分比，不设上限
                if (isRealMobile) {
                    // 移动端：占用视口宽度的90-95%
                    const widthRatio = width <= 480 ? 0.95 : 0.90;
                    return Math.floor(width * widthRatio);
                }
                else if (isRealTablet) {
                    // 平板端：占用视口宽度的75-85%
                    const widthRatio = width <= 1024 ? 0.85 : 0.75;
                    return Math.floor(width * widthRatio);
                }
                else {
                    // 桌面端：占用视口宽度的40-60%
                    const widthRatio = width <= 1440 ? 0.60 : 0.50;
                    return Math.floor(width * widthRatio);
                }
            })(),
            panelHeight: (() => {
                // Y维度计算：根据视口高度的百分比，不设上限
                if (isRealMobile) {
                    // 移动端：占用视口高度的80-90%
                    const heightRatio = height <= 800 ? 0.90 : 0.85;
                    return Math.floor(height * heightRatio);
                }
                else if (isRealTablet) {
                    // 平板端：占用视口高度的75-85%
                    const heightRatio = height <= 1024 ? 0.85 : 0.80;
                    return Math.floor(height * heightRatio);
                }
                else {
                    // 桌面端：占用视口高度的60-75%
                    const heightRatio = height <= 900 ? 0.75 : 0.70;
                    return Math.floor(height * heightRatio);
                }
            })(),
            // 字体尺寸 - 都基于基础字体按比例缩放
            titleSize: Math.round(baseFontSize * 1.25), // 标题更大
            messageSize: Math.round(baseFontSize * 0.6), // 消息字体更小，适合阅读
            inputSize: Math.round(baseFontSize * 0.65), // 输入框字体
            buttonSize: Math.round(baseFontSize * 0.55), // 按钮字体更小
            // 工具栏尺寸 - 基于面板高度和设备类型动态计算
            toolbarHeight: (() => {
                // 根据设备类型和面板高度计算工具栏高度
                let heightRatio;
                if (isRealMobile) {
                    heightRatio = 0.06; // 移动端：面板高度的6%
                }
                else if (isRealTablet) {
                    heightRatio = 0.05; // 平板端：面板高度的5%
                }
                else {
                    heightRatio = 0.04; // 桌面端：面板高度的4%
                }
                const baseHeight = Math.round(baseFontSize * 3); // 基于字体的基础高度
                const dynamicHeight = Math.round((height * heightRatio)); // 基于视口高度的动态高度
                return Math.max(baseHeight, dynamicHeight);
            })(),
            // 间距系统 - 基于字体大小等比缩放，但要有合理上限
            spacing: {
                xs: Math.max(4, Math.min(8, Math.round(baseFontSize * 0.25))), // 4-8px
                sm: Math.max(8, Math.min(16, Math.round(baseFontSize * 0.5))), // 8-16px
                md: Math.max(12, Math.min(24, Math.round(baseFontSize * 0.75))), // 12-24px
                lg: Math.max(16, Math.min(32, Math.round(baseFontSize * 1))), // 16-32px
                xl: Math.max(24, Math.min(48, Math.round(baseFontSize * 1.5))), // 24-48px
            },
            borderRadius: Math.max(8, Math.min(16, Math.round(baseFontSize * 0.5))), // 8-16px
            zIndex: 999999 // 确保在最上层
        };
        console.log(`📱 响应式样式计算完成:`, {
            viewport: `${width}x${height}`,
            deviceType: isRealMobile ? 'mobile' : isRealTablet ? 'tablet' : 'desktop',
            breakpoint,
            devicePixelRatio,
            panelDimensions: {
                width: `${config.panelWidth}px (${((config.panelWidth / width) * 100).toFixed(1)}% of viewport)`,
                height: `${config.panelHeight}px (${((config.panelHeight / height) * 100).toFixed(1)}% of viewport)`,
                size: `${config.panelWidth}x${config.panelHeight}px`
            },
            toolbarDimensions: {
                height: `${config.toolbarHeight}px (${((config.toolbarHeight / config.panelHeight) * 100).toFixed(1)}% of panel)`,
                buttonSize: `${Math.round(config.toolbarHeight * 0.8)}x${Math.round(config.toolbarHeight * 0.6)}px`,
                iconSize: `${Math.round(config.toolbarHeight * 0.35)}px`
            },
            baseFontSize: `${baseFontSize}px`,
            fabSize: `${config.fabSize}px`,
            spacingXL: `${config.spacing.xl}px`,
            inputArea: {
                buttonSize: `${config.buttonSize}px`,
                inputSize: `${config.inputSize}px`,
                buttonMinWidth: `${Math.max(60, Math.min(120, config.buttonSize * 4))}px`,
                inputMinHeight: `${Math.max(36, config.inputSize * 1.8)}px`,
                areaMinHeight: `${Math.max(60, config.buttonSize * 2.5)}px`
            },
            panelPosition: {
                right: `${config.spacing.xl}px`,
                maxWidth: `calc(100vw - ${config.spacing.xl * 2}px)`,
                wouldExceedLeft: (config.panelWidth + config.spacing.xl) > width
            },
            isMobile
        });
        return config;
    }
    /**
     * 生成隔离的CSS样式
     * 使用高优先级选择器和!important确保不被覆盖
     */
    generateIsolatedCSS(config) {
        const p = this.cssPrefix; // 简化前缀
        return `
/* QuickTalk SDK 样式隔离 - 防止被宿主页面覆盖 */
.${this.namespace} * {
  box-sizing: border-box !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
}

/* FAB按钮 - 客服入口 */
.${this.namespace} .${p}fab {
  position: fixed !important;
  bottom: ${config.spacing.xl}px !important;
  right: ${config.spacing.xl}px !important;
  width: ${config.fabSize}px !important;
  height: ${config.fabSize}px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
  border: none !important;
  cursor: pointer !important;
  z-index: ${config.zIndex} !important;
  box-shadow: 0 8px 32px rgba(7, 193, 96, 0.3) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: ${Math.round(config.fabSize * 0.4)}px !important;
  color: #ffffff !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  transform: scale(1) !important;
  outline: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* FAB按钮中的SVG图标 */
.${this.namespace} .${p}fab svg {
  fill: currentColor !important;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.${this.namespace} .${p}fab:hover {
  transform: scale(1.05) !important;
  box-shadow: 0 12px 40px rgba(7, 193, 96, 0.4) !important;
}

.${this.namespace} .${p}fab:active {
  transform: scale(0.95) !important;
}

/* 聊天面板 */
.${this.namespace} .${p}panel {
  position: fixed !important;
  bottom: ${config.spacing.xl + config.fabSize + config.spacing.md}px !important;
  right: ${config.spacing.xl}px !important;
  width: ${config.panelWidth}px !important;
  height: ${config.panelHeight}px !important;
  background: #ffffff !important;
  border-radius: ${config.borderRadius}px !important;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15) !important;
  z-index: ${config.zIndex - 1} !important;
  display: none !important;
  flex-direction: column !important;
  overflow: hidden !important;
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  /* 确保面板不会超出视口边界 */
  max-width: calc(100vw - ${config.spacing.xl * 2}px) !important;
  min-width: 300px !important;
}

.${this.namespace} .${p}panel.${p}open {
  display: flex !important;
  animation: ${p}slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 面板头部 */
.${this.namespace} .${p}header {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: ${config.spacing.lg}px ${config.spacing.xl}px !important;
  background: linear-gradient(135deg, #07C160 0%, #06A94D 100%) !important;
  color: #ffffff !important;
  font-size: ${config.titleSize}px !important;
  font-weight: 600 !important;
  border-radius: ${config.borderRadius}px ${config.borderRadius}px 0 0 !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  border: none !important;
}

.${this.namespace} .${p}header-title {
  font-size: ${config.titleSize}px !important;
  font-weight: 600 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
}

.${this.namespace} .${p}close-btn {
  background: rgba(255, 255, 255, 0.2) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 50% !important;
  width: ${config.spacing.xl * 1.5}px !important;
  height: ${config.spacing.xl * 1.5}px !important;
  font-size: ${config.buttonSize}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: background 0.2s ease !important;
  margin: 0 !important;
  padding: 0 !important;
  outline: none !important;
}

/* 关闭按钮中的SVG图标 */
.${this.namespace} .${p}close-btn svg {
  fill: currentColor !important;
  transition: transform 0.2s ease !important;
}

.${this.namespace} .${p}close-btn:hover {
  background: rgba(255, 255, 255, 0.3) !important;
}

/* 消息区域 */
.${this.namespace} .${p}messages {
  flex: 1 !important;
  padding: ${config.spacing.lg}px !important;
  overflow-y: auto !important;
  -webkit-overflow-scrolling: touch !important;
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  background: #f8f9fa !important;
  margin: 0 !important;
  border: none !important;
}

/* 消息项 */
.${this.namespace} .${p}message {
  margin-bottom: ${config.spacing.md}px !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  border-radius: ${config.borderRadius}px !important;
  font-size: ${config.messageSize}px !important;
  line-height: ${config.baseLineHeight} !important;
  max-width: 85% !important;
  word-wrap: break-word !important;
  border: none !important;
}

.${this.namespace} .${p}message.${p}customer {
  background: #07C160 !important;
  color: #ffffff !important;
  margin-left: auto !important;
  margin-right: 0 !important;
}

.${this.namespace} .${p}message.${p}staff {
  background: #ffffff !important;
  color: #333333 !important;
  border: 1px solid #e5e5e5 !important;
  margin-left: 0 !important;
  margin-right: auto !important;
}

/* 工具栏区域 */
.${this.namespace} .${p}toolbar {
  display: flex !important;
  gap: ${config.spacing.sm}px !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  background: #f8f9fa !important;
  border-top: 1px solid #e5e5e5 !important;
  border-bottom: 1px solid #e5e5e5 !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  justify-content: flex-start !important;
  align-items: center !important;
  min-height: ${config.toolbarHeight}px !important;
  box-sizing: border-box !important;
}

/* 工具栏按钮 */
.${this.namespace} .${p}btn-toolbar {
  padding: ${config.spacing.sm}px ${config.spacing.md}px !important;
  font-size: ${Math.round(config.toolbarHeight * 0.25)}px !important;
  border: 1px solid #d0d7de !important;
  border-radius: ${config.borderRadius}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: ${Math.round(config.toolbarHeight * 0.8)}px !important;
  min-height: ${Math.round(config.toolbarHeight * 0.6)}px !important;
  transition: all 0.2s ease !important;
  margin: 0 !important;
  outline: none !important;
  font-family: inherit !important;
  background: #ffffff !important;
  color: #656d76 !important;
  min-width: ${Math.max(40, Math.round(config.buttonSize * 2.5))}px !important;
  height: ${Math.max(40, Math.round(config.buttonSize * 2.5))}px !important;
  flex-shrink: 0 !important;
}

.${this.namespace} .${p}btn-toolbar:hover {
  background: #f3f4f6 !important;
  border-color: #b1bac4 !important;
  color: #24292f !important;
}

.${this.namespace} .${p}btn-toolbar:active {
  background: #e9ecef !important;
  transform: scale(0.95) !important;
}

/* 工具栏按钮中的SVG图标样式 */
.${this.namespace} .${p}btn-toolbar svg {
  display: block !important;
  transition: color 0.2s ease !important;
  fill: currentColor !important;
  flex-shrink: 0 !important;
  width: ${Math.round(config.toolbarHeight * 0.35)}px !important;
  height: ${Math.round(config.toolbarHeight * 0.35)}px !important;
}

.${this.namespace} .${p}btn-toolbar:hover svg {
  fill: currentColor !important;
}

/* 输入区域 */
.${this.namespace} .${p}input-area {
  display: flex !important;
  gap: ${config.spacing.sm}px !important;
  padding: ${config.spacing.lg}px !important;
  background: #ffffff !important;
  border-top: 1px solid #e5e5e5 !important;
  border-radius: 0 0 ${config.borderRadius}px ${config.borderRadius}px !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  align-items: center !important;
  min-height: ${Math.max(60, config.buttonSize * 2.5)}px !important;
  box-sizing: border-box !important;
}

.${this.namespace} .${p}input {
  flex: 1 !important;
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  font-size: ${config.inputSize}px !important;
  border: 1px solid #e5e5e5 !important;
  border-radius: ${config.borderRadius}px !important;
  background: #ffffff !important;
  color: #333333 !important;
  outline: none !important;
  margin: 0 !important;
  font-family: inherit !important;
  min-height: ${Math.max(36, config.inputSize * 1.8)}px !important;
  box-sizing: border-box !important;
  max-width: none !important;
}

.${this.namespace} .${p}input:focus {
  border-color: #07C160 !important;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.1) !important;
}

.${this.namespace} .${p}input::placeholder {
  color: #999999 !important;
}

/* 按钮样式 */
.${this.namespace} .${p}btn {
  padding: ${config.spacing.md}px ${config.spacing.lg}px !important;
  font-size: ${config.buttonSize}px !important;
  border: none !important;
  border-radius: ${config.borderRadius}px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s ease !important;
  margin: 0 !important;
  outline: none !important;
  font-family: inherit !important;
  min-width: ${Math.max(60, Math.min(120, config.buttonSize * 4))}px !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

.${this.namespace} .${p}btn-primary {
  background: #07C160 !important;
  color: #ffffff !important;
}

.${this.namespace} .${p}btn-primary:hover {
  background: #06A94D !important;
}

.${this.namespace} .${p}btn-secondary {
  background: #f8f9fa !important;
  color: #666666 !important;
  border: 1px solid #e5e5e5 !important;
}

.${this.namespace} .${p}btn-secondary:hover {
  background: #e9ecef !important;
}

/* 隐藏文件输入 */
.${this.namespace} .${p}file-input {
  display: none !important;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .${this.namespace} .${p}panel {
    left: ${config.spacing.md}px !important;
    right: ${config.spacing.md}px !important;
    bottom: ${config.spacing.md}px !important;
    width: auto !important;
    height: ${Math.min(config.panelHeight, window.innerHeight - config.spacing.md * 2)}px !important;
  }
  
  .${this.namespace} .${p}fab {
    right: ${config.spacing.lg}px !important;
    bottom: ${config.spacing.lg}px !important;
  }
  
  /* 移动端工具栏适配 */
  .${this.namespace} .${p}toolbar {
    padding: ${config.spacing.sm}px ${config.spacing.md}px !important;
    gap: ${config.spacing.xs}px !important;
  }
  
  .${this.namespace} .${p}btn-toolbar {
    min-width: ${config.spacing.lg}px !important;
    height: ${config.spacing.lg}px !important;
    padding: ${config.spacing.xs}px !important;
    font-size: ${Math.max(config.buttonSize - 4, 12)}px !important;
  }
  
  .${this.namespace} .${p}input-area {
    padding: ${config.spacing.md}px !important;
    gap: ${config.spacing.xs}px !important;
  }
}

/* 动画定义 */
@keyframes ${p}slideUp {
  from { 
    transform: translateY(100%) scale(0.9) !important; 
    opacity: 0 !important; 
  }
  to { 
    transform: translateY(0) scale(1) !important; 
    opacity: 1 !important; 
  }
}

@keyframes ${p}fadeIn {
  from { opacity: 0 !important; }
  to { opacity: 1 !important; }
}

/* 滚动条样式 */
.${this.namespace} .${p}messages::-webkit-scrollbar {
  width: 4px !important;
}

.${this.namespace} .${p}messages::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 2px !important;
}

.${this.namespace} .${p}messages::-webkit-scrollbar-track {
  background: transparent !important;
}
`;
    }
    /**
     * 应用样式到页面
     */
    applyStyles(viewport) {
        const config = this.calculateStyleConfig(viewport);
        const css = this.generateIsolatedCSS(config);
        // 移除旧样式
        if (this.styleElement) {
            this.styleElement.remove();
        }
        // 创建新样式元素
        this.styleElement = document.createElement('style');
        this.styleElement.id = `${this.namespace}-styles`;
        this.styleElement.textContent = css;
        // 插入到head标签
        document.head.appendChild(this.styleElement);
        console.log(`✅ 响应式样式已应用 - 基础字体: ${config.baseFontSize}px, FAB: ${config.fabSize}px`);
        return config;
    }
    /**
     * 获取CSS命名空间
     */
    getNamespace() {
        return this.namespace;
    }
    /**
     * 获取CSS类前缀
     */
    getCSSPrefix() {
        return this.cssPrefix;
    }
    /**
     * 清理样式
     */
    cleanup() {
        if (this.styleElement) {
            this.styleElement.remove();
            this.styleElement = null;
        }
    }
}

  
  // ===== 视口管理模块 =====
  /**
 * 视口管理模块
 * 负责检测设备变化、监听窗口大小变化、提供响应式适配
 */
class ViewportManager {
    static getInstance() {
        if (!ViewportManager.instance) {
            ViewportManager.instance = new ViewportManager();
        }
        return ViewportManager.instance;
    }
    constructor() {
        this.listeners = [];
        this.currentViewport = null;
        this.resizeTimer = null;
        this.debounceDelay = 300; // 防抖延迟
        this.init();
    }
    init() {
        // 初始检测
        this.updateViewport();
        // 监听窗口大小变化
        window.addEventListener('resize', this.handleResize.bind(this));
        // 监听屏幕方向变化
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        console.log('📱 视口管理器已初始化');
    }
    /**
     * 检测当前视口信息
     */
    detectViewport() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        // 断点判断
        let breakpoint;
        if (width < 480)
            breakpoint = 'xs';
        else if (width < 768)
            breakpoint = 'sm';
        else if (width < 1024)
            breakpoint = 'md';
        else if (width < 1440)
            breakpoint = 'lg';
        else
            breakpoint = 'xl';
        // 设备类型判断
        const userAgent = navigator.userAgent;
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isMobile = width < 768 || (isMobileUA && width < 1024);
        const isTablet = !isMobile && width >= 768 && width < 1024 && (hasTouch || isMobileUA);
        const isDesktop = !isMobile && !isTablet;
        const orientation = width > height ? 'landscape' : 'portrait';
        return {
            width,
            height,
            breakpoint,
            isMobile,
            isTablet,
            isDesktop,
            devicePixelRatio: dpr,
            orientation
        };
    }
    /**
     * 更新视口信息并通知监听器
     */
    updateViewport() {
        const newViewport = this.detectViewport();
        const hasChanged = this.hasViewportChanged(newViewport);
        if (hasChanged) {
            this.currentViewport = newViewport;
            this.notifyListeners(newViewport);
            console.log(`📱 视口变化:`, {
                size: `${newViewport.width}x${newViewport.height}`,
                breakpoint: newViewport.breakpoint,
                device: newViewport.isMobile ? '移动端' : newViewport.isTablet ? '平板' : '桌面端',
                orientation: newViewport.orientation,
                dpr: newViewport.devicePixelRatio
            });
        }
    }
    /**
     * 检查视口是否发生显著变化
     */
    hasViewportChanged(newViewport) {
        if (!this.currentViewport)
            return true;
        const current = this.currentViewport;
        // 检查关键属性是否变化
        return (current.breakpoint !== newViewport.breakpoint ||
            current.orientation !== newViewport.orientation ||
            Math.abs(current.width - newViewport.width) > 50 ||
            Math.abs(current.height - newViewport.height) > 50);
    }
    /**
     * 通知所有监听器
     */
    notifyListeners(viewport) {
        this.listeners.forEach(callback => {
            try {
                callback(viewport);
            }
            catch (error) {
                console.error('视口变化监听器执行错误:', error);
            }
        });
    }
    /**
     * 处理窗口大小变化（防抖）
     */
    handleResize() {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }
        this.resizeTimer = window.setTimeout(() => {
            this.updateViewport();
            this.resizeTimer = null;
        }, this.debounceDelay);
    }
    /**
     * 处理屏幕方向变化
     */
    handleOrientationChange() {
        // 方向变化后稍微延迟检测，因为某些浏览器需要时间更新尺寸
        setTimeout(() => {
            this.updateViewport();
        }, 500);
    }
    /**
     * 处理页面可见性变化
     */
    handleVisibilityChange() {
        if (!document.hidden) {
            // 页面重新可见时重新检测
            setTimeout(() => {
                this.updateViewport();
            }, 100);
        }
    }
    /**
     * 获取当前视口信息
     */
    getCurrentViewport() {
        if (!this.currentViewport) {
            this.currentViewport = this.detectViewport();
        }
        return this.currentViewport;
    }
    /**
     * 添加视口变化监听器
     */
    onViewportChange(callback) {
        this.listeners.push(callback);
    }
    /**
     * 移除视口变化监听器
     */
    removeViewportListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
    /**
     * 清理所有监听器
     */
    cleanup() {
        this.listeners = [];
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
            this.resizeTimer = null;
        }
    }
    /**
     * 获取设备信息摘要
     */
    getDeviceSummary() {
        const viewport = this.getCurrentViewport();
        const deviceType = viewport.isMobile ? '移动端' : viewport.isTablet ? '平板' : '桌面端';
        return `${deviceType} ${viewport.width}x${viewport.height} (${viewport.breakpoint})`;
    }
    /**
     * 检查是否为移动设备
     */
    isMobile() {
        return this.getCurrentViewport().isMobile;
    }
    /**
     * 检查是否为平板设备
     */
    isTablet() {
        return this.getCurrentViewport().isTablet;
    }
    /**
     * 检查是否为桌面设备
     */
    isDesktop() {
        return this.getCurrentViewport().isDesktop;
    }
    /**
     * 获取当前断点
     */
    getCurrentBreakpoint() {
        return this.getCurrentViewport().breakpoint;
    }
}

  
  // ===== 图片查看器模块 =====
  /**
 * 图片查看器模块
 * 提供图片点击放大、全屏预览、下载等功能
 */
class ImageViewer {
    static getInstance() {
        if (!ImageViewer.instance) {
            ImageViewer.instance = new ImageViewer();
        }
        return ImageViewer.instance;
    }
    constructor() {
        this.overlay = null;
        this.currentImage = null;
        this.cssPrefix = 'qt-sdk-';
        this.namespace = 'quicktalk-embed';
        this.createStyles();
        this.bindGlobalEvents();
    }
    /**
     * 协议适配工具函数 - 只在必要时进行协议适配
     */
    adaptUrlProtocol(url) {
        if (!url || typeof url !== 'string') {
            return url;
        }
        // 如果是相对路径、数据URL或已经是HTTPS，直接返回
        if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('https://')) {
            return url;
        }
        // 判断是否为开发环境：当前页面域名是localhost或127.0.0.1
        const isCurrentHostDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        // 判断目标URL是否为localhost开发服务器
        const isTargetLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
        // 如果当前页面是HTTPS且URL是HTTP，需要转换
        if (window.location.protocol === 'https:' && url.startsWith('http://')) {
            // 对于localhost开发服务器，也需要转换为HTTPS以避免Mixed Content错误
            // 现代浏览器的安全策略会阻止HTTPS页面加载HTTP资源
            if (isTargetLocalhost) {
                const adaptedUrl = url.replace('http://localhost:', 'https://localhost:')
                    .replace('http://127.0.0.1:', 'https://127.0.0.1:');
                console.log('🖼️ ImageViewer适配localhost为HTTPS:', {
                    url,
                    adaptedUrl,
                    currentProtocol: window.location.protocol,
                    currentHost: window.location.hostname,
                    reason: '避免Mixed Content错误，转换localhost为HTTPS'
                });
                return adaptedUrl;
            }
            // 生产环境HTTPS页面访问外部HTTP资源，需要转换
            const adaptedUrl = url.replace('http://', 'https://');
            console.log('🖼️ ImageViewer协议适配:', {
                original: url,
                adapted: adaptedUrl,
                reason: 'HTTPS页面访问外部HTTP图片',
                currentHost: window.location.hostname,
                isCurrentHostDev,
                isTargetLocalhost
            });
            return adaptedUrl;
        }
        // HTTP页面或无需转换
        console.log('🖼️ ImageViewer URL保持原样:', {
            url,
            currentProtocol: window.location.protocol,
            currentHost: window.location.hostname,
            reason: 'HTTP页面或无需转换'
        });
        return url;
    }
    /**
     * 显示图片预览
     */
    show(options) {
        this.createOverlay();
        this.loadImage(options);
    }
    /**
     * 关闭图片预览
     */
    close() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.overlay = null;
                this.currentImage = null;
            }, 300);
        }
    }
    /**
     * 创建覆盖层
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = `${this.namespace} ${this.cssPrefix}image-overlay`;
        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = `${this.cssPrefix}image-close`;
        closeBtn.innerHTML = '✕';
        closeBtn.title = '关闭';
        closeBtn.addEventListener('click', () => this.close());
        // 创建图片容器
        const imageContainer = document.createElement('div');
        imageContainer.className = `${this.cssPrefix}image-container`;
        // 创建加载指示器
        const loading = document.createElement('div');
        loading.className = `${this.cssPrefix}image-loading`;
        loading.innerHTML = '📷 加载中...';
        // 创建下载按钮
        const downloadBtn = document.createElement('button');
        downloadBtn.className = `${this.cssPrefix}image-download`;
        downloadBtn.innerHTML = '⬇️ 下载';
        downloadBtn.title = '下载图片';
        downloadBtn.style.display = 'none';
        this.overlay.appendChild(closeBtn);
        this.overlay.appendChild(imageContainer);
        this.overlay.appendChild(loading);
        this.overlay.appendChild(downloadBtn);
        // 点击覆盖层关闭
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target === imageContainer) {
                this.close();
            }
        });
        document.body.appendChild(this.overlay);
        // 添加进入动画
        setTimeout(() => {
            if (this.overlay) {
                this.overlay.style.opacity = '1';
            }
        }, 10);
    }
    /**
     * 加载图片
     */
    loadImage(options) {
        if (!this.overlay)
            return;
        const imageContainer = this.overlay.querySelector(`.${this.cssPrefix}image-container`);
        const loading = this.overlay.querySelector(`.${this.cssPrefix}image-loading`);
        const downloadBtn = this.overlay.querySelector(`.${this.cssPrefix}image-download`);
        const img = document.createElement('img');
        img.className = `${this.cssPrefix}image-preview`;
        img.alt = options.alt || '图片预览';
        // 协议适配
        const adaptedSrc = this.adaptUrlProtocol(options.src);
        let fallbackAttempted = false;
        // 图片加载成功
        img.onload = () => {
            console.log('🖼️ ImageViewer图片加载成功:', img.src);
            if (loading)
                loading.style.display = 'none';
            if (downloadBtn) {
                downloadBtn.style.display = 'block';
                downloadBtn.onclick = () => this.downloadImage(adaptedSrc, options.title);
            }
            imageContainer.appendChild(img);
            // 添加图片进入动画
            img.style.opacity = '0';
            img.style.transform = 'scale(0.8)';
            setTimeout(() => {
                img.style.transition = 'all 0.3s ease';
                img.style.opacity = '1';
                img.style.transform = 'scale(1)';
            }, 10);
        };
        // 图片加载失败 - 添加智能回退
        img.onerror = () => {
            console.log('🖼️ ImageViewer图片加载失败:', img.src);
            if (!fallbackAttempted) {
                fallbackAttempted = true;
                // 尝试回退策略
                let fallbackUrl = '';
                if (adaptedSrc.startsWith('https://localhost')) {
                    // HTTPS localhost失败，回退到HTTP
                    fallbackUrl = adaptedSrc.replace('https://', 'http://');
                    console.log('🔄 ImageViewer回退到HTTP:', fallbackUrl);
                }
                else if (adaptedSrc.startsWith('http://localhost')) {
                    // HTTP localhost失败，尝试HTTPS
                    fallbackUrl = adaptedSrc.replace('http://', 'https://');
                    console.log('🔄 ImageViewer回退到HTTPS:', fallbackUrl);
                }
                else {
                    // 外部URL失败，尝试原始URL
                    fallbackUrl = options.src;
                    console.log('🔄 ImageViewer回退到原始URL:', fallbackUrl);
                }
                if (fallbackUrl && fallbackUrl !== img.src) {
                    if (loading) {
                        loading.innerHTML = '🔄 正在重试...';
                        loading.style.color = '#ff9800';
                    }
                    img.src = fallbackUrl;
                    return; // 让回退URL尝试加载
                }
            }
            // 所有尝试都失败
            if (loading) {
                loading.innerHTML = '❌ 图片加载失败<br><small>请检查网络连接或图片URL</small>';
                loading.style.color = '#ff6b6b';
                loading.style.fontSize = '14px';
                loading.style.lineHeight = '1.4';
            }
            console.error('🖼️ ImageViewer所有加载尝试都失败了');
        };
        console.log('🖼️ ImageViewer开始加载图片:', adaptedSrc);
        img.src = adaptedSrc; // 使用协议适配后的URL
        this.currentImage = img;
    }
    /**
     * 下载图片
     */
    downloadImage(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || 'image.jpg';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    /**
     * 绑定全局事件
     */
    bindGlobalEvents() {
        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay) {
                this.close();
            }
        });
    }
    /**
     * 创建样式
     */
    createStyles() {
        const styleId = `${this.cssPrefix}image-viewer-styles`;
        if (document.getElementById(styleId))
            return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
/* 图片查看器样式 */
.${this.namespace} .${this.cssPrefix}image-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  background: rgba(0, 0, 0, 0.9) !important;
  z-index: 999999 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  opacity: 0 !important;
  transition: opacity 0.3s ease !important;
  padding: 20px !important;
  box-sizing: border-box !important;
}

.${this.namespace} .${this.cssPrefix}image-container {
  position: relative !important;
  max-width: 90vw !important;
  max-height: 90vh !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.${this.namespace} .${this.cssPrefix}image-preview {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border-radius: 8px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  cursor: pointer !important;
}

.${this.namespace} .${this.cssPrefix}image-close {
  position: absolute !important;
  top: 20px !important;
  right: 20px !important;
  width: 40px !important;
  height: 40px !important;
  border: none !important;
  border-radius: 50% !important;
  background: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  font-size: 18px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.3s ease !important;
  backdrop-filter: blur(10px) !important;
  z-index: 1000000 !important;
}

.${this.namespace} .${this.cssPrefix}image-close:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(1.1) !important;
}

.${this.namespace} .${this.cssPrefix}image-download {
  position: absolute !important;
  bottom: 20px !important;
  right: 20px !important;
  padding: 12px 20px !important;
  border: none !important;
  border-radius: 25px !important;
  background: rgba(255, 255, 255, 0.2) !important;
  color: white !important;
  font-size: 14px !important;
  cursor: pointer !important;
  transition: all 0.3s ease !important;
  backdrop-filter: blur(10px) !important;
  z-index: 1000000 !important;
}

.${this.namespace} .${this.cssPrefix}image-download:hover {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: translateY(-2px) !important;
}

.${this.namespace} .${this.cssPrefix}image-loading {
  color: white !important;
  font-size: 18px !important;
  text-align: center !important;
  padding: 20px !important;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .${this.namespace} .${this.cssPrefix}image-overlay {
    padding: 10px !important;
  }
  
  .${this.namespace} .${this.cssPrefix}image-close {
    width: 35px !important;
    height: 35px !important;
    font-size: 16px !important;
    top: 15px !important;
    right: 15px !important;
  }
  
  .${this.namespace} .${this.cssPrefix}image-download {
    bottom: 15px !important;
    right: 15px !important;
    padding: 10px 16px !important;
    font-size: 13px !important;
  }
}
    `;
        document.head.appendChild(style);
    }
}

  
  // ===== 图片消息组件模块 =====
  /**
 * 图片消息组件模块
 * 处理图片消息的显示、下载和预览功能
 */
class ImageMessageComponent {
    constructor(config, cssPrefix = 'qt-') {
        this.config = config;
        this.prefix = cssPrefix;
        this.element = this.createElement();
    }
    createElement() {
        const container = document.createElement('div');
        container.className = `${this.prefix}image-message-container`;
        // 设置容器样式
        container.style.cssText = `
      position: relative;
      display: inline-block;
      max-width: 250px;
      border-radius: 12px;
      overflow: hidden;
      background: #f5f5f5;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
        // 创建图片元素
        const imageWrapper = this.createImageWrapper();
        container.appendChild(imageWrapper);
        // 创建操作栏
        if (this.config.showDownloadButton || this.config.content) {
            const actionBar = this.createActionBar();
            container.appendChild(actionBar);
        }
        return container;
    }
    createImageWrapper() {
        const wrapper = document.createElement('div');
        wrapper.className = `${this.prefix}image-wrapper`;
        wrapper.style.cssText = `
      position: relative;
      background: #f0f0f0;
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
        const img = document.createElement('img');
        img.src = this.config.fileUrl;
        img.alt = this.config.fileName || '图片';
        img.style.cssText = `
      max-width: 100%;
      height: auto;
      display: block;
      cursor: ${this.config.enablePreview ? 'pointer' : 'default'};
    `;
        // 添加加载状态
        const loadingElement = this.createLoadingElement();
        wrapper.appendChild(loadingElement);
        // 图片加载完成后隐藏加载状态
        img.onload = () => {
            loadingElement.style.display = 'none';
        };
        // 图片加载失败处理
        img.onerror = () => {
            this.showError(wrapper, '图片加载失败');
        };
        // 添加预览功能
        if (this.config.enablePreview) {
            img.addEventListener('click', () => {
                this.showImagePreview();
            });
            // 添加预览提示
            const previewHint = this.createPreviewHint();
            wrapper.appendChild(previewHint);
            // 悬停效果
            wrapper.addEventListener('mouseenter', () => {
                previewHint.style.opacity = '1';
                img.style.transform = 'scale(1.02)';
                img.style.transition = 'transform 0.2s ease';
            });
            wrapper.addEventListener('mouseleave', () => {
                previewHint.style.opacity = '0';
                img.style.transform = 'scale(1)';
            });
        }
        wrapper.appendChild(img);
        return wrapper;
    }
    createLoadingElement() {
        const loading = document.createElement('div');
        loading.className = `${this.prefix}image-loading`;
        loading.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #666;
    `;
        loading.textContent = '📷 加载中...';
        return loading;
    }
    createPreviewHint() {
        const hint = document.createElement('div');
        hint.className = `${this.prefix}image-preview-hint`;
        hint.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    `;
        hint.textContent = '点击查看';
        return hint;
    }
    createActionBar() {
        const actionBar = document.createElement('div');
        actionBar.className = `${this.prefix}image-action-bar`;
        actionBar.style.cssText = `
      padding: 8px 12px;
      background: rgba(255,255,255,0.95);
      border-top: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;
        // 文件名或描述
        if (this.config.content || this.config.fileName) {
            const textElement = document.createElement('div');
            textElement.className = `${this.prefix}image-text`;
            textElement.style.cssText = `
        flex: 1;
        font-size: 12px;
        color: #666;
        word-break: break-all;
        line-height: 1.3;
      `;
            textElement.textContent = this.config.content || this.config.fileName || '';
            actionBar.appendChild(textElement);
        }
        // 下载按钮
        if (this.config.showDownloadButton) {
            const downloadButton = this.createDownloadButton();
            actionBar.appendChild(downloadButton);
        }
        return actionBar;
    }
    createDownloadButton() {
        const button = document.createElement('button');
        button.className = `${this.prefix}image-download-btn`;
        button.style.cssText = `
      background: #007bff;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s ease;
      flex-shrink: 0;
    `;
        button.innerHTML = '📥 下载';
        button.addEventListener('mouseenter', () => {
            button.style.background = '#0056b3';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = '#007bff';
        });
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.downloadImage();
        });
        return button;
    }
    showError(container, message) {
        container.innerHTML = `
      <div style="
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 12px;
      ">
        ❌ ${message}
      </div>
    `;
    }
    showImagePreview() {
        // 触发预览事件，由外部处理（如使用ImageViewer）
        const event = new CustomEvent('image-preview', {
            detail: {
                src: this.config.fileUrl,
                alt: this.config.fileName || '图片',
                title: this.config.fileName || 'image'
            }
        });
        this.element.dispatchEvent(event);
    }
    downloadImage() {
        try {
            const link = document.createElement('a');
            link.href = this.config.fileUrl;
            link.download = this.config.fileName || 'image';
            link.target = '_blank';
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // 触发下载事件
            const event = new CustomEvent('image-download', {
                detail: {
                    fileUrl: this.config.fileUrl,
                    fileName: this.config.fileName
                }
            });
            this.element.dispatchEvent(event);
        }
        catch (error) {
            console.error('图片下载失败:', error);
        }
    }
    // 公共方法
    getElement() {
        return this.element;
    }
    updateConfig(newConfig) {
        var _a;
        this.config = { ...this.config, ...newConfig };
        // 重新创建元素
        const newElement = this.createElement();
        (_a = this.element.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(newElement, this.element);
        this.element = newElement;
    }
    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
/**
 * 创建图片消息的便捷函数
 */
function createImageMessage(config, cssPrefix = 'qt-') {
    const component = new ImageMessageComponent(config, cssPrefix);
    return component.getElement();
}

  
  // ===== UI管理模块 =====
  /**
 * UI组件管理器
 * 负责创建和管理聊天界面组件
 */
class UIManager {
    static getInstance() {
        if (!UIManager.instance) {
            UIManager.instance = new UIManager();
        }
        return UIManager.instance;
    }
    constructor() {
        this.components = null;
        this.isOpen = false;
        this.currentConfig = null;
        this.statusMessageElement = null; // 用于跟踪状态消息
        this.styleSystem = StyleSystem.getInstance();
        this.viewportManager = ViewportManager.getInstance();
        // 直接初始化ImageViewer，确保它在构造时就可用
        this.imageViewer = ImageViewer.getInstance();
        // 监听视口变化，动态调整UI
        this.viewportManager.onViewportChange(this.handleViewportChange.bind(this));
    }
    /**
     * 协议适配工具函数 - 与WebSocketClient保持一致的策略
     */
    adaptUrlProtocol(url) {
        var _a;
        if (!url || typeof url !== 'string') {
            return url;
        }
        // 如果是相对路径、数据URL或已经是HTTPS，直接返回
        if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('https://')) {
            return url;
        }
        // 判断是否为开发环境：当前页面域名是localhost或127.0.0.1
        const isCurrentHostDev = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        // 判断目标URL是否为localhost开发服务器
        const isTargetLocalhost = url.includes('localhost:') || url.includes('127.0.0.1:');
        // 若目标是 localhost/127.0.0.1 且已探测到服务器对外地址，则改写为服务器主机与协议
        try {
            const parsed = new URL(url);
            const isLocalHostName = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
            // 尝试从全局暴露的配置管理器获取 serverUrl（通过 window.QuickTalkConfig 或 data-attr）
            const anyWin = window;
            const serverUrl = anyWin.__QUICKTALK_SERVER_URL__ || ((_a = anyWin === null || anyWin === void 0 ? void 0 : anyWin.QuickTalkCustomerService) === null || _a === void 0 ? void 0 : _a.serverUrl) || (anyWin === null || anyWin === void 0 ? void 0 : anyWin.QuickTalkSDKServerUrl);
            if (isLocalHostName && serverUrl) {
                const server = new URL(serverUrl);
                const rewritten = `${server.protocol}//${server.host}${parsed.pathname}${parsed.search}`;
                console.log('🔧 UIManager 改写本地地址为服务器地址:', {
                    original: url,
                    rewritten,
                    serverUrl,
                    reason: '避免第三方站点访问 localhost 导致图片加载失败/证书错误'
                });
                return rewritten;
            }
        }
        catch (_b) { }
        // 如果当前页面是HTTPS且URL是HTTP，需要转换
        if (window.location.protocol === 'https:' && url.startsWith('http://')) {
            // 对于 localhost/127.0.0.1 场景，不强制转换为 HTTPS，以避免目标端口未启用 TLS 导致的协议错误
            if (isTargetLocalhost) {
                console.log('🔧 UIManager 保持本地开发URL协议（避免 ERR_SSL_PROTOCOL_ERROR）:', { url });
                return url;
            }
            // 生产环境HTTPS页面访问外部HTTP资源，需要转换
            const adaptedUrl = url.replace('http://', 'https://');
            console.log('🔧 UIManager协议适配:', {
                original: url,
                adapted: adaptedUrl,
                reason: 'HTTPS页面访问外部HTTP资源',
                currentHost: window.location.hostname,
                isCurrentHostDev,
                isTargetLocalhost
            });
            return adaptedUrl;
        }
        // HTTP页面或无需转换
        console.log('🔧 UIManager URL保持原样:', {
            url,
            currentProtocol: window.location.protocol,
            currentHost: window.location.hostname,
            reason: 'HTTP页面或无需转换'
        });
        return url;
    }
    /**
     * 获取ImageViewer实例
     */
    getImageViewer() {
        return this.imageViewer;
    }
    /**
     * 初始化UI组件
     */
    createUI() {
        // 如果已存在，直接返回
        if (this.components) {
            return this.components;
        }
        // 应用样式系统
        const viewport = this.viewportManager.getCurrentViewport();
        this.currentConfig = this.styleSystem.applyStyles(viewport);
        // 创建组件
        this.components = this.buildUIComponents();
        // 绑定事件
        this.bindEvents();
        console.log('🎨 UI组件已创建');
        return this.components;
    }
    /**
     * 构建UI组件结构
     */
    buildUIComponents() {
        const namespace = this.styleSystem.getNamespace();
        const prefix = this.styleSystem.getCSSPrefix();
        // 获取响应式配置用于图标尺寸计算
        const viewport = this.styleSystem.detectViewport();
        const styleConfig = this.styleSystem.calculateStyleConfig(viewport);
        // 基于响应式配置计算各种图标尺寸
        const toolbarIconSize = Math.round(styleConfig.buttonSize * 1.2); // 工具栏图标大小
        const fabIconSize = Math.round(styleConfig.fabSize * 0.45); // FAB图标大小  
        const closeIconSize = Math.round(styleConfig.buttonSize * 0.9); // 关闭按钮图标大小
        console.log('🎨 响应式图标尺寸计算:', {
            viewport: `${viewport.width}x${viewport.height}`,
            baseFontSize: `${styleConfig.baseFontSize}px`,
            buttonSize: `${styleConfig.buttonSize}px`,
            fabSize: `${styleConfig.fabSize}px`,
            iconSizes: {
                toolbar: `${toolbarIconSize}px`,
                fab: `${fabIconSize}px`,
                close: `${closeIconSize}px`
            }
        });
        // 创建根容器
        const container = document.createElement('div');
        container.className = namespace;
        container.style.cssText = 'position: fixed; top: 0; left: 0; pointer-events: none; z-index: 999999;';
        // 创建FAB按钮
        const fab = document.createElement('button');
        fab.className = `${prefix}fab`;
        // 使用更好看的emoji图标
        fab.innerHTML = '💬';
        fab.title = '打开客服';
        fab.style.pointerEvents = 'auto';
        // 创建聊天面板
        const panel = document.createElement('div');
        panel.className = `${prefix}panel`;
        panel.style.pointerEvents = 'auto';
        // 创建面板头部
        const header = document.createElement('div');
        header.className = `${prefix}header`;
        const headerTitle = document.createElement('div');
        headerTitle.className = `${prefix}header-title`;
        headerTitle.textContent = '在线客服';
        const closeBtn = document.createElement('button');
        closeBtn.className = `${prefix}close-btn`;
        // 使用清晰的关闭符号
        closeBtn.innerHTML = '✖️';
        closeBtn.title = '关闭';
        header.appendChild(headerTitle);
        header.appendChild(closeBtn);
        // 创建消息区域
        const messagesContainer = document.createElement('div');
        messagesContainer.className = `${prefix}messages`;
        // 创建工具栏区域（图片、文件、语音、表情按钮）
        const toolbarArea = document.createElement('div');
        toolbarArea.className = `${prefix}toolbar`;
        // 创建图片按钮
        const imageBtn = document.createElement('button');
        imageBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
        // 使用更好看的图片emoji
        imageBtn.innerHTML = '🖼️';
        imageBtn.title = '发送图片';
        const fileBtn = document.createElement('button');
        fileBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
        // 使用更好看的文件emoji
        fileBtn.innerHTML = '📎';
        fileBtn.title = '发送文件';
        const voiceBtn = document.createElement('button');
        voiceBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
        // 使用更好看的语音emoji
        voiceBtn.innerHTML = '🎙️';
        voiceBtn.title = '发送语音';
        const emojiBtn = document.createElement('button');
        emojiBtn.className = `${prefix}btn ${prefix}btn-toolbar`;
        // 使用更好看的表情emoji
        emojiBtn.innerHTML = '😄';
        emojiBtn.title = '发送表情';
        // 组装工具栏
        toolbarArea.appendChild(imageBtn);
        toolbarArea.appendChild(fileBtn);
        toolbarArea.appendChild(voiceBtn);
        toolbarArea.appendChild(emojiBtn);
        // 创建输入区域
        const inputArea = document.createElement('div');
        inputArea.className = `${prefix}input-area`;
        // 创建消息输入框
        const messageInput = document.createElement('input');
        messageInput.type = 'text';
        messageInput.className = `${prefix}input`;
        messageInput.placeholder = '输入消息...';
        // 创建发送按钮
        const sendBtn = document.createElement('button');
        sendBtn.className = `${prefix}btn ${prefix}btn-primary`;
        sendBtn.textContent = '发送';
        // 创建隐藏的文件输入
        const imageInput = document.createElement('input');
        imageInput.type = 'file';
        imageInput.accept = 'image/*';
        imageInput.className = `${prefix}file-input`;
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = `${prefix}file-input`;
        // 组装输入区域
        inputArea.appendChild(messageInput);
        inputArea.appendChild(sendBtn);
        inputArea.appendChild(imageInput);
        inputArea.appendChild(fileInput);
        // 组装面板
        panel.appendChild(header);
        panel.appendChild(messagesContainer);
        panel.appendChild(toolbarArea);
        panel.appendChild(inputArea);
        // 组装根容器
        container.appendChild(fab);
        container.appendChild(panel);
        // 添加到页面
        document.body.appendChild(container);
        // 添加欢迎消息
        this.addWelcomeMessage(messagesContainer);
        return {
            container,
            fab,
            panel,
            header,
            closeBtn,
            messagesContainer,
            toolbarArea,
            inputArea,
            messageInput,
            sendBtn,
            imageBtn,
            fileBtn,
            voiceBtn,
            emojiBtn,
            imageInput,
            fileInput
        };
    }
    /**
     * 添加欢迎消息
     */
    addWelcomeMessage(messagesContainer) {
        const welcomeMessage = {
            content: '您好！欢迎使用在线客服，有什么可以帮助您的吗？',
            messageType: 'text',
            senderType: 'staff',
            timestamp: new Date()
        };
        this.addMessage(welcomeMessage);
    }
    /**
     * 绑定事件
     */
    bindEvents() {
        if (!this.components)
            return;
        const { fab, closeBtn, messageInput, sendBtn, imageBtn, fileBtn, voiceBtn, emojiBtn, imageInput, fileInput } = this.components;
        // FAB按钮点击
        fab.addEventListener('click', () => this.toggle());
        // 关闭按钮点击
        closeBtn.addEventListener('click', () => this.close());
        // 发送按钮点击
        sendBtn.addEventListener('click', () => this.handleSendMessage());
        // 回车发送
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        // 工具栏按钮点击
        imageBtn.addEventListener('click', () => imageInput.click());
        fileBtn.addEventListener('click', () => fileInput.click());
        // 语音按钮（暂时禁用）
        voiceBtn.addEventListener('click', () => {
            console.log('语音功能暂未实现');
        });
        // 表情按钮点击
        emojiBtn.addEventListener('click', () => this.handleEmojiClick());
        // 文件选择
        imageInput.addEventListener('change', (e) => this.handleFileSelect(e, 'image'));
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e, 'file'));
        // 添加触摸反馈
        this.addTouchFeedback(fab);
        this.addTouchFeedback(closeBtn);
        this.addTouchFeedback(sendBtn);
        this.addTouchFeedback(imageBtn);
        this.addTouchFeedback(fileBtn);
        this.addTouchFeedback(voiceBtn);
        this.addTouchFeedback(emojiBtn);
    }
    /**
     * 添加触摸反馈效果
     */
    addTouchFeedback(element) {
        if (!('ontouchstart' in window))
            return;
        element.addEventListener('touchstart', () => {
            element.style.transform = 'scale(0.95)';
            element.style.transition = 'transform 0.1s ease';
        });
        element.addEventListener('touchend', () => {
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 100);
        });
        element.addEventListener('touchcancel', () => {
            element.style.transform = 'scale(1)';
        });
    }
    /**
     * 处理视口变化
     */
    handleViewportChange(viewport) {
        if (!this.components)
            return;
        // 重新应用样式
        this.currentConfig = this.styleSystem.applyStyles(viewport);
        console.log(`🔄 UI已适配新视口: ${viewport.width}x${viewport.height} (${viewport.breakpoint})`);
    }
    /**
     * 切换面板显示状态
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        }
        else {
            this.open();
        }
    }
    /**
     * 打开面板
     */
    open() {
        if (!this.components || this.isOpen)
            return;
        const { panel, messageInput } = this.components;
        const prefix = this.styleSystem.getCSSPrefix();
        panel.classList.add(`${prefix}open`);
        this.isOpen = true;
        // 聚焦输入框
        setTimeout(() => {
            messageInput.focus();
        }, 300);
        console.log('📱 客服面板已打开');
    }
    /**
     * 关闭面板
     */
    close() {
        if (!this.components || !this.isOpen)
            return;
        const { panel } = this.components;
        const prefix = this.styleSystem.getCSSPrefix();
        panel.classList.remove(`${prefix}open`);
        this.isOpen = false;
        console.log('📱 客服面板已关闭');
    }
    /**
     * 添加消息到界面
     */
    addMessage(message) {
        if (!this.components)
            return;
        const { messagesContainer } = this.components;
        const prefix = this.styleSystem.getCSSPrefix();
        const messageElement = document.createElement('div');
        messageElement.className = `${prefix}message ${prefix}${message.senderType}`;
        if (message.messageType === 'image' && message.fileUrl) {
            // 协议适配
            const adaptedFileUrl = this.adaptUrlProtocol(message.fileUrl);
            // 创建图片消息组件
            const imageConfig = {
                fileUrl: adaptedFileUrl,
                fileName: message.fileName || message.content,
                content: message.content !== message.fileName ? message.content : undefined,
                showDownloadButton: true,
                enablePreview: true
            };
            const imageElement = createImageMessage(imageConfig, this.styleSystem.getCSSPrefix());
            // 监听预览事件
            imageElement.addEventListener('image-preview', (e) => {
                this.getImageViewer().show(e.detail);
            });
            // 监听下载事件
            imageElement.addEventListener('image-download', (e) => {
                console.log('📥 图片下载:', e.detail);
            });
            messageElement.appendChild(imageElement);
        }
        else if (message.messageType === 'file' && message.fileUrl) {
            const link = document.createElement('a');
            link.href = message.fileUrl;
            // 构建显示文本：图标 + 下载文件 + 文件名
            const fileName = message.fileName || message.content || '未知文件';
            link.innerHTML = `📎 下载文件：${fileName}`;
            link.target = '_blank';
            link.style.cssText = 'color: inherit; text-decoration: underline; display: inline-block; word-break: break-all;';
            messageElement.appendChild(link);
        }
        else {
            // 使用文本格式化工具设置内容，支持换行和表情优化显示
            setFormattedTextContent(messageElement, message.content);
        }
        messagesContainer.appendChild(messageElement);
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        // 添加进入动画
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(10px)';
        setTimeout(() => {
            messageElement.style.transition = 'all 0.3s ease';
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        }, 10);
    }
    /**
     * 处理发送消息
     */
    handleSendMessage() {
        if (!this.components)
            return;
        const { messageInput } = this.components;
        const content = messageInput.value.trim();
        if (!content)
            return;
        // 触发自定义事件
        const event = new CustomEvent('qt-send-message', {
            detail: { content, messageType: 'text' }
        });
        document.dispatchEvent(event);
        // 清空输入框
        messageInput.value = '';
        // 移动端发送后失焦，避免键盘遮挡
        if (this.viewportManager.isMobile()) {
            messageInput.blur();
        }
    }
    /**
     * 处理文件选择
     */
    handleFileSelect(event, type) {
        var _a;
        const input = event.target;
        const file = (_a = input.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        // 触发自定义事件
        const customEvent = new CustomEvent('qt-upload-file', {
            detail: { file, messageType: type }
        });
        document.dispatchEvent(customEvent);
        // 清空输入
        input.value = '';
    }
    /**
     * 处理表情按钮点击
     */
    handleEmojiClick() {
        // 创建表情选择器
        this.showEmojiPicker();
    }
    /**
     * 显示表情选择器
     */
    showEmojiPicker() {
        if (!this.components)
            return;
        const { panel } = this.components;
        const prefix = this.styleSystem.getCSSPrefix();
        // 检查是否已存在表情选择器
        const existingPicker = document.querySelector(`.${prefix}emoji-picker`);
        if (existingPicker) {
            existingPicker.remove();
            return;
        }
        // 常用表情分类
        const emojiCategories = {
            '😊': ['😊', '😂', '😁', '😍', '🤔', '😎', '😢', '😮', '😴', '😵'],
            '👋': ['�', '👍', '👎', '👌', '✌️', '🤝', '👏', '🙏', '💪', '🤞'],
            '❤️': ['❤️', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍', '🤎', '💖'],
            '🎉': ['🎉', '🎊', '🎈', '🎁', '🎂', '⭐', '✨', '�', '💫', '🌟']
        };
        // 创建表情选择器容器
        const emojiPicker = document.createElement('div');
        emojiPicker.className = `${prefix}emoji-picker`;
        // 计算面板位置，确保表情选择器完全在视口内
        const panelRect = panel.getBoundingClientRect();
        // 获取当前响应式样式配置
        const viewport = this.styleSystem.detectViewport();
        const styleConfig = this.styleSystem.calculateStyleConfig(viewport);
        // 基于响应式配置计算表情选择器尺寸
        const emojiSize = Math.round(styleConfig.baseFontSize * 1.5); // 调整表情大小比例
        const buttonSize = Math.round(emojiSize * 1.3); // 按钮大小基于表情大小
        const categoryFontSize = Math.round(styleConfig.baseFontSize * 0.9); // 分类标题字体
        const margin = styleConfig.spacing.md; // 使用响应式边距
        // 动态计算网格列数，确保能显示完整的表情
        let gridColumns;
        if (viewport.isMobile) {
            // 移动端：基于按钮大小计算能放几列
            const availableWidth = Math.min(viewport.width * 0.9, 400); // 最大可用宽度
            const spacingBetween = styleConfig.spacing.sm; // 间距
            const totalPadding = styleConfig.spacing.md * 2; // 左右内边距
            const maxButtonsPerRow = Math.floor((availableWidth - totalPadding + spacingBetween) / (buttonSize + spacingBetween));
            gridColumns = Math.max(3, Math.min(5, maxButtonsPerRow)); // 3-5列之间
        }
        else {
            gridColumns = 5; // 桌面端固定5列
        }
        // 重新计算容器尺寸，基于网格布局
        const contentWidth = gridColumns * buttonSize + (gridColumns - 1) * styleConfig.spacing.sm + styleConfig.spacing.md * 2;
        const pickerWidth = Math.max(contentWidth, 250); // 确保最小宽度
        // 计算需要的高度：4个分类 × (标题 + 2行表情 + 间距)
        const rowsPerCategory = Math.ceil(10 / gridColumns); // 每个分类的行数
        const categoryTitleHeight = categoryFontSize + styleConfig.spacing.sm + styleConfig.spacing.xs;
        const categoryContentHeight = rowsPerCategory * buttonSize + (rowsPerCategory - 1) * styleConfig.spacing.sm + styleConfig.spacing.md;
        const totalContentHeight = 4 * (categoryTitleHeight + categoryContentHeight) + styleConfig.spacing.md * 2;
        const pickerHeight = Math.min(totalContentHeight, viewport.height * 0.7); // 限制最大高度
        // 可用视口区域
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let pickerTop;
        let pickerLeft;
        // 水平位置计算 - 确保完全在视口内
        pickerLeft = panelRect.left;
        if (pickerLeft + pickerWidth + margin > viewportWidth) {
            // 右边超出，从右边对齐
            pickerLeft = viewportWidth - pickerWidth - margin;
        }
        if (pickerLeft < margin) {
            // 左边超出，从左边对齐
            pickerLeft = margin;
        }
        // 垂直位置计算 - 优先显示在面板上方
        pickerTop = panelRect.top - pickerHeight - margin;
        if (pickerTop < margin) {
            // 上方空间不够，尝试下方
            pickerTop = panelRect.bottom + margin;
            if (pickerTop + pickerHeight + margin > viewportHeight) {
                // 下方也不够，强制在视口内最佳位置
                pickerTop = Math.max(margin, viewportHeight - pickerHeight - margin);
            }
        }
        console.log('🎭 表情选择器响应式计算:', {
            viewport: { width: viewport.width, height: viewport.height, isMobile: viewport.isMobile },
            styleConfig: {
                baseFontSize: styleConfig.baseFontSize,
                spacing: styleConfig.spacing.md
            },
            picker: {
                width: pickerWidth,
                height: pickerHeight,
                emojiSize,
                buttonSize,
                gridColumns,
                categoryFontSize
            },
            position: { top: pickerTop, left: pickerLeft },
            bounds: {
                wouldExceedRight: (pickerLeft + pickerWidth) > viewportWidth,
                wouldExceedBottom: (pickerTop + pickerHeight) > viewportHeight,
                wouldExceedLeft: pickerLeft < 0,
                wouldExceedTop: pickerTop < 0
            }
        });
        emojiPicker.style.cssText = `
      position: fixed !important;
      top: ${pickerTop}px !important;
      left: ${pickerLeft}px !important;
      width: ${pickerWidth}px !important;
      height: ${pickerHeight}px !important;
      background: white !important;
      border: 1px solid #e5e5e5 !important;
      border-radius: ${styleConfig.borderRadius}px !important;
      padding: ${styleConfig.spacing.md}px !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
      z-index: ${styleConfig.zIndex} !important;
      overflow-y: auto !important;
      font-size: ${emojiSize}px !important;
      pointer-events: auto !important;
      transform: translateZ(0) !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
    `;
        // 创建表情网格
        Object.entries(emojiCategories).forEach(([categoryIcon, emojis]) => {
            // 分类标题
            const categoryTitle = document.createElement('div');
            categoryTitle.textContent = categoryIcon;
            categoryTitle.style.cssText = `
        font-size: ${categoryFontSize}px !important;
        margin: ${styleConfig.spacing.sm}px 0 ${styleConfig.spacing.xs}px 0 !important;
        color: #666 !important;
        border-bottom: 1px solid #f0f0f0 !important;
        padding-bottom: ${styleConfig.spacing.xs}px !important;
        font-family: inherit !important;
      `;
            emojiPicker.appendChild(categoryTitle);
            // 表情网格
            const emojiGrid = document.createElement('div');
            emojiGrid.style.cssText = `
        display: grid !important;
        grid-template-columns: repeat(${gridColumns}, 1fr) !important;
        gap: ${styleConfig.spacing.sm}px !important;
        margin-bottom: ${styleConfig.spacing.md}px !important;
        justify-items: center !important;
      `;
            emojis.forEach(emoji => {
                const emojiBtn = document.createElement('button');
                emojiBtn.textContent = emoji;
                emojiBtn.className = `${prefix}emoji-btn`;
                emojiBtn.style.cssText = `
          border: none !important;
          background: transparent !important;
          font-size: ${emojiSize}px !important;
          cursor: pointer !important;
          padding: ${Math.round(styleConfig.spacing.xs / 2)}px !important;
          border-radius: ${Math.round(styleConfig.borderRadius * 0.5)}px !important;
          transition: background 0.2s ease !important;
          width: ${buttonSize}px !important;
          height: ${buttonSize}px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-family: inherit !important;
          flex-shrink: 0 !important;
        `;
                emojiBtn.addEventListener('mouseenter', () => {
                    emojiBtn.style.background = '#f0f0f0';
                });
                emojiBtn.addEventListener('mouseleave', () => {
                    emojiBtn.style.background = 'transparent';
                });
                emojiBtn.addEventListener('click', () => {
                    // 发送表情消息
                    const event = new CustomEvent('qt-send-message', {
                        detail: { content: emoji, messageType: 'text' }
                    });
                    document.dispatchEvent(event);
                    console.log(`📱 发送表情: ${emoji}`);
                    // 关闭表情选择器
                    emojiPicker.remove();
                });
                emojiGrid.appendChild(emojiBtn);
            });
            emojiPicker.appendChild(emojiGrid);
        });
        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        const closeBtnSize = Math.round(styleConfig.baseFontSize * 1.5);
        closeBtn.style.cssText = `
      position: absolute !important;
      top: ${styleConfig.spacing.sm}px !important;
      right: ${styleConfig.spacing.sm}px !important;
      border: none !important;
      background: transparent !important;
      font-size: ${Math.round(styleConfig.baseFontSize * 1.1)}px !important;
      cursor: pointer !important;
      color: #999 !important;
      width: ${closeBtnSize}px !important;
      height: ${closeBtnSize}px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: inherit !important;
    `;
        closeBtn.addEventListener('click', () => {
            emojiPicker.remove();
        });
        emojiPicker.appendChild(closeBtn);
        // 阻止滚动事件冒泡，防止宿主页面滚动干扰
        emojiPicker.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
        emojiPicker.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        });
        // 添加到body（确保正确显示）
        document.body.appendChild(emojiPicker);
        // 点击外部关闭
        const handleOutsideClick = (event) => {
            if (!emojiPicker.contains(event.target)) {
                emojiPicker.remove();
                document.removeEventListener('click', handleOutsideClick);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 100);
    }
    /**
     * 显示上传状态
     */
    showUploadStatus(message) {
        if (!this.components)
            return;
        const { messagesContainer } = this.components;
        const prefix = this.styleSystem.getCSSPrefix();
        // 如果有之前的状态消息，先移除
        if (this.statusMessageElement) {
            this.statusMessageElement.remove();
            this.statusMessageElement = null;
        }
        // 创建新的状态消息
        this.statusMessageElement = document.createElement('div');
        this.statusMessageElement.className = `${prefix}message ${prefix}customer ${prefix}status`;
        this.statusMessageElement.textContent = message;
        this.statusMessageElement.style.opacity = '0.7';
        this.statusMessageElement.style.fontStyle = 'italic';
        messagesContainer.appendChild(this.statusMessageElement);
        // 滚动到底部
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    /**
     * 清除上传状态
     */
    clearUploadStatus() {
        if (this.statusMessageElement) {
            this.statusMessageElement.remove();
            this.statusMessageElement = null;
        }
    }
    /**
     * 获取面板打开状态
     */
    isOpened() {
        return this.isOpen;
    }
    /**
     * 清理UI组件
     */
    cleanup() {
        if (this.components) {
            this.components.container.remove();
            this.components = null;
        }
        this.styleSystem.cleanup();
        this.isOpen = false;
    }
    /**
     * 获取当前UI组件
     */
    getComponents() {
        return this.components;
    }
}

  
  // ===== 媒体处理模块 =====
  /**
 * 媒体处理模块
 * 负责文件上传、图片处理、语音录制等功能
 */
class MediaHandler {
    static getInstance() {
        if (!MediaHandler.instance) {
            MediaHandler.instance = new MediaHandler();
        }
        return MediaHandler.instance;
    }
    /**
     * 验证文件类型和大小
     */
    validateFile(file, type) {
        const maxSizes = {
            image: 10 * 1024 * 1024, // 10MB
            file: 50 * 1024 * 1024, // 50MB
            voice: 10 * 1024 * 1024 // 10MB
        };
        const allowedTypes = {
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            file: [], // 允许所有类型
            voice: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm']
        };
        // 检查文件大小
        if (file.size > maxSizes[type]) {
            return {
                valid: false,
                error: `文件过大，最大支持 ${this.formatFileSize(maxSizes[type])}`
            };
        }
        // 检查文件类型
        if (type !== 'file' && allowedTypes[type].length > 0) {
            if (!allowedTypes[type].includes(file.type)) {
                return {
                    valid: false,
                    error: `不支持的文件类型: ${file.type}`
                };
            }
        }
        return { valid: true };
    }
    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    /**
     * 压缩图片
     */
    async compressImage(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                // 计算压缩后的尺寸
                let { width, height } = img;
                const maxWidth = 1920;
                const maxHeight = 1080;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                canvas.width = width;
                canvas.height = height;
                // 绘制图片
                ctx === null || ctx === void 0 ? void 0 : ctx.drawImage(img, 0, 0, width, height);
                // 转换为blob
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }
                    else {
                        reject(new Error('图片压缩失败'));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = URL.createObjectURL(file);
        });
    }
    /**
     * 上传文件（带进度回调）
     */
    async uploadFile(file, uploadUrl, additionalData = {}, onProgress) {
        const formData = new FormData();
        formData.append('file', file);
        // 添加额外数据
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            // 监听上传进度
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    const progress = {
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100)
                    };
                    onProgress(progress);
                }
            });
            // 监听响应
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve({
                            url: result.url,
                            fileName: file.name,
                            size: file.size,
                            type: file.type
                        });
                    }
                    catch (error) {
                        reject(new Error('响应解析失败'));
                    }
                }
                else {
                    reject(new Error(`上传失败: HTTP ${xhr.status}`));
                }
            });
            xhr.addEventListener('error', () => {
                reject(new Error('网络错误'));
            });
            xhr.addEventListener('timeout', () => {
                reject(new Error('上传超时'));
            });
            xhr.open('POST', uploadUrl);
            xhr.timeout = 60000; // 60秒超时
            xhr.send(formData);
        });
    }
    /**
     * 创建图片预览
     */
    createImagePreview(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                var _a;
                resolve((_a = e.target) === null || _a === void 0 ? void 0 : _a.result);
            };
            reader.onerror = () => {
                reject(new Error('图片预览生成失败'));
            };
            reader.readAsDataURL(file);
        });
    }
    /**
     * 获取文件图标
     */
    getFileIcon(fileName) {
        var _a;
        const extension = (_a = fileName.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        const iconMap = {
            // 图片
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
            // 文档
            pdf: '📄', doc: '📝', docx: '📝', txt: '📄',
            // 表格
            xls: '📊', xlsx: '📊', csv: '📊',
            // 演示
            ppt: '📽️', pptx: '📽️',
            // 压缩包
            zip: '🗜️', rar: '🗜️', '7z': '🗜️',
            // 音频
            mp3: '🎵', wav: '🎵', ogg: '🎵', m4a: '🎵',
            // 视频
            mp4: '🎬', avi: '🎬', mov: '🎬', wmv: '🎬',
            // 代码
            js: '📄', html: '📄', css: '📄', json: '📄'
        };
        return iconMap[extension || ''] || '📎';
    }
}
/**
 * 语音录制器
 */
class VoiceRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.audioChunks = [];
        this.isRecording = false;
    }
    /**
     * 检查浏览器支持
     */
    isSupported() {
        try {
            return !!(navigator.mediaDevices &&
                typeof navigator.mediaDevices.getUserMedia === 'function' &&
                typeof window !== 'undefined' &&
                'MediaRecorder' in window &&
                typeof MediaRecorder === 'function');
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * 开始录制
     */
    async startRecording() {
        if (!this.isSupported()) {
            throw new Error('当前浏览器不支持语音录制');
        }
        if (this.isRecording) {
            throw new Error('已在录制中');
        }
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            this.mediaRecorder.start();
            this.isRecording = true;
            console.log('🎤 开始录制语音');
        }
        catch (error) {
            throw new Error('录制权限被拒绝或设备不可用');
        }
    }
    /**
     * 停止录制
     */
    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            throw new Error('未在录制中');
        }
        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
                    type: 'audio/webm',
                    lastModified: Date.now()
                });
                this.cleanup();
                resolve(audioFile);
            };
            this.mediaRecorder.onerror = (error) => {
                this.cleanup();
                reject(error);
            };
            this.mediaRecorder.stop();
            this.isRecording = false;
            console.log('🎤 录制结束');
        });
    }
    /**
     * 取消录制
     */
    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        this.cleanup();
        console.log('🎤 录制已取消');
    }
    /**
     * 清理资源
     */
    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
    }
    /**
     * 获取录制状态
     */
    getRecordingState() {
        return this.isRecording;
    }
}

  
  // ===== 主SDK类 =====
  /**
 * QuickTalk SDK 主入口文件
 * 整合所有模块，提供统一的客服系统接口
 */
/**
 * QuickTalk 客服系统主类
 */
class QuickTalkSDK extends EventEmitter {
    constructor(config) {
        super();
        this.wsClient = null;
        this.isInitialized = false;
        // 验证必要配置
        if (!config.shopId) {
            throw new Error('shopId is required');
        }
        this.config = {
            autoDetectServer: true,
            debugMode: false,
            ...config
        };
        // 初始化管理器
        this.uiManager = UIManager.getInstance();
        this.viewportManager = ViewportManager.getInstance();
        this.styleSystem = StyleSystem.getInstance();
        this.mediaHandler = MediaHandler.getInstance();
        this.voiceRecorder = new VoiceRecorder();
        console.log(`🚀 QuickTalk SDK 初始化 - 店铺ID: ${this.config.shopId}`);
    }
    /**
     * 初始化SDK
     */
    async init() {
        if (this.isInitialized) {
            console.warn('SDK already initialized');
            return;
        }
        try {
            // 等待DOM准备
            await new Promise(resolve => onReady(resolve));
            // 确保ImageViewer类可用于打包（防止被tree-shaking移除）
            if (typeof ImageViewer === 'undefined') {
                throw new Error('ImageViewer class not available');
            }
            // 初始化WebSocket客户端
            this.wsClient = new WebSocketClient(this.config.shopId, this.config.customerId);
            // 创建UI
            const components = this.uiManager.createUI();
            // 绑定事件
            this.bindEvents();
            // 连接WebSocket
            await this.wsClient.connect(this.config.serverUrl);
            // 将服务端地址暴露到全局供UI适配使用（用于改写 localhost 资源URL）
            try {
                const cfg = this.wsClient.getServerConfig();
                const serverUrl = (cfg === null || cfg === void 0 ? void 0 : cfg.serverUrl) || this.config.serverUrl;
                if (serverUrl) {
                    window.__QUICKTALK_SERVER_URL__ = serverUrl;
                }
            }
            catch (_a) { }
            this.isInitialized = true;
            this.emit('ui-ready', undefined);
            console.log('✅ QuickTalk SDK 初始化完成');
            console.log(`📱 设备信息: ${this.viewportManager.getDeviceSummary()}`);
        }
        catch (error) {
            console.error('❌ SDK初始化失败:', error);
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * 绑定各种事件
     */
    bindEvents() {
        if (!this.wsClient)
            return;
        // WebSocket事件
        this.wsClient.onMessage((message) => {
            this.uiManager.addMessage(message);
            this.emit('message', message);
        });
        this.wsClient.onConnect((config) => {
            console.log('🔗 WebSocket连接成功:', config.serverUrl);
            this.emit('connected', { serverUrl: config.serverUrl });
        });
        this.wsClient.onDisconnect(() => {
            console.log('🔌 WebSocket连接断开');
            this.emit('disconnected', undefined);
        });
        this.wsClient.onError((error) => {
            console.error('❌ WebSocket错误:', error);
            this.emit('error', error);
        });
        // UI事件 - 发送消息
        document.addEventListener('qt-send-message', (event) => {
            const { content, messageType } = event.detail;
            this.sendMessage(content, messageType);
        });
        // UI事件 - 文件上传
        document.addEventListener('qt-upload-file', (event) => {
            const { file, messageType } = event.detail;
            this.uploadFile(file, messageType);
        });
    }
    /**
     * 发送消息
     */
    sendMessage(content, messageType = 'text') {
        if (!this.wsClient) {
            console.warn('WebSocket客户端未初始化');
            return;
        }
        // 添加到UI
        const message = {
            content,
            messageType,
            senderType: 'customer',
            timestamp: new Date()
        };
        // 如果是文件或图片消息，设置fileUrl
        if (messageType === 'image' || messageType === 'file') {
            message.fileUrl = content;
            // 从URL中提取文件名
            const urlParts = content.split('/');
            message.fileName = urlParts[urlParts.length - 1];
        }
        this.uiManager.addMessage(message);
        // 通过WebSocket发送
        this.wsClient.sendMessage(content, messageType);
    }
    /**
     * 上传文件
     */
    async uploadFile(file, messageType = 'file') {
        if (!this.wsClient) {
            throw new Error('WebSocket客户端未初始化');
        }
        try {
            // 验证文件
            const validation = this.mediaHandler.validateFile(file, messageType);
            if (!validation.valid) {
                throw new Error(validation.error);
            }
            // 显示上传状态
            this.uiManager.showUploadStatus(`正在上传${messageType === 'image' ? '图片' : '文件'}...`);
            // 如果是图片且过大，进行压缩
            let processedFile = file;
            if (messageType === 'image' && file.size > 2 * 1024 * 1024) { // 2MB
                processedFile = await this.mediaHandler.compressImage(file, 0.8);
                console.log(`📷 图片已压缩: ${file.size} -> ${processedFile.size} bytes`);
            }
            // 上传文件
            const result = await this.wsClient.uploadFile(processedFile, messageType);
            // 清除上传状态
            this.uiManager.clearUploadStatus();
            // 注意：WebSocketClient.uploadFile已经自动发送了消息，这里只需要添加到界面
            const fileMessage = {
                content: messageType === 'image' ? result.fileName : result.url, // 图片显示文件名，其他显示URL
                messageType,
                senderType: 'customer',
                timestamp: new Date(),
                fileUrl: result.url,
                fileName: result.fileName
            };
            // 添加文件消息到界面
            this.uiManager.addMessage(fileMessage);
            this.emit('upload-complete', {
                url: result.url,
                fileName: result.fileName
            });
            console.log(`📎 文件上传成功: ${result.fileName}`);
        }
        catch (error) {
            console.error('📎 文件上传失败:', error);
            this.uiManager.showUploadStatus('文件上传失败');
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * 开始语音录制
     */
    async startVoiceRecording() {
        if (!this.voiceRecorder.isSupported()) {
            throw new Error('当前浏览器不支持语音录制');
        }
        try {
            await this.voiceRecorder.startRecording();
            this.uiManager.showUploadStatus('正在录制语音...');
        }
        catch (error) {
            console.error('🎤 语音录制启动失败:', error);
            throw error;
        }
    }
    /**
     * 停止语音录制并上传
     */
    async stopVoiceRecording() {
        try {
            const voiceFile = await this.voiceRecorder.stopRecording();
            await this.uploadFile(voiceFile, 'voice');
        }
        catch (error) {
            console.error('🎤 语音录制停止失败:', error);
            this.uiManager.showUploadStatus('语音录制失败');
            throw error;
        }
    }
    /**
     * 取消语音录制
     */
    cancelVoiceRecording() {
        this.voiceRecorder.cancelRecording();
        this.uiManager.showUploadStatus('语音录制已取消');
    }
    /**
     * 打开客服面板
     */
    open() {
        this.uiManager.open();
    }
    /**
     * 关闭客服面板
     */
    close() {
        this.uiManager.close();
    }
    /**
     * 切换客服面板显示状态
     */
    toggle() {
        this.uiManager.toggle();
    }
    /**
     * 重连WebSocket
     */
    reconnect() {
        if (this.wsClient) {
            this.wsClient.reconnect();
        }
    }
    /**
     * 获取连接状态
     */
    getConnectionState() {
        var _a;
        return ((_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getConnectionState()) || 'closed';
    }
    /**
     * 获取客户ID
     */
    getCustomerId() {
        var _a;
        return ((_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getCustomerId()) || '';
    }
    /**
     * 获取服务器配置
     */
    getServerConfig() {
        var _a;
        return (_a = this.wsClient) === null || _a === void 0 ? void 0 : _a.getServerConfig();
    }
    /**
     * 获取设备信息
     */
    getDeviceInfo() {
        return this.viewportManager.getDeviceSummary();
    }
    /**
     * 获取UI管理器实例（用于高级功能访问）
     */
    getUIManager() {
        return this.uiManager;
    }
    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
        this.config.debugMode = enabled;
        if (enabled) {
            console.log('🔧 调试模式已启用');
            console.log('📊 当前状态:', {
                initialized: this.isInitialized,
                connected: this.getConnectionState(),
                customerId: this.getCustomerId(),
                device: this.getDeviceInfo()
            });
        }
    }
    /**
     * 销毁SDK实例
     */
    destroy() {
        console.log('🗑️ 销毁 QuickTalk SDK...');
        // 清理WebSocket
        if (this.wsClient) {
            this.wsClient.cleanup();
            this.wsClient = null;
        }
        // 清理UI
        this.uiManager.cleanup();
        // 清理语音录制
        this.voiceRecorder.cancelRecording();
        // 清理视口管理器
        this.viewportManager.cleanup();
        // 移除所有事件监听器
        this.removeAllListeners();
        this.isInitialized = false;
        console.log('✅ QuickTalk SDK 已清理');
    }
}
/**
 * 向后兼容的全局接口
 */
window.QuickTalkCustomerService = {
    /**
     * 简化的初始化接口（向后兼容）
     */
    init(config) {
        const sdk = new QuickTalkSDK(config);
        sdk.init().catch(error => {
            console.error('QuickTalk初始化失败:', error);
        });
    },
    /**
     * 完整SDK类的引用
     */
    SDK: QuickTalkSDK
};
// 默认导出
// 版本信息
const VERSION = '2.0.0';
console.log(`📦 QuickTalk SDK v${VERSION} 已加载`);
console.log('🎯 功能特性:');
console.log('  • 智能服务器检测');
console.log('  • 响应式样式系统（防覆盖）');
console.log('  • 自适应字体和布局');
console.log('  • 文件上传（图片/文件/语音）');
console.log('  • 模块化架构');
console.log('  • TypeScript 支持');

  
  // ===== 全局导出 =====
  // 导出createImageMessage函数供外部使用
  window.createImageMessage = createImageMessage;
  window.ImageViewer = ImageViewer;
  
  console.log('✅ QuickTalk SDK 2.0.0 已加载（独立版本）');
  console.log('🎯 重点改进:');
  console.log('  • 防止独立站样式覆盖');  
  console.log('  • 响应式字体和窗口比例');
  console.log('  • 模块化架构重构');
  console.log('  • 更好的移动端适配');
})();
