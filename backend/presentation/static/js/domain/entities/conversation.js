/**
 * 对话实体
 * 封装对话的业务逻辑和不变式
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class Conversation {
    constructor(data = {}) {
        this.id = data.id || this._generateId();
        this.shopId = data.shopId || null;
        this.customerId = data.customerId || null;
        this.customerName = data.customerName || '匿名用户';
        this.status = data.status || window.APP_CONSTANTS.CONVERSATION_STATUS.OPEN;
        this.lastMessageTime = data.lastMessageTime || null;
        this.lastMessage = data.lastMessage || null;
        this.unreadCount = data.unreadCount || 0;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.messages = data.messages || [];
        
        // 事件存储
        this.events = [];
    }

    /**
     * 添加消息
     * @param {Message} message 消息对象
     */
    addMessage(message) {
        if (!message || !message.content?.trim()) {
            throw new Error('消息内容不能为空');
        }

        if (message.conversationId !== this.id) {
            throw new Error('消息所属对话ID不匹配');
        }

        this.messages.push(message);
        this.lastMessage = message.content;
        this.lastMessageTime = message.timestamp;
        this.updatedAt = new Date().toISOString();

        // 如果是客户消息，增加未读数
        if (message.senderType === window.APP_CONSTANTS.USER_ROLES.CUSTOMER) {
            this.unreadCount++;
        }

        // 记录领域事件
        this.events.push({
            type: window.APP_CONSTANTS.EVENTS.MESSAGE_RECEIVED,
            data: { conversationId: this.id, messageId: message.id },
            timestamp: new Date().toISOString()
        });

        window.log.debug('Conversation', `消息已添加到对话 ${this.id}`);
    }

    /**
     * 标记为已读
     */
    markAsRead() {
        if (this.unreadCount > 0) {
            const oldCount = this.unreadCount;
            this.unreadCount = 0;
            this.updatedAt = new Date().toISOString();

            // 记录领域事件
            this.events.push({
                type: window.APP_CONSTANTS.EVENTS.BADGE_CLEAR,
                data: { conversationId: this.id, clearedCount: oldCount },
                timestamp: new Date().toISOString()
            });

            window.log.debug('Conversation', `对话 ${this.id} 已标记为已读`);
        }
    }

    /**
     * 关闭对话
     */
    close() {
        if (this.status === window.APP_CONSTANTS.CONVERSATION_STATUS.CLOSED) {
            return; // 已经关闭
        }

        this.status = window.APP_CONSTANTS.CONVERSATION_STATUS.CLOSED;
        this.updatedAt = new Date().toISOString();

        // 记录领域事件
        this.events.push({
            type: 'conversation.closed',
            data: { conversationId: this.id },
            timestamp: new Date().toISOString()
        });

        window.log.info('Conversation', `对话 ${this.id} 已关闭`);
    }

    /**
     * 重新打开对话
     */
    reopen() {
        if (this.status === window.APP_CONSTANTS.CONVERSATION_STATUS.OPEN) {
            return; // 已经打开
        }

        this.status = window.APP_CONSTANTS.CONVERSATION_STATUS.OPEN;
        this.updatedAt = new Date().toISOString();

        // 记录领域事件
        this.events.push({
            type: 'conversation.reopened', 
            data: { conversationId: this.id },
            timestamp: new Date().toISOString()
        });

        window.log.info('Conversation', `对话 ${this.id} 已重新打开`);
    }

    /**
     * 获取最新的消息
     * @param {number} count 获取数量
     */
    getRecentMessages(count = 10) {
        return this.messages.slice(-count);
    }

    /**
     * 获取未读消息数量
     */
    getUnreadCount() {
        return this.unreadCount;
    }

    /**
     * 检查是否有新消息
     * @param {string} since 时间戳
     */
    hasNewMessagesSince(since) {
        return this.lastMessageTime && this.lastMessageTime > since;
    }

    /**
     * 获取并清理事件
     */
    pullEvents() {
        const events = [...this.events];
        this.events = [];
        return events;
    }

    /**
     * 转为纯数据对象
     */
    toData() {
        return {
            id: this.id,
            shopId: this.shopId,
            customerId: this.customerId,
            customerName: this.customerName,
            status: this.status,
            lastMessageTime: this.lastMessageTime,
            lastMessage: this.lastMessage,
            unreadCount: this.unreadCount,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            messageCount: this.messages.length
        };
    }

    /**
     * 从数据创建实例
     */
    static fromData(data) {
        return new Conversation(data);
    }

    /**
     * 生成ID
     * @private
     */
    _generateId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// 注册到模块系统
window.registerModule('Conversation', Conversation);

console.log('💬 对话实体已初始化');