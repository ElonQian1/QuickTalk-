/**
 * 统一消息管理器
 * 整合所有分散的消息处理方法，提供统一的消息处理接口
 * 解决addMessage、addMessageToChat、markMessagesAsRead等方法重复的问题
 */
class UnifiedMessageManager {
    constructor(config = {}) {
        this.config = {
            enableTimestamp: true,
            enableSound: false,
            maxMessages: 100,
            autoScroll: true,
            messageTimeout: 30000,
            ...config
        };
        
        this.messageQueue = [];
        this.messageCache = new Map();
        this.messageHandlers = new Map();
        
        // DOM元素缓存
        this.containers = new Map();
        
        // 注册默认消息处理器
        this.registerDefaultHandlers();
        
        console.log('📨 UnifiedMessageManager 已初始化');
    }

    /**
     * 注册消息容器
     * @param {string} containerId - 容器ID
     * @param {Element} container - DOM容器元素
     */
    registerContainer(containerId, container) {
        this.containers.set(containerId, container);
        console.log(`📨 注册消息容器: ${containerId}`);
    }

    /**
     * 统一的添加消息方法 - 替换所有addMessage实现
     * @param {string} containerId - 容器ID
     * @param {string} type - 消息类型 ('user', 'staff', 'system')
     * @param {string|Object} message - 消息内容
     * @param {Object} options - 选项
     */
    addMessage(containerId, type, message, options = {}) {
        const {
            staffName = null,
            timestamp = new Date(),
            messageId = this.generateMessageId(),
            avatar = null,
            metadata = {}
        } = options;

        const messageData = {
            id: messageId,
            type,
            content: typeof message === 'string' ? message : message.content || message.text,
            timestamp,
            staffName,
            avatar,
            metadata,
            containerId
        };

        // 添加到缓存
        this.messageCache.set(messageId, messageData);
        
        // 处理消息显示
        this.renderMessage(containerId, messageData);
        
        // 触发消息事件
        this.triggerMessageEvent('message_added', messageData);
        
        // 自动滚动
        if (this.config.autoScroll) {
            this.scrollToBottom(containerId);
        }
        
        return messageData;
    }

    /**
     * 统一的聊天消息添加方法 - 替换所有addMessageToChat实现
     * @param {string} containerId - 容器ID
     * @param {Object} message - 消息对象
     */
    addMessageToChat(containerId, message) {
        // 标准化消息格式
        const standardMessage = this.standardizeMessage(message);
        
        return this.addMessage(containerId, standardMessage.type, standardMessage.content, {
            staffName: standardMessage.staffName,
            timestamp: standardMessage.timestamp,
            messageId: standardMessage.id,
            metadata: standardMessage.metadata
        });
    }

    /**
     * 渲染消息到DOM
     * @param {string} containerId - 容器ID
     * @param {Object} messageData - 消息数据
     */
    renderMessage(containerId, messageData) {
        const container = this.containers.get(containerId);
        if (!container) {
            console.warn(`📨 消息容器未找到: ${containerId}`);
            return;
        }

        const messageElement = this.createMessageElement(messageData);
        container.appendChild(messageElement);
        
        // 限制消息数量
        this.limitMessages(container);
    }

