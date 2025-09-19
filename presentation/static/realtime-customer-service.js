/**
 * 集成式实时客服系统
 * 可以轻松嵌入到任何网站中
 * 作者: Customer Service Team
 * 版本: 1.0.0
 */

(function() {
    'use strict';
    
    // 配置选项
    const CONFIG = {
        // WebSocket服务器地址 - 请修改为您的服务器地址
        wsUrl: 'ws://localhost:3030/ws',
        
        // 样式配置
        position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
        zIndex: 999999,
        
        // 功能配置
        autoConnect: true,
        showWelcomeMessage: true,
        enableSound: false,
        
        // 文本配置
        texts: {
            welcome: '欢迎使用在线客服，请问有什么可以帮助您的吗？',
            placeholder: '请输入您的消息...',
            sendButton: '发送',
            title: '在线客服',
            connecting: '连接中...',
            connected: '已连接',
            disconnected: '连接断开',
            connectionError: '连接错误'
        }
    };
    
    // CSS样式
    const CSS = `
        .realtime-customer-service {
            position: fixed;
            bottom: 160px;
            right: 40px;
            width: 380px;
            height: 520px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: none;
            flex-direction: column;
            z-index: ${CONFIG.zIndex};
            overflow: hidden;
            transform: scale(0);
            transform-origin: bottom right;
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        .realtime-customer-service.open {
            display: flex;
            transform: scale(1);
        }
        
        .realtime-customer-service.minimized {
            height: 60px;
        }
        
        .realtime-customer-service.minimized .rcs-chat-body,
        .realtime-customer-service.minimized .rcs-chat-input-area,
        .realtime-customer-service.minimized .rcs-connection-status {
            display: none;
        }
        
        .rcs-chat-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .rcs-chat-header h3 {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
        }
        
        .rcs-chat-controls {
            display: flex;
            gap: 10px;
        }
        
        .rcs-chat-controls button {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.3s;
        }
        
        .rcs-chat-controls button:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .rcs-chat-body {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
        }
        
        .rcs-chat-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
            background: #fafbfc;
        }
        
        .rcs-chat-messages::-webkit-scrollbar {
            width: 6px;
        }
        
        .rcs-chat-messages::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        
        .rcs-chat-messages::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        
        .rcs-message {
            display: flex;
            flex-direction: column;
            margin-bottom: 10px;
        }
        
        .rcs-message-text {
            padding: 12px 16px;
            border-radius: 18px;
            max-width: 80%;
            word-wrap: break-word;
            line-height: 1.4;
        }
        
        .rcs-message-time {
            font-size: 11px;
            color: #999;
            margin-top: 5px;
            text-align: center;
        }
        
        .rcs-system-message .rcs-message-text {
            background: #f0f0f0;
            color: #666;
            align-self: center;
            text-align: center;
            font-size: 13px;
        }
        
        .rcs-user-message {
            align-items: flex-end;
        }
        
        .rcs-user-message .rcs-message-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            align-self: flex-end;
        }
        
        .rcs-user-message .rcs-message-time {
            text-align: right;
        }
        
        .rcs-staff-message {
            align-items: flex-start;
        }
        
        .rcs-staff-message .rcs-message-text {
            background: #f8f9fa;
            color: #333;
            border: 1px solid #e9ecef;
            align-self: flex-start;
        }
        
        .rcs-staff-message .rcs-message-time {
            text-align: left;
        }
        
        .rcs-chat-input-area {
            padding: 15px 20px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
            background: white;
        }
        
        .rcs-chat-input {
            flex: 1;
            padding: 10px 15px;
            border: 1px solid #ddd;
            border-radius: 20px;
            outline: none;
            font-size: 14px;
            font-family: inherit;
        }
        
        .rcs-chat-input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
        }
        
        .rcs-send-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.3s ease;
        }
        
        .rcs-send-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }
        
        .rcs-send-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .rcs-connection-status {
            padding: 8px 20px;
            background: #f8f9fa;
            border-top: 1px solid #eee;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }
        
        .rcs-status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
        }
        
        .rcs-status-connected {
            background: #28a745;
            animation: rcs-pulse 2s infinite;
        }
        
        .rcs-status-disconnected {
            background: #dc3545;
        }
        
        .rcs-status-connecting {
            background: #ffc107;
            animation: rcs-pulse 1s infinite;
        }
        
        @keyframes rcs-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        @media (max-width: 768px) {
            .realtime-customer-service {
                width: calc(100vw - 20px);
                right: 10px;
                left: 10px;
                bottom: 20px;
            }
        }
    `;
    
    // 实时客服类
    class RealtimeCustomerService {
        constructor(options = {}) {
            this.config = Object.assign({}, CONFIG, options);
            this.socket = null;
            this.isConnected = false;
            this.isMinimized = false;
            this.isOpen = false;
            this.userId = this.generateUserId();
            this.reconnectAttempts = 0;
            this.maxReconnectAttempts = 5;
            this.reconnectDelay = 3000;
            
            this.init();
        }
        
        init() {
            this.injectCSS();
            this.createChatWindow();
            this.bindEvents();
            
            if (this.config.autoConnect) {
                this.connectWebSocket();
            }
        }
        
        injectCSS() {
            const style = document.createElement('style');
            style.textContent = CSS;
            document.head.appendChild(style);
        }
        
        createChatWindow() {
            const chatWindow = document.createElement('div');
            chatWindow.className = 'realtime-customer-service';
            chatWindow.innerHTML = `
                <div class="rcs-chat-header">
                    <h3>${this.config.texts.title}</h3>
                    <div class="rcs-chat-controls">
                        <button class="rcs-minimize-btn">−</button>
                        <button class="rcs-close-btn">×</button>
                    </div>
                </div>
                <div class="rcs-chat-body">
                    <div class="rcs-chat-messages">
                        ${this.config.showWelcomeMessage ? `
                        <div class="rcs-message rcs-system-message">
                            <span class="rcs-message-text">${this.config.texts.welcome}</span>
                            <span class="rcs-message-time">${this.formatTime(new Date())}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="rcs-chat-input-area">
                        <input type="text" class="rcs-chat-input" placeholder="${this.config.texts.placeholder}">
                        <button class="rcs-send-btn">${this.config.texts.sendButton}</button>
                    </div>
                </div>
                <div class="rcs-connection-status">
                    <span class="rcs-status-indicator rcs-status-connecting"></span>
                    <span class="rcs-status-text">${this.config.texts.connecting}</span>
                </div>
            `;
            
            document.body.appendChild(chatWindow);
            
            // 缓存DOM元素
            this.chatWindow = chatWindow;
            this.chatMessages = chatWindow.querySelector('.rcs-chat-messages');
            this.chatInput = chatWindow.querySelector('.rcs-chat-input');
            this.sendBtn = chatWindow.querySelector('.rcs-send-btn');
            this.statusIndicator = chatWindow.querySelector('.rcs-status-indicator');
            this.statusText = chatWindow.querySelector('.rcs-status-text');
        }
        
        bindEvents() {
            // 按钮事件
            this.chatWindow.querySelector('.rcs-minimize-btn').addEventListener('click', () => this.minimize());
            this.chatWindow.querySelector('.rcs-close-btn').addEventListener('click', () => this.close());
            this.sendBtn.addEventListener('click', () => this.sendMessage());
            
            // 输入框事件
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // 页面关闭事件
            window.addEventListener('beforeunload', () => {
                if (this.socket) {
                    this.socket.close();
                }
            });
        }
        
        generateUserId() {
            return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
        
        connectWebSocket() {
            try {
                this.socket = new WebSocket(this.config.wsUrl);
                
                this.socket.onopen = () => {
                    console.log('实时客服 WebSocket 连接已建立');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.updateConnectionStatus('connected', this.config.texts.connected);
                    
                    this.sendSystemMessage({
                        type: 'user_connect',
                        userId: this.userId,
                        timestamp: Date.now()
                    });
                };
                
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (error) {
                        console.error('解析实时客服消息失败:', error);
                    }
                };
                
                this.socket.onclose = (event) => {
                    console.log('实时客服 WebSocket 连接关闭:', event.code, event.reason);
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected', this.config.texts.disconnected);
                    
                    if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.attemptReconnect();
                    }
                };
                
                this.socket.onerror = (error) => {
                    console.error('实时客服 WebSocket 错误:', error);
                    this.updateConnectionStatus('disconnected', this.config.texts.connectionError);
                };
                
            } catch (error) {
                console.error('创建实时客服 WebSocket 连接失败:', error);
                this.updateConnectionStatus('disconnected', this.config.texts.connectionError);
                this.attemptReconnect();
            }
        }
        
        attemptReconnect() {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.updateConnectionStatus('disconnected', '连接失败，请刷新页面');
                return;
            }
            
            this.reconnectAttempts++;
            this.updateConnectionStatus('connecting', `重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay);
        }
        
        sendSystemMessage(data) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(data));
            }
        }
        
        handleMessage(data) {
            console.log('收到实时客服消息:', data.type, data);
            switch (data.type) {
                case 'staff_message':
                    this.addMessage('staff', data.message, data.staffName);
                    break;
                case 'system_notification':
                    this.showSystemMessage(data.message);
                    break;
                default:
                    console.log('未知实时客服消息类型:', data);
            }
        }
        
        addMessage(type, message, staffName = null) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `rcs-message rcs-${type}-message`;
            
            const messageText = document.createElement('span');
            messageText.className = 'rcs-message-text';
            messageText.textContent = message;
            
            const messageTime = document.createElement('span');
            messageTime.className = 'rcs-message-time';
            messageTime.textContent = this.formatTime(new Date());
            
            messageDiv.appendChild(messageText);
            messageDiv.appendChild(messageTime);
            
            if (type === 'staff' && staffName) {
                const staffLabel = document.createElement('span');
                staffLabel.textContent = `客服 ${staffName}`;
                staffLabel.style.fontSize = '12px';
                staffLabel.style.color = '#666';
                staffLabel.style.marginBottom = '5px';
                messageDiv.insertBefore(staffLabel, messageText);
            }
            
            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();
        }
        
        showSystemMessage(message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'rcs-message rcs-system-message';
            
            const messageText = document.createElement('span');
            messageText.className = 'rcs-message-text';
            messageText.textContent = message;
            
            const messageTime = document.createElement('span');
            messageTime.className = 'rcs-message-time';
            messageTime.textContent = this.formatTime(new Date());
            
            messageDiv.appendChild(messageText);
            messageDiv.appendChild(messageTime);
            
            this.chatMessages.appendChild(messageDiv);
            this.scrollToBottom();
        }
        
        sendMessage() {
            const message = this.chatInput.value.trim();
            if (!message) return;
            
            if (!this.isConnected) {
                this.showSystemMessage('连接断开，无法发送消息');
                return;
            }
            
            this.addMessage('user', message);
            this.chatInput.value = '';
            
            this.sendSystemMessage({
                type: 'user_message',
                userId: this.userId,
                message: message,
                timestamp: Date.now()
            });
        }
        
        updateConnectionStatus(status, text) {
            this.statusIndicator.className = `rcs-status-indicator rcs-status-${status}`;
            this.statusText.textContent = text;
        }
        
        formatTime(date) {
            return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        scrollToBottom() {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
        
        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }
        
        open() {
            this.chatWindow.classList.add('open');
            this.chatWindow.classList.remove('minimized');
            this.isOpen = true;
            this.isMinimized = false;
            this.chatInput.focus();
            this.scrollToBottom();
        }
        
        close() {
            this.chatWindow.classList.remove('open', 'minimized');
            this.isOpen = false;
            this.isMinimized = false;
        }
        
        minimize() {
            if (this.isMinimized) {
                this.chatWindow.classList.remove('minimized');
                this.isMinimized = false;
                this.chatInput.focus();
            } else {
                this.chatWindow.classList.add('minimized');
                this.isMinimized = true;
            }
        }
    }
    
    // 全局API
    window.RealtimeCustomerService = RealtimeCustomerService;
    
    // 兼容原有客服按钮的全局函数
    window.toggleCustomerService = function() {
        if (!window.customerServiceInstance) {
            window.customerServiceInstance = new RealtimeCustomerService();
        }
        window.customerServiceInstance.toggle();
    };
    
    // 自动初始化（如果页面有客服按钮）
    document.addEventListener('DOMContentLoaded', function() {
        // 查找原有的客服按钮
        const existingCustomerServiceBtn = document.querySelector('#cb, .customer-service, .kefu');
        if (existingCustomerServiceBtn && !window.customerServiceInstance) {
            // 延迟初始化
            setTimeout(() => {
                window.customerServiceInstance = new RealtimeCustomerService();
            }, 1000);
        }
    });
    
})();
