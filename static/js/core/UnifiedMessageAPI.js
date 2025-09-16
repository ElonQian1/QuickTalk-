/**
 * 统一消息API - Phase 7 架构重构
 * 替换所有重复的sendMessage实现，建立单一的消息处理接口
 */

class UnifiedMessageAPI {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.wsConnection = null;
        this.messageQueue = [];
        this.isConnected = false;
        
        console.log('🔄 [UnifiedMessageAPI] 统一消息API已初始化');
    }

    /**
     * 初始化WebSocket连接 - 统一所有页面的连接逻辑
     */
    async initializeWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('✅ [UnifiedMessageAPI] WebSocket连接成功');
                this.isConnected = true;
                this.processMessageQueue();
            };
            
            this.wsConnection.onmessage = (event) => {
                this.handleIncomingMessage(JSON.parse(event.data));
            };
            
            this.wsConnection.onclose = () => {
                console.log('❌ [UnifiedMessageAPI] WebSocket连接断开');
                this.isConnected = false;
                setTimeout(() => this.initializeWebSocket(), 3000);
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('❌ [UnifiedMessageAPI] WebSocket错误:', error);
            };
            
        } catch (error) {
            console.error('❌ [UnifiedMessageAPI] WebSocket初始化失败:', error);
        }
    }

    /**
     * 统一消息发送方法 - 替换所有sendMessage实现
     */
    async sendMessage(content, recipientId, shopId, messageType = 'text') {
        try {
            if (!content?.trim()) {
                throw new Error('消息内容不能为空');
            }

            const messageData = {
                type: 'message',
                content: content.trim(),
                recipientId,
                shopId,
                messageType,
                senderId: this.getCurrentUserId(),
                timestamp: Date.now(),
                sessionId: this.sessionId
            };

            // WebSocket发送
            if (this.isConnected && this.wsConnection) {
                this.wsConnection.send(JSON.stringify(messageData));
            } else {
                // 如果WebSocket未连接，加入队列
                this.messageQueue.push(messageData);
            }

            // HTTP API备用发送
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': this.sessionId
                },
                body: JSON.stringify(messageData)
            });

            const result = await response.json();
            
            if (result.success) {
                // 添加到本地UI
                this.addMessageToUI(messageData, 'sent');
                console.log('✅ [UnifiedMessageAPI] 消息发送成功');
                return result;
            } else {
                throw new Error(result.error || '消息发送失败');
            }

        } catch (error) {
            console.error('❌ [UnifiedMessageAPI] 消息发送失败:', error);
            this.showError(`发送失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 统一消息UI添加方法 - 替换所有addMessage实现
     */
    addMessageToUI(message, status = 'received') {
        const chatContainer = this.findChatContainer();
        if (!chatContainer) {
            console.warn('⚠️ [UnifiedMessageAPI] 未找到聊天容器');
            return;
        }

        const messageElement = this.createMessageElement(message, status);
        chatContainer.appendChild(messageElement);
        this.scrollToBottom(chatContainer);
        
        // 更新未读计数
        this.updateUnreadCount(message.shopId);
    }

    /**
     * 创建消息元素 - 统一的消息样式
     */
    createMessageElement(message, status) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${status === 'sent' ? 'sent' : 'received'}`;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        const senderName = message.senderName || (status === 'sent' ? '我' : '客服');
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="sender">${senderName}</span>
                <span class="timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;
        
        return messageDiv;
    }

    /**
     * 处理接收到的消息 - 统一处理逻辑
     */
    handleIncomingMessage(data) {
        try {
            console.log('📨 [UnifiedMessageAPI] 收到消息:', data);
            
            switch (data.type) {
                case 'message':
                    this.addMessageToUI(data, 'received');
                    this.showNotification(data);
                    break;
                case 'typing':
                    this.showTypingIndicator(data.senderId);
                    break;
                case 'user_online':
                    this.updateUserStatus(data.userId, 'online');
                    break;
                case 'user_offline':
                    this.updateUserStatus(data.userId, 'offline');
                    break;
                default:
                    console.log('🔄 [UnifiedMessageAPI] 未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('❌ [UnifiedMessageAPI] 处理消息失败:', error);
        }
    }

    /**
     * 查找聊天容器 - 适配所有页面
     */
    findChatContainer() {
        const selectors = [
            '#chat-messages',
            '.chat-messages',
            '#messages-container',
            '.messages-container',
            '#conversation-area',
            '.message-list'
        ];
        
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        
        return null;
    }

    /**
     * 显示通知
     */
    showNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`来自 ${message.senderName || '客服'} 的消息`, {
                body: message.content,
                icon: '/static/assets/images/notification-icon.png'
            });
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        // 查找错误显示容器
        const errorContainer = document.querySelector('.error-message, #error-container');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        } else {
            alert(message); // 备用方案
        }
    }

    /**
     * 滚动到底部
     */
    scrollToBottom(container) {
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * 更新未读计数
     */
    updateUnreadCount(shopId) {
        const countElement = document.querySelector(`[data-shop-id="${shopId}"] .unread-count`);
        if (countElement) {
            const currentCount = parseInt(countElement.textContent) || 0;
            countElement.textContent = currentCount + 1;
            countElement.style.display = 'inline';
        }
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 获取当前用户ID
     */
    getCurrentUserId() {
        return localStorage.getItem('userId') || 
               sessionStorage.getItem('userId') || 
               'anonymous_' + Date.now();
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 处理消息队列
     */
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (this.wsConnection && this.isConnected) {
                this.wsConnection.send(JSON.stringify(message));
            }
        }
    }

    /**
     * 显示打字指示器
     */
    showTypingIndicator(userId) {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.textContent = '对方正在输入...';
            indicator.style.display = 'block';
            
            // 3秒后隐藏
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * 更新用户状态
     */
    updateUserStatus(userId, status) {
        const statusElement = document.querySelector(`[data-user-id="${userId}"] .user-status`);
        if (statusElement) {
            statusElement.className = `user-status ${status}`;
            statusElement.textContent = status === 'online' ? '在线' : '离线';
        }
    }

    /**
     * 销毁连接
     */
    destroy() {
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        this.isConnected = false;
        this.messageQueue = [];
    }
}

// 创建全局实例
window.unifiedMessageAPI = new UnifiedMessageAPI();

// 兼容性函数 - 替换所有旧的sendMessage实现
window.sendMessage = function(content, recipientId, shopId) {
    return window.unifiedMessageAPI.sendMessage(content, recipientId, shopId);
};

// 页面加载完成后初始化WebSocket
document.addEventListener('DOMContentLoaded', () => {
    window.unifiedMessageAPI.initializeWebSocket();
});

console.log('🔄 [Phase 7] 统一消息API已加载 - 替换5套重复实现');

export default UnifiedMessageAPI;