    /**
     * 创建消息DOM元素
     * @param {Object} messageData - 消息数据
     * @returns {Element} 消息元素
     */
    createMessageElement(messageData) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.type}-message unified-message`;
        messageDiv.dataset.messageId = messageData.id;
        messageDiv.dataset.timestamp = messageData.timestamp.getTime();

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        // 消息文本
        const messageText = document.createElement('span');
        messageText.className = 'message-text';
        messageText.textContent = messageData.content;
        
        // 时间戳
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = this.formatTime(messageData.timestamp);

        // 组装消息元素
        messageContent.appendChild(messageText);
        
        // 添加发送者名字（如果是客服消息）
        if (messageData.type === 'staff' && messageData.staffName) {
            const staffName = document.createElement('span');
            staffName.className = 'staff-name';
            staffName.textContent = messageData.staffName;
            messageContent.insertBefore(staffName, messageText);
        }
        
        messageContent.appendChild(messageTime);
        messageDiv.appendChild(messageContent);

        return messageDiv;
    }

    /**
     * 标准化消息格式
     * @param {Object} message - 原始消息
     * @returns {Object} 标准化后的消息
     */
    standardizeMessage(message) {
        return {
            id: message.id || message.messageId || this.generateMessageId(),
            type: message.type || message.sender || 'user',
            content: message.content || message.message || message.text || '',
            timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
            staffName: message.staffName || message.senderName || null,
            metadata: message.metadata || {}
        };
    }

    /**
     * 标记消息为已读 - 替换所有markMessagesAsRead实现
     * @param {string} containerId - 容器ID
     * @param {string} userId - 用户ID
     * @param {string} conversationId - 对话ID
     */
    async markMessagesAsRead(containerId, userId, conversationId) {
        try {
            // 标记本地消息为已读
            const container = this.containers.get(containerId);
            if (container) {
                const unreadMessages = container.querySelectorAll('.message:not(.read)');
                unreadMessages.forEach(msg => {
                    msg.classList.add('read');
                });
            }

            // 发送已读状态到服务器
            await this.sendReadStatus(userId, conversationId);
            
            // 触发已读事件
            this.triggerMessageEvent('messages_read', {
                containerId,
                userId,
                conversationId,
                readAt: new Date()
            });

            console.log(`📨 消息已标记为已读: ${conversationId}`);
        } catch (error) {
            console.error('📨 标记消息已读失败:', error);
        }
    }

    /**
     * 发送已读状态到服务器
     * @param {string} userId - 用户ID
     * @param {string} conversationId - 对话ID
     */
    async sendReadStatus(userId, conversationId) {
        // 这里可以发送到不同的API端点
        const endpoints = [
            `/api/conversations/${conversationId}/read`,
            `/client-api/mark-read`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId,
                        conversationId,
                        readAt: new Date().toISOString()
                    })
                });

                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn(`📨 发送已读状态失败 (${endpoint}):`, error);
            }
        }
    }

    /**
     * 显示系统消息
     * @param {string} containerId - 容器ID
     * @param {string} message - 系统消息内容
     */
    showSystemMessage(containerId, message) {
        return this.addMessage(containerId, 'system', message, {
            timestamp: new Date()
        });
    }

    /**
     * 清空消息容器
     * @param {string} containerId - 容器ID
     */
    clearMessages(containerId) {
        const container = this.containers.get(containerId);
        if (container) {
            container.innerHTML = '';
        }
        
        // 清空相关缓存
        this.messageCache.forEach((message, id) => {
            if (message.containerId === containerId) {
                this.messageCache.delete(id);
            }
        });
    }

    /**
     * 滚动到底部
     * @param {string} containerId - 容器ID
     */
    scrollToBottom(containerId) {
        const container = this.containers.get(containerId);
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    /**
     * 限制消息数量
     * @param {Element} container - 消息容器
     */
    limitMessages(container) {
        const messages = container.querySelectorAll('.message');
        if (messages.length > this.config.maxMessages) {
            const excessCount = messages.length - this.config.maxMessages;
            for (let i = 0; i < excessCount; i++) {
                container.removeChild(messages[i]);
            }
        }
    }

    /**
     * 注册默认消息处理器
     */
    registerDefaultHandlers() {
        this.registerHandler('user_message', (data) => {
            this.addMessage(data.containerId, 'user', data.content, data.options);
        });

        this.registerHandler('staff_message', (data) => {
            this.addMessage(data.containerId, 'staff', data.content, {
                staffName: data.staffName,
                ...data.options
            });
        });

        this.registerHandler('system_message', (data) => {
            this.showSystemMessage(data.containerId, data.content);
        });
    }

    /**
     * 注册消息处理器
     * @param {string} type - 消息类型
     * @param {Function} handler - 处理器函数
     */
    registerHandler(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    /**
     * 处理消息
     * @param {string} type - 消息类型
     * @param {Object} data - 消息数据
     */
    handleMessage(type, data) {
        const handler = this.messageHandlers.get(type);
        if (handler) {
            handler(data);
        } else {
            console.warn(`📨 未找到消息处理器: ${type}`);
        }
    }

    /**
     * 触发消息事件
     * @param {string} eventType - 事件类型
     * @param {Object} data - 事件数据
     */
    triggerMessageEvent(eventType, data) {
        const event = new CustomEvent(`unified_message_${eventType}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    /**
     * 格式化时间
     * @param {Date} date - 日期对象
     * @returns {string} 格式化后的时间
     */
    formatTime(date) {
        if (!this.config.enableTimestamp) {
            return '';
        }
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    /**
     * 生成消息ID
     * @returns {string} 消息ID
     */
    generateMessageId() {
        return 'msg_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * 获取消息统计
     * @param {string} containerId - 容器ID
     * @returns {Object} 统计信息
     */
    getMessageStats(containerId) {
        const container = this.containers.get(containerId);
        if (!container) {
            return null;
        }

        const messages = container.querySelectorAll('.message');
        const userMessages = container.querySelectorAll('.user-message');
        const staffMessages = container.querySelectorAll('.staff-message');
        const systemMessages = container.querySelectorAll('.system-message');

        return {
            total: messages.length,
            user: userMessages.length,
            staff: staffMessages.length,
            system: systemMessages.length,
            containerId
        };
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.containers.clear();
        this.messageCache.clear();
        this.messageHandlers.clear();
        this.messageQueue = [];
        console.log('📨 UnifiedMessageManager 已销毁');
    }
}

// 全局实例
window.UnifiedMessageManager = UnifiedMessageManager;

// 创建默认实例
if (!window.messageManager) {
    window.messageManager = new UnifiedMessageManager();
}