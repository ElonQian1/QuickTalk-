/**
 * 消息实体
 * 封装消息的业务逻辑和验证
 * 
 * @author GitHub Copilot
 * @version 1.0
 * @date 2025-10-03
 */

class Message {
    constructor(data = {}) {
        this.id = data.id || this._generateId();
        this.conversationId = data.conversationId || null;
        this.senderType = data.senderType || window.APP_CONSTANTS.USER_ROLES.CUSTOMER;
        this.senderId = data.senderId || null;
        this.senderName = data.senderName || '匿名';
        this.content = data.content || '';
        this.type = data.type || window.APP_CONSTANTS.MESSAGE_TYPES.TEXT;
        this.metadata = data.metadata || {};
        this.timestamp = data.timestamp || new Date().toISOString();
        this.isRead = data.isRead || false;
        this.isDelivered = data.isDelivered || false;
        
        // 验证必填字段
        this._validate();
    }

    /**
     * 验证消息数据
     * @private
     */
    _validate() {
        if (!this.conversationId) {
            throw new Error('消息必须属于一个对话');
        }

        if (!this.content.trim()) {
            throw new Error('消息内容不能为空');
        }

        if (!Object.values(window.APP_CONSTANTS.USER_ROLES).includes(this.senderType)) {
            throw new Error('无效的发送者类型');
        }

        if (!Object.values(window.APP_CONSTANTS.MESSAGE_TYPES).includes(this.type)) {
            throw new Error('无效的消息类型');
        }

        // 内容长度检查
        if (this.content.length > 10000) {
            throw new Error('消息内容过长');
        }
    }

    /**
     * 标记为已读
     */
    markAsRead() {
        if (!this.isRead) {
            this.isRead = true;
            window.log.debug('Message', `消息 ${this.id} 已标记为已读`);
        }
    }

    /**
     * 标记为已送达
     */
    markAsDelivered() {
        if (!this.isDelivered) {
            this.isDelivered = true;
            window.log.debug('Message', `消息 ${this.id} 已标记为已送达`);
        }
    }

    /**
     * 检查是否为系统消息
     */
    isSystemMessage() {
        return this.type === window.APP_CONSTANTS.MESSAGE_TYPES.SYSTEM;
    }

    /**
     * 检查是否为媒体消息
     */
    isMediaMessage() {
        return this.type === window.APP_CONSTANTS.MESSAGE_TYPES.IMAGE || 
               this.type === window.APP_CONSTANTS.MESSAGE_TYPES.FILE;
    }

    /**
     * 检查是否为客户消息
     */
    isCustomerMessage() {
        return this.senderType === window.APP_CONSTANTS.USER_ROLES.CUSTOMER;
    }

    /**
     * 检查是否为客服消息
     */
    isAgentMessage() {
        return this.senderType === window.APP_CONSTANTS.USER_ROLES.AGENT;
    }

    /**
     * 获取显示时间
     */
    getDisplayTime() {
        const date = new Date(this.timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * 获取内容摘要
     * @param {number} maxLength 最大长度
     */
    getContentSummary(maxLength = 50) {
        if (this.type === window.APP_CONSTANTS.MESSAGE_TYPES.IMAGE) {
            return '[图片]';
        } else if (this.type === window.APP_CONSTANTS.MESSAGE_TYPES.FILE) {
            return '[文件]';
        } else if (this.type === window.APP_CONSTANTS.MESSAGE_TYPES.SYSTEM) {
            return '[系统消息]';
        }

        if (this.content.length <= maxLength) {
            return this.content;
        }

        return this.content.substring(0, maxLength) + '...';
    }

    /**
     * 添加元数据
     */
    addMetadata(key, value) {
        this.metadata[key] = value;
        window.log.debug('Message', `消息 ${this.id} 添加元数据: ${key}=${value}`);
    }

    /**
     * 获取元数据
     */
    getMetadata(key) {
        return this.metadata[key];
    }

    /**
     * 转为纯数据对象
     */
    toData() {
        return {
            id: this.id,
            conversationId: this.conversationId,
            senderType: this.senderType,
            senderId: this.senderId,
            senderName: this.senderName,
            content: this.content,
            type: this.type,
            metadata: { ...this.metadata },
            timestamp: this.timestamp,
            isRead: this.isRead,
            isDelivered: this.isDelivered
        };
    }

    /**
     * 从数据创建实例
     */
    static fromData(data) {
        return new Message(data);
    }

    /**
     * 创建系统消息
     */
    static createSystemMessage(conversationId, content) {
        return new Message({
            conversationId,
            senderType: window.APP_CONSTANTS.USER_ROLES.AGENT,
            senderName: '系统',
            content,
            type: window.APP_CONSTANTS.MESSAGE_TYPES.SYSTEM
        });
    }

    /**
     * 生成ID
     * @private
     */
    _generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// 注册到模块系统
window.registerModule('Message', Message);

console.log('💬 消息实体已初始化');