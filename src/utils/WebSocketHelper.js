/**
 * WebSocket 辅助工具类
 * 统一处理 WebSocket 连接管理、认证和消息处理中的重复逻辑
 */
class WebSocketHelper {
    /**
     * WebSocket 消息类型常量
     */
    static MESSAGE_TYPES = {
        // 连接相关
        CONNECTION_ESTABLISHED: 'connection_established',
        CONNECTION_SUCCESS: 'connection_success',
        AUTH_SUCCESS: 'auth_success',
        
        // 消息相关
        MESSAGE_SENT: 'message_sent',
        NEW_MESSAGE: 'new_message',
        NEW_USER_MESSAGE: 'new_user_message',
        NEW_MULTIMEDIA_MESSAGE: 'new_multimedia_message',
        STAFF_MESSAGE: 'staff_message',
        MULTIMEDIA_MESSAGE_SENT: 'multimedia_message_sent',
        
        // 状态相关
        MESSAGE_READ: 'message_read',
        CONVERSATION_UPDATE: 'conversation_update',
        TYPING: 'typing',
        
        // 系统相关
        PING: 'ping',
        PONG: 'pong',
        ERROR: 'error'
    };

    /**
     * 标准化 WebSocket 认证过程
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} authData - 认证数据
     * @param {Object} options - 可选配置
     */
    static authenticate(ws, authData, options = {}) {
        const {
            userId,
            shopId = 'default_shop',
            shopKey = null,
            isCustomer = false
        } = authData;

        // 设置连接属性
        ws.userId = userId;
        ws.shopId = shopId;
        ws.authenticated = true;
        ws.isCustomer = isCustomer;
        
        if (shopKey) {
            ws.shopKey = shopKey;
        }

        console.log(`🔐 WebSocket认证成功: ${userId} @ ${shopId} ${isCustomer ? '(客户端)' : '(管理端)'}`);
        
        return {
            success: true,
            userId,
            shopId,
            isCustomer
        };
    }

    /**
     * 标准化发送 WebSocket 消息
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} messageData - 消息数据
     */
    static sendMessage(ws, messageData) {
        if (ws.readyState !== require('ws').OPEN) {
            console.warn('⚠️ WebSocket连接不可用，无法发送消息');
            return false;
        }

        try {
            const message = JSON.stringify({
                timestamp: Date.now(),
                ...messageData
            });
            ws.send(message);
            return true;
        } catch (error) {
            console.error('❌ 发送WebSocket消息失败:', error);
            return false;
        }
    }

    /**
     * 发送标准化错误消息
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {string} errorMessage - 错误消息
     * @param {string} errorCode - 错误代码（可选）
     */
    static sendError(ws, errorMessage, errorCode = null) {
        return this.sendMessage(ws, {
            type: this.MESSAGE_TYPES.ERROR,
            message: errorMessage,
            error: errorMessage,
            code: errorCode
        });
    }

    /**
     * 发送认证成功消息
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} authData - 认证数据
     */
    static sendAuthSuccess(ws, authData) {
        return this.sendMessage(ws, {
            type: this.MESSAGE_TYPES.AUTH_SUCCESS,
            message: 'WebSocket认证成功',
            userId: authData.userId,
            shopId: authData.shopId
        });
    }

    /**
     * 发送连接建立确认消息
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} connectionData - 连接数据
     */
    static sendConnectionEstablished(ws, connectionData = {}) {
        return this.sendMessage(ws, {
            type: this.MESSAGE_TYPES.CONNECTION_ESTABLISHED,
            message: 'WebSocket连接已建立',
            ...connectionData
        });
    }

    /**
     * 发送消息发送成功确认
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} messageInfo - 消息信息
     */
    static sendMessageSent(ws, messageInfo = {}) {
        return this.sendMessage(ws, {
            type: this.MESSAGE_TYPES.MESSAGE_SENT,
            message: '消息发送成功',
            ...messageInfo
        });
    }

