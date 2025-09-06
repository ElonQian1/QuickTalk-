// 最简单的第三方客服系统 - JavaScript SDK
// 文件名: simple-customer-service-sdk.js

(function(window, document) {
    'use strict';
    
    // SDK配置
    const DEFAULT_CONFIG = {
        apiUrl: 'https://your-domain.com/api',
        wsUrl: 'wss://your-domain.com/ws',
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
    
    // 简单客服SDK类
    class SimpleCustomerServiceSDK {
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
            this.isInitialized = false;
            this.isOpen = false;
            this.userId = this.generateUserId();
            this.socket = null;
            this.chatWindow = null;
            
            // 自动初始化
            this.init();
        }
        
        // 生成用户ID
        generateUserId() {
            return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
        
        // 初始化SDK
        init() {
            if (this.isInitialized) return;
            
            this.injectCSS();
            this.createChatWindow();
            this.bindExistingButtons();
            this.connect();
            
            this.isInitialized = true;
            console.log('客服SDK初始化完成');
        }
        
        // 注入CSS样式
        injectCSS() {
            if (document.getElementById('customer-service-sdk-css')) return;
            
            const css = `
                .cs-sdk-chat-window {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
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
                    transform-origin: bottom right;
                    transition: transform 0.3s ease;
                }
                
                .cs-sdk-chat-window.open {
                    display: flex;
                    transform: scale(1);
                }
                
                .cs-sdk-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .cs-sdk-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .cs-sdk-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .cs-sdk-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    background: #f8f9fa;
                }
                
                .cs-sdk-message {
                    margin-bottom: 15px;
                    display: flex;
                    flex-direction: column;
                }
                
                .cs-sdk-message-text {
                    padding: 10px 15px;
                    border-radius: 18px;
                    max-width: 80%;
                    word-wrap: break-word;
                    line-height: 1.4;
                }
                
                .cs-sdk-message.user .cs-sdk-message-text {
                    background: #667eea;
                    color: white;
                    align-self: flex-end;
                }
                
                .cs-sdk-message.staff .cs-sdk-message-text {
                    background: white;
                    color: #333;
                    border: 1px solid #e1e5e9;
                    align-self: flex-start;
                }
                
                .cs-sdk-message.system .cs-sdk-message-text {
                    background: #f0f0f0;
                    color: #666;
                    align-self: center;
                    font-size: 13px;
                    text-align: center;
                }
                
                .cs-sdk-input-area {
                    padding: 15px 20px;
                    border-top: 1px solid #e1e5e9;
                    display: flex;
                    gap: 10px;
                }
                
                .cs-sdk-input {
                    flex: 1;
                    padding: 10px 15px;
                    border: 1px solid #ddd;
                    border-radius: 20px;
                    outline: none;
                    font-size: 14px;
                }
                
                .cs-sdk-send {
                    background: #667eea;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: 600;
                }
                
                .cs-sdk-send:hover {
                    background: #5a6fd8;
                }
                
                @media (max-width: 768px) {
                    .cs-sdk-chat-window {
                        width: calc(100vw - 20px);
                        height: calc(100vh - 40px);
                        bottom: 10px;
                        right: 10px;
                        left: 10px;
                    }
                }
            `;
            
            const styleElement = document.createElement('style');
            styleElement.id = 'customer-service-sdk-css';
            styleElement.textContent = css;
            document.head.appendChild(styleElement);
        }
        
        // 创建聊天窗口
        createChatWindow() {
            if (this.chatWindow) return;
            
            const chatWindow = document.createElement('div');
            chatWindow.className = 'cs-sdk-chat-window';
            chatWindow.innerHTML = `
                <div class="cs-sdk-header">
                    <h3>${this.config.ui.title}</h3>
                    <button class="cs-sdk-close">×</button>
                </div>
                <div class="cs-sdk-messages">
                    <div class="cs-sdk-message system">
                        <div class="cs-sdk-message-text">${this.config.welcomeMessage}</div>
                    </div>
                </div>
                <div class="cs-sdk-input-area">
                    <input type="text" class="cs-sdk-input" placeholder="${this.config.ui.placeholder}">
                    <button class="cs-sdk-send">${this.config.ui.sendButton}</button>
                </div>
            `;
            
            document.body.appendChild(chatWindow);
            this.chatWindow = chatWindow;
            
            // 绑定事件
            this.bindEvents();
        }
        
        // 绑定事件
        bindEvents() {
            const closeBtn = this.chatWindow.querySelector('.cs-sdk-close');
            const sendBtn = this.chatWindow.querySelector('.cs-sdk-send');
            const input = this.chatWindow.querySelector('.cs-sdk-input');
            
            closeBtn.addEventListener('click', () => this.close());
            sendBtn.addEventListener('click', () => this.sendMessage());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMessage();
            });
        }
        
        // 绑定现有的客服按钮
        bindExistingButtons() {
            // 查找常见的客服按钮
            const selectors = [
                '#cb',                    // 您朋友网站的客服按钮
                '.customer-service',
                '.kefu',
                '.service-btn',
                '[data-action="customer-service"]'
            ];
            
            selectors.forEach(selector => {
                const btn = document.querySelector(selector);
                if (btn) {
                    // 移除原有事件
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                    
                    // 添加新事件
                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.toggle();
                    });
                    
                    console.log(`已绑定客服按钮: ${selector}`);
                }
            });
        }
        
        // 连接到服务器
        connect() {
            if (this.socket) return;
            
            try {
                this.socket = new WebSocket(`${this.config.wsUrl}?userId=${this.userId}`);
                
                this.socket.onopen = () => {
                    console.log('客服连接已建立');
                };
                
                this.socket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                };
                
                this.socket.onclose = () => {
                    console.log('客服连接已断开');
                    this.socket = null;
                    // 3秒后重连
                    setTimeout(() => this.connect(), 3000);
                };
                
            } catch (error) {
                console.error('客服连接失败:', error);
            }
        }
        
        // 处理消息
        handleMessage(data) {
            if (data.type === 'staff_message') {
                this.addMessage('staff', data.message);
            } else if (data.type === 'system') {
                this.addMessage('system', data.message);
            }
        }
        
        // 添加消息
        addMessage(type, message) {
            const messagesContainer = this.chatWindow.querySelector('.cs-sdk-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `cs-sdk-message ${type}`;
            messageDiv.innerHTML = `<div class="cs-sdk-message-text">${message}</div>`;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        // 发送消息
        sendMessage() {
            const input = this.chatWindow.querySelector('.cs-sdk-input');
            const message = input.value.trim();
            
            if (!message) return;
            
            // 显示用户消息
            this.addMessage('user', message);
            input.value = '';
            
            // 发送到服务器
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    type: 'user_message',
                    message: message,
                    userId: this.userId,
                    timestamp: Date.now()
                }));
            }
        }
        
        // 打开聊天窗口
        open() {
            this.chatWindow.classList.add('open');
            this.isOpen = true;
            this.chatWindow.querySelector('.cs-sdk-input').focus();
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
            const css = document.getElementById('customer-service-sdk-css');
            if (css) {
                css.remove();
            }
        }
    }
    
    // 全局API
    window.SimpleCustomerService = SimpleCustomerServiceSDK;
    
    // 自动初始化（如果页面有配置）
    if (window.CUSTOMER_SERVICE_CONFIG) {
        window.customerService = new SimpleCustomerServiceSDK(window.CUSTOMER_SERVICE_CONFIG);
    }
    
})(window, document);
