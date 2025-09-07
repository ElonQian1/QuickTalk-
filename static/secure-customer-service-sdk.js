// 安全客服系统SDK - 带API密钥验证
// 文件名: secure-customer-service-sdk.js

(function(window, document) {
    'use strict';
    
    // SDK配置
    const DEFAULT_CONFIG = {
        position: 'bottom-right',
        theme: 'default',
        autoOpen: false,
        welcomeMessage: '您好！有什么可以帮您的吗？',
        zIndex: 999999,
        ui: {
            title: '在线客服',
            placeholder: '请输入您的消息...',
            sendButton: '发送'
        }
    };
    
    // 安全客服SDK类
    class SecureCustomerServiceSDK {
        constructor(config = {}) {
            // 从全局配置获取认证信息
            const globalConfig = window.QUICKTALK_CONFIG || {};
            
            if (!globalConfig.shopKey) {
                console.error('❌ QuickTalk初始化失败：缺少shopKey配置');
                this.showError('客服系统配置错误：缺少认证密钥');
                return;
            }
            
            this.config = { ...DEFAULT_CONFIG, ...globalConfig, ...config };
            this.isInitialized = false;
            this.isOpen = false;
            this.userId = this.generateUserId();
            this.socket = null;
            this.chatWindow = null;
            this.isConnected = false;
            
            // 验证配置
            if (this.validateConfig()) {
                this.init();
            }
        }
        
        // 验证配置和认证信息
        validateConfig() {
            const required = ['shopKey', 'shopId', 'apiUrl'];
            for (const key of required) {
                if (!this.config[key]) {
                    console.error(`❌ QuickTalk配置错误：缺少 ${key}`);
                    this.showError(`配置错误：缺少${key}`);
                    return false;
                }
            }
            
            // 验证当前域名
            const currentDomain = window.location.hostname;
            const authorizedDomain = this.config.authorizedDomain;
            
            if (currentDomain !== authorizedDomain && 
                !currentDomain.endsWith('.' + authorizedDomain) && 
                currentDomain !== 'localhost') {
                console.error('❌ QuickTalk域名验证失败');
                console.error('当前域名:', currentDomain);
                console.error('授权域名:', authorizedDomain);
                this.showError(`域名未授权：当前域名 ${currentDomain} 未在白名单中`);
                return false;
            }
            
            console.log('✅ QuickTalk配置验证通过');
            return true;
        }
        
        // 生成用户ID
        generateUserId() {
            return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
        
        // 初始化SDK
        async init() {
            if (this.isInitialized) return;
            
            this.injectCSS();
            this.createChatWindow();
            this.bindExistingButtons();
            await this.connect();
            
            this.isInitialized = true;
            console.log('✅ QuickTalk客服系统初始化完成');
        }
        
        // 连接到服务器（带API密钥验证）
        async connect() {
            try {
                console.log('🔐 正在进行API密钥验证...');
                
                // 准备认证数据
                const authData = {
                    userId: this.userId,
                    timestamp: Date.now(),
                    shopKey: this.config.shopKey,
                    shopId: this.config.shopId,
                    domain: window.location.hostname,
                    version: this.config.version || '1.0.0'
                };
                
                // 发送认证请求
                const response = await fetch(`${this.config.apiUrl}/secure-connect`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Shop-Key': this.config.shopKey,
                        'X-Shop-Id': this.config.shopId
                    },
                    body: JSON.stringify(authData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '认证失败');
                }
                
                const data = await response.json();
                console.log('✅ API密钥验证成功:', data.shop?.name);
                
                // 建立WebSocket连接
                if (this.config.wsUrl) {
                    await this.connectWebSocket();
                } else {
                    // 使用HTTP轮询
                    this.startPolling();
                }
                
                this.isConnected = true;
                
                // 添加欢迎消息
                setTimeout(() => {
                    this.addMessage('staff', this.config.welcomeMessage, '客服助手');
                }, 1000);
                
            } catch (error) {
                console.error('❌ 连接失败:', error.message);
                this.handleConnectionError(error);
            }
        }
        
        // 建立WebSocket连接
        async connectWebSocket() {
            return new Promise((resolve, reject) => {
                const wsUrl = `${this.config.wsUrl}?userId=${this.userId}&shopKey=${this.config.shopKey}`;
                this.socket = new WebSocket(wsUrl);
                
                this.socket.onopen = () => {
                    console.log('🔌 WebSocket连接已建立');
                    resolve();
                };
                
                this.socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                };
                
                this.socket.onclose = () => {
                    console.log('🔌 WebSocket连接已断开');
                    this.socket = null;
                    this.isConnected = false;
                    
                    // 5秒后重连
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.connect();
                        }
                    }, 5000);
                };
                
                this.socket.onerror = (error) => {
                    console.error('🔌 WebSocket错误:', error);
                    reject(error);
                };
            });
        }
        
        // 开始HTTP轮询
        startPolling() {
            setInterval(async () => {
                try {
                    const response = await fetch(`${this.config.apiUrl}/messages?userId=${this.userId}`, {
                        headers: {
                            'X-Shop-Key': this.config.shopKey,
                            'X-Shop-Id': this.config.shopId
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.messages && data.messages.length > 0) {
                            data.messages.forEach(msg => this.handleMessage(msg));
                        }
                    }
                } catch (error) {
                    console.warn('轮询消息失败:', error.message);
                }
            }, 3000);
        }
        
        // 处理连接错误
        handleConnectionError(error) {
            let errorMessage;
            
            if (error.message.includes('API密钥无效')) {
                errorMessage = `
                    <div style="text-align: center; padding: 20px; color: #e74c3c;">
                        <h4 style="margin: 0 0 10px 0;">🔑 认证失败</h4>
                        <p style="margin: 0 0 10px 0;">API密钥无效或已过期</p>
                        <small style="color: #7f8c8d;">请联系管理员重新生成集成代码</small>
                    </div>
                `;
            } else if (error.message.includes('域名不匹配')) {
                errorMessage = `
                    <div style="text-align: center; padding: 20px; color: #e74c3c;">
                        <h4 style="margin: 0 0 10px 0;">🚫 域名未授权</h4>
                        <p style="margin: 0 0 10px 0;">当前域名未在授权列表中</p>
                        <small style="color: #7f8c8d;">请联系管理员将域名加入白名单</small>
                    </div>
                `;
            } else {
                errorMessage = `
                    <div style="text-align: center; padding: 20px; color: #e74c3c;">
                        <h4 style="margin: 0 0 10px 0;">❌ 连接失败</h4>
                        <p style="margin: 0;">${error.message}</p>
                    </div>
                `;
            }
            
            if (this.chatWindow) {
                const messagesContainer = this.chatWindow.querySelector('.cs-sdk-messages');
                if (messagesContainer) {
                    messagesContainer.innerHTML = errorMessage;
                }
            } else {
                this.createErrorNotification(errorMessage);
            }
        }
        
        // 创建错误通知
        createErrorNotification(message) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border: 2px solid #e74c3c;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: ${this.config.zIndex + 1};
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            notification.innerHTML = `
                ${message}
                <button onclick="this.parentElement.remove()" style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #999;
                ">&times;</button>
            `;
            
            document.body.appendChild(notification);
            
            // 15秒后自动移除
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 15000);
        }
        
        // 显示错误消息
        showError(message) {
            console.error('QuickTalk错误:', message);
            this.createErrorNotification(`
                <div style="color: #e74c3c; padding: 10px;">
                    <h4 style="margin: 0 0 10px 0;">⚠️ QuickTalk错误</h4>
                    <p style="margin: 0;">${message}</p>
                </div>
            `);
        }
        
        // 注入CSS样式
        injectCSS() {
            if (document.getElementById('quicktalk-sdk-css')) return;
            
            const css = `
                .quicktalk-chat-window {
                    position: fixed;
                    ${this.config.ui.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                    ${this.config.ui.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                    width: 350px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    display: none;
                    flex-direction: column;
                    z-index: ${this.config.zIndex};
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    transform: scale(0);
                    transform-origin: ${this.config.ui.position.replace('-', ' ')};
                    transition: transform 0.3s ease;
                }
                
                .quicktalk-chat-window.open {
                    display: flex;
                    transform: scale(1);
                }
                
                .quicktalk-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .quicktalk-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .quicktalk-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .quicktalk-close:hover {
                    background: rgba(255,255,255,0.2);
                }
                
                .quicktalk-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    background: #f8f9fa;
                }
                
                .quicktalk-message {
                    margin-bottom: 15px;
                }
                
                .quicktalk-message.user {
                    text-align: right;
                }
                
                .quicktalk-message.user .quicktalk-message-text {
                    background: #667eea;
                    color: white;
                    margin-left: 50px;
                }
                
                .quicktalk-message.staff .quicktalk-message-text {
                    background: white;
                    color: #333;
                    margin-right: 50px;
                }
                
                .quicktalk-message-text {
                    padding: 10px 15px;
                    border-radius: 18px;
                    display: inline-block;
                    max-width: 100%;
                    word-wrap: break-word;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                
                .quicktalk-input-area {
                    padding: 20px;
                    background: white;
                    border-radius: 0 0 12px 12px;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 10px;
                }
                
                .quicktalk-input {
                    flex: 1;
                    padding: 10px 15px;
                    border: 1px solid #ddd;
                    border-radius: 20px;
                    outline: none;
                    font-size: 14px;
                }
                
                .quicktalk-input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
                }
                
                .quicktalk-send {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .quicktalk-send:hover {
                    background: #5a6fd8;
                }
                
                .quicktalk-float-button {
                    position: fixed;
                    ${this.config.ui.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
                    ${this.config.ui.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                    border-radius: 50%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: ${this.config.zIndex - 1};
                    transition: transform 0.3s ease;
                    color: white;
                    font-size: 24px;
                }
                
                .quicktalk-float-button:hover {
                    transform: scale(1.1);
                }
                
                @media (max-width: 480px) {
                    .quicktalk-chat-window {
                        width: calc(100vw - 40px);
                        height: calc(100vh - 40px);
                        left: 20px !important;
                        right: 20px !important;
                        top: 20px !important;
                        bottom: 20px !important;
                    }
                }
            `;
            
            const style = document.createElement('style');
            style.id = 'quicktalk-sdk-css';
            style.textContent = css;
            document.head.appendChild(style);
        }
        
        // 创建聊天窗口
        createChatWindow() {
            this.chatWindow = document.createElement('div');
            this.chatWindow.className = 'quicktalk-chat-window';
            this.chatWindow.innerHTML = `
                <div class="quicktalk-header">
                    <h3>${this.config.ui.title}</h3>
                    <button class="quicktalk-close">&times;</button>
                </div>
                <div class="quicktalk-messages"></div>
                <div class="quicktalk-input-area">
                    <input type="text" class="quicktalk-input" placeholder="${this.config.ui.placeholder}">
                    <button class="quicktalk-send">${this.config.ui.sendButton}</button>
                </div>
            `;
            
            // 创建浮动按钮
            const floatButton = document.createElement('button');
            floatButton.className = 'quicktalk-float-button';
            floatButton.innerHTML = '💬';
            floatButton.onclick = () => this.toggle();
            
            document.body.appendChild(this.chatWindow);
            document.body.appendChild(floatButton);
            
            // 绑定事件
            this.chatWindow.querySelector('.quicktalk-close').onclick = () => this.close();
            this.chatWindow.querySelector('.quicktalk-send').onclick = () => this.sendMessage();
            this.chatWindow.querySelector('.quicktalk-input').onkeypress = (e) => {
                if (e.key === 'Enter') this.sendMessage();
            };
        }
        
        // 绑定现有按钮
        bindExistingButtons() {
            const buttons = document.querySelectorAll('[data-quicktalk="open"]');
            buttons.forEach(btn => {
                btn.onclick = () => this.open();
            });
        }
        
        // 处理消息
        handleMessage(data) {
            if (data.type === 'staff_message') {
                this.addMessage('staff', data.message, data.staffName || '客服');
            } else if (data.type === 'system') {
                this.addMessage('system', data.message, 'System');
            }
        }
        
        // 添加消息
        addMessage(type, message, sender = '') {
            const messagesContainer = this.chatWindow.querySelector('.quicktalk-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `quicktalk-message ${type}`;
            
            let messageContent = message;
            if (sender && type === 'staff') {
                messageContent = `<div class="sender" style="font-size: 12px; color: #666; margin-bottom: 5px;">${sender}:</div>${message}`;
            }
            
            messageDiv.innerHTML = `<div class="quicktalk-message-text">${messageContent}</div>`;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 发送消息
        async sendMessage() {
            const input = this.chatWindow.querySelector('.quicktalk-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            // 显示用户消息
            this.addMessage('user', message);
            input.value = '';
            
            try {
                // 通过WebSocket发送
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({
                        type: 'user_message',
                        message: message,
                        userId: this.userId,
                        shopKey: this.config.shopKey,
                        timestamp: Date.now()
                    }));
                } else {
                    // 通过HTTP发送
                    const response = await fetch(`${this.config.apiUrl}/send`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Shop-Key': this.config.shopKey,
                            'X-Shop-Id': this.config.shopId
                        },
                        body: JSON.stringify({
                            userId: this.userId,
                            message: message,
                            shopKey: this.config.shopKey,
                            timestamp: Date.now()
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('发送消息失败');
                    }
                }
            } catch (error) {
                console.error('发送消息失败:', error);
                this.addMessage('system', '消息发送失败，请重试', 'System');
            }
        }
        
        // 打开聊天窗口
        open() {
            if (!this.isConnected) {
                this.addMessage('system', '正在连接客服系统...', 'System');
                this.connect();
            }
            
            this.chatWindow.classList.add('open');
            this.isOpen = true;
            this.chatWindow.querySelector('.quicktalk-input').focus();
        }
        
        // 关闭聊天窗口
        close() {
            this.chatWindow.classList.remove('open');
            this.isOpen = false;
        }
        
        // 切换聊天窗口
        toggle() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        }
        
        // 销毁SDK
        destroy() {
            if (this.socket) {
                this.socket.close();
            }
            if (this.chatWindow) {
                this.chatWindow.remove();
            }
            const css = document.getElementById('quicktalk-sdk-css');
            if (css) {
                css.remove();
            }
        }
    }
    
    // 全局API
    window.SecureCustomerService = SecureCustomerServiceSDK;
    
    // 自动初始化
    if (window.QUICKTALK_CONFIG) {
        window.addEventListener('DOMContentLoaded', function() {
            window.customerService = new SecureCustomerServiceSDK();
        });
    }
    
})(window, document);