    /**
     * 发送多媒体消息发送成功确认
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} fileInfo - 文件信息
     */
    static sendMultimediaMessageSent(ws, fileInfo = {}) {
        return this.sendMessage(ws, {
            type: this.MESSAGE_TYPES.MULTIMEDIA_MESSAGE_SENT,
            message: '多媒体消息发送成功',
            fileInfo: fileInfo
        });
    }

    /**
     * 标准化消息数据结构
     * @param {Object} messageData - 原始消息数据
     * @returns {Object} 标准化后的消息数据
     */
    static standardizeMessageData(messageData) {
        const {
            conversationId,
            senderType,
            senderId,
            content,
            messageType = 'text',
            fileUrl = null,
            fileName = null,
            timestamp = new Date().toISOString()
        } = messageData;

        return {
            conversationId,
            senderType: senderType || 'customer',
            senderId,
            senderName: senderId, // 默认使用senderId作为senderName
            content,
            message: content, // 兼容字段
            messageType,
            file_url: fileUrl,
            file_name: fileName,
            timestamp,
            metadata: {
                timestamp,
                messageType
            }
        };
    }

    /**
     * 构建新用户消息通知数据
     * @param {Object} messageData - 消息数据
     * @returns {Object} 通知数据
     */
    static buildNewUserMessageNotification(messageData) {
        const {
            shopId,
            userId,
            message,
            messageType = 'text',
            fileUrl = null,
            fileName = null,
            timestamp = Date.now()
        } = messageData;

        const notification = {
            type: this.MESSAGE_TYPES.NEW_USER_MESSAGE,
            shopId,
            userId,
            message,
            content: message,
            conversationId: `${shopId}_${userId}`,
            timestamp,
            sender: 'customer',
            senderType: 'customer'
        };

        // 如果是多媒体消息，添加文件信息
        if (fileUrl) {
            notification.file_url = fileUrl;
            notification.file_name = fileName;
            notification.message_type = messageType;
            notification.messageType = messageType;
        }

        return notification;
    }

    /**
     * 验证WebSocket消息格式
     * @param {string} messageString - 消息字符串
     * @returns {Object|null} 解析后的消息对象，如果格式错误返回null
     */
    static validateAndParseMessage(messageString) {
        try {
            const data = JSON.parse(messageString);
            
            // 基本格式验证
            if (!data.type) {
                console.warn('⚠️ WebSocket消息缺少type字段');
                return null;
            }

            return data;
        } catch (error) {
            console.error('❌ WebSocket消息解析失败:', error);
            return null;
        }
    }

    /**
     * 检查WebSocket连接是否有效
     * @param {WebSocket} ws - WebSocket 连接对象
     * @returns {boolean} 连接是否有效
     */
    static isConnectionValid(ws) {
        return ws && ws.readyState === require('ws').OPEN;
    }

    /**
     * 安全地关闭WebSocket连接
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {number} code - 关闭代码
     * @param {string} reason - 关闭原因
     */
    static safeClose(ws, code = 1000, reason = 'Normal closure') {
        if (this.isConnectionValid(ws)) {
            try {
                ws.close(code, reason);
            } catch (error) {
                console.error('❌ 关闭WebSocket连接失败:', error);
            }
        }
    }

    /**
     * 处理WebSocket连接错误
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     */
    static handleConnectionError(ws, error, context = {}) {
        console.error('❌ WebSocket连接错误:', {
            error: error.message,
            context,
            userId: ws.userId || 'unknown',
            shopId: ws.shopId || 'unknown',
            timestamp: new Date().toISOString()
        });

        // 尝试发送错误消息给客户端
        this.sendError(ws, '连接发生错误', 'CONNECTION_ERROR');
    }

    /**
     * 记录WebSocket活动日志
     * @param {string} action - 动作类型
     * @param {WebSocket} ws - WebSocket 连接对象
     * @param {Object} data - 额外数据
     */
    static logActivity(action, ws, data = {}) {
        console.log(`🔄 WebSocket活动: ${action}`, {
            userId: ws.userId || 'unknown',
            shopId: ws.shopId || 'unknown',
            authenticated: ws.authenticated || false,
            timestamp: new Date().toISOString(),
            ...data
        });
    }
}

module.exports = WebSocketHelper;