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
                console.log('收到客服消息:', data);
                
                // 处理不同类型的消息
                if (data.messageType === 'image' && data.fileId) {
                    // 图片消息
                    console.log('处理图片消息，fileId:', data.fileId);
                    this.addImageMessage('staff', data, data.staffName);
                } else {
                    // 文本消息 - 优先使用content，然后是message，最后是默认文本
                    const messageContent = data.content || data.message || data.text || '[消息]';
                    console.log('处理文本消息，内容:', messageContent);
                    this.addMessage('staff', messageContent, data.staffName);
                }
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

    addImageMessage(type, messageData, staffName = null) {
        console.log('添加图片消息:', { type, messageData, staffName });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        // 如果有文本内容，先显示文本
        if (messageData.content && messageData.content !== '[图片]') {
            const textDiv = document.createElement('div');
            textDiv.className = 'message-text';
            textDiv.textContent = messageData.content;
            textDiv.style.marginBottom = '8px';
            messageDiv.appendChild(textDiv);
        }
        
        // 创建图片元素
        const imageContainer = document.createElement('div');
        imageContainer.className = 'message-image-container';
        
        const image = document.createElement('img');
        image.className = 'message-image';
        image.style.maxWidth = '200px';
        image.style.maxHeight = '200px';
        image.style.borderRadius = '8px';
        image.style.cursor = 'pointer';
        image.style.border = '1px solid #e0e0e0';
        
        // 添加加载状态
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'image-loading';
        loadingDiv.textContent = '图片加载中...';
        loadingDiv.style.display = 'flex';
        loadingDiv.style.alignItems = 'center';
        loadingDiv.style.justifyContent = 'center';
        loadingDiv.style.width = '200px';
        loadingDiv.style.height = '100px';
        loadingDiv.style.border = '1px dashed #ccc';
        loadingDiv.style.borderRadius = '8px';
        loadingDiv.style.color = '#666';
        loadingDiv.style.fontSize = '14px';
        imageContainer.appendChild(loadingDiv);
        
        // 构建图片URL
        if (messageData.fileId) {
            console.log('开始获取图片URL，fileId:', messageData.fileId);
            this.getFileUrl(messageData.fileId).then(url => {
                console.log('获取到图片URL:', url);
                if (url) {
                    image.src = url;
                    image.alt = '图片消息';
                    image.onload = () => {
                        console.log('图片加载成功');
                        loadingDiv.style.display = 'none';
                        imageContainer.appendChild(image);
                    };
                    image.onerror = () => {
                        console.error('图片加载失败');
                        loadingDiv.textContent = '图片加载失败';
                        loadingDiv.style.color = '#ff6b6b';
                    };
                } else {
                    console.error('无法获取图片URL');
                    loadingDiv.textContent = '图片获取失败';
                    loadingDiv.style.color = '#ff6b6b';
                }
            }).catch(error => {
                console.error('获取图片URL异常:', error);
                loadingDiv.textContent = '图片加载异常';
                loadingDiv.style.color = '#ff6b6b';
            });
        } else {
            console.error('消息缺少fileId');
            loadingDiv.textContent = '图片信息缺失';
            loadingDiv.style.color = '#ff6b6b';
        }
        
        // 点击放大图片
        image.onclick = () => {
            if (image.src && !image.src.startsWith('data:')) {
                window.open(image.src, '_blank');
            }
        };
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(imageContainer);
        messageDiv.appendChild(messageTime);
        
        if (type === 'staff' && staffName) {
            const staffLabel = document.createElement('span');
            staffLabel.className = 'staff-name';
            staffLabel.textContent = `客服 ${staffName}`;
            staffLabel.style.fontSize = '12px';
            staffLabel.style.color = '#666';
            staffLabel.style.marginBottom = '5px';
            messageDiv.insertBefore(staffLabel, messageDiv.firstChild);
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    async getFileUrl(fileId) {
        try {
            // 调用API获取文件信息
            const response = await fetch(`/api/files/${fileId}?info=true`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.file) {
                    return result.file.url;
                }
            }
        } catch (error) {
            console.error('获取文件URL失败:', error);
        }
        return null;
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
