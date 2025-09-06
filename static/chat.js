class CustomerServiceChat {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.isMinimized = false;
        this.userId = this.generateUserId();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;

        this.initializeElements();
        this.setupEventListeners();
        this.updateConnectionStatus('connecting', '连接中...');
        this.connectWebSocket();
    }

    initializeElements() {
        this.chatWindow = document.getElementById('chat-window');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.customerServiceBtn = document.getElementById('customer-service-btn');
        
        // 设置初始时间
        this.updateSystemMessageTime();
    }

    setupEventListeners() {
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // 窗口关闭时断开连接
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
            // 使用当前域名和端口，但切换到WebSocket协议
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket 连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected', '已连接');
                
                // 发送用户连接信息
                this.sendSystemMessage({
                    type: 'user_connect',
                    userId: this.userId,
                    timestamp: Date.now()
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('用户端收到消息:', data); // 添加调试信息
                    this.handleMessage(data);
                } catch (error) {
                    console.error('解析消息失败:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket 连接关闭:', event.code, event.reason);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', '连接断开');
                
                // 如果不是主动关闭，尝试重连
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket 错误:', error);
                this.updateConnectionStatus('disconnected', '连接错误');
            };

        } catch (error) {
            console.error('创建 WebSocket 连接失败:', error);
            this.updateConnectionStatus('disconnected', '连接失败');
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

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        if (!this.isConnected) {
            this.showSystemMessage('连接断开，无法发送消息');
            return;
        }

        // 显示用户消息
        this.addMessage('user', message);
        this.chatInput.value = '';

        // 发送到服务器
        this.sendSystemMessage({
            type: 'user_message',
            userId: this.userId,
            message: message,
            timestamp: Date.now()
        });
    }

    sendSystemMessage(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
        }
    }

    handleMessage(data) {
        console.log('用户端处理消息:', data.type, data); // 添加调试信息
        switch (data.type) {
            case 'staff_message':
                console.log('收到客服消息:', data.message);
                this.addMessage('staff', data.message, data.staffName);
                break;
            case 'system_notification':
                this.showSystemMessage(data.message);
                break;
            case 'staff_typing':
                this.showTypingIndicator(data.staffName);
                break;
            case 'staff_stop_typing':
                this.hideTypingIndicator();
                break;
            default:
                console.log('未知消息类型:', data);
        }
    }

    addMessage(type, message, staffName = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = message;
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(messageText);
        messageDiv.appendChild(messageTime);
        
        if (type === 'staff' && staffName) {
            const staffLabel = document.createElement('span');
            staffLabel.className = 'staff-name';
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
        messageDiv.className = 'message system-message';
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = message;
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(messageText);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator(staffName) {
        // 移除已存在的输入指示器
        this.hideTypingIndicator();
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.innerHTML = `客服 ${staffName} 正在输入<span class="typing-dots">...</span>`;
        messageText.style.fontStyle = 'italic';
        messageText.style.color = '#999';
        
        typingDiv.appendChild(messageText);
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateConnectionStatus(status, text) {
        this.statusIndicator.className = `status-${status}`;
        this.statusText.textContent = text;
    }

    formatTime(date) {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    updateSystemMessageTime() {
        const systemMessage = document.querySelector('.system-message .message-time');
        if (systemMessage) {
            systemMessage.textContent = this.formatTime(new Date());
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    toggleChat() {
        if (this.chatWindow.classList.contains('open')) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.chatWindow.classList.add('open');
        this.chatWindow.classList.remove('minimized');
        this.isMinimized = false;
        this.chatInput.focus();
        this.scrollToBottom();
    }

    closeChat() {
        this.chatWindow.classList.remove('open', 'minimized');
        this.isMinimized = false;
    }

    minimizeChat() {
        this.chatWindow.classList.add('minimized');
        this.isMinimized = true;
    }

    restoreChat() {
        this.chatWindow.classList.remove('minimized');
        this.isMinimized = false;
        this.chatInput.focus();
    }
}

// 全局函数供HTML调用
let chatInstance;

function toggleChat() {
    if (!chatInstance) {
        chatInstance = new CustomerServiceChat();
    }
    chatInstance.toggleChat();
}

function closeChat() {
    if (chatInstance) {
        chatInstance.closeChat();
    }
}

function minimizeChat() {
    if (chatInstance) {
        if (chatInstance.isMinimized) {
            chatInstance.restoreChat();
        } else {
            chatInstance.minimizeChat();
        }
    }
}

function sendMessage() {
    if (chatInstance) {
        chatInstance.sendMessage();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// 页面加载完成后自动初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('客服系统已准备就绪');
    
    // 可以在这里添加一些初始化代码
    // 比如检查是否有未读消息等
});
