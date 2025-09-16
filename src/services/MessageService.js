/**
 * MessageService - 消息业务逻辑服务
 * 负责消息处理的业务逻辑，不直接接触数据库
 */

class MessageService {
    constructor(messageRepository, conversationService, notificationService) {
        this.messageRepository = messageRepository;
        this.conversationService = conversationService;
        this.notificationService = notificationService;
    }

    /**
     * 发送消息
     * @param {Object} messageData - 消息数据
     * @param {string} messageData.content - 消息内容
     * @param {string} messageData.shopId - 店铺ID
     * @param {string} messageData.userId - 用户ID
     * @param {string} messageData.type - 消息类型
     * @param {string} messageData.sender - 发送者类型
     */
    async sendMessage(messageData) {
        try {
            // 1. 验证消息数据
            this.validateMessageData(messageData);

            // 2. 创建或获取对话
            const conversation = await this.conversationService.createOrGetConversation(
                messageData.shopId,
                messageData.userId
            );

            // 3. 准备消息数据
            const message = {
                conversationId: conversation.id,
                content: messageData.content,
                type: messageData.type || 'text',
                sender: messageData.sender,
                timestamp: new Date(),
                metadata: messageData.metadata || {}
            };

            // 4. 保存消息到数据库
            const savedMessage = await this.messageRepository.addMessage(message);

            // 5. 发送实时通知
            await this.notificationService.notifyNewMessage({
                ...savedMessage,
                shopId: messageData.shopId,
                userId: messageData.userId
            });

            // 6. 更新对话状态
            await this.conversationService.updateLastActivity(conversation.id);

            return {
                success: true,
                message: savedMessage,
                conversationId: conversation.id
            };

        } catch (error) {
            console.error('发送消息失败:', error);
            throw new Error(`发送消息失败: ${error.message}`);
        }
    }

    /**
     * 获取对话消息
     * @param {string} conversationId - 对话ID
     * @param {Object} options - 查询选项
     */
    async getConversationMessages(conversationId, options = {}) {
        try {
            // 1. 验证对话ID
            if (!conversationId) {
                throw new Error('对话ID不能为空');
            }

            // 2. 设置默认选项
            const queryOptions = {
                limit: options.limit || 50,
                offset: options.offset || 0,
                orderBy: options.orderBy || 'timestamp',
                order: options.order || 'ASC'
            };

            // 3. 从仓库获取消息
            const messages = await this.messageRepository.getConversationMessages(
                conversationId,
                queryOptions
            );

            // 4. 格式化消息数据
            const formattedMessages = messages.map(message => this.formatMessage(message));

            return {
                success: true,
                messages: formattedMessages,
                total: messages.length,
                hasMore: messages.length === queryOptions.limit
            };

        } catch (error) {
            console.error('获取对话消息失败:', error);
            throw new Error(`获取对话消息失败: ${error.message}`);
        }
    }

    /**
     * 标记消息为已读
     * @param {string} conversationId - 对话ID
     * @param {string} userType - 用户类型 (user/admin)
     * @param {Array} messageIds - 消息ID数组（可选）
     */
    async markMessagesAsRead(conversationId, userType, messageIds = null) {
        try {
            // 1. 验证参数
            if (!conversationId || !userType) {
                throw new Error('对话ID和用户类型不能为空');
            }

            // 2. 标记消息为已读
            const result = await this.messageRepository.markMessagesAsRead(
                conversationId,
                userType,
                messageIds
            );

            // 3. 通知已读状态更新
            await this.notificationService.notifyMessageRead({
                conversationId,
                userType,
                messageIds: messageIds || result.affectedMessageIds
            });

            return {
                success: true,
                affectedCount: result.affectedCount
            };

        } catch (error) {
            console.error('标记消息已读失败:', error);
            throw new Error(`标记消息已读失败: ${error.message}`);
        }
    }

    /**
     * 搜索消息
     * @param {Object} searchParams - 搜索参数
     */
    async searchMessages(searchParams) {
        try {
            const {
                keyword,
                shopId,
                userId,
                dateFrom,
                dateTo,
                messageType,
                limit = 50,
                offset = 0
            } = searchParams;

            // 1. 构建搜索条件
            const searchConditions = {
                keyword,
                shopId,
                userId,
                dateFrom,
                dateTo,
                messageType,
                limit,
                offset
            };

            // 2. 执行搜索
            const searchResults = await this.messageRepository.searchMessages(searchConditions);

            // 3. 格式化搜索结果
            const formattedResults = searchResults.map(result => ({
                ...this.formatMessage(result.message),
                highlights: result.highlights,
                conversationInfo: result.conversationInfo
            }));

            return {
                success: true,
                results: formattedResults,
                total: searchResults.length,
                hasMore: searchResults.length === limit
            };

        } catch (error) {
            console.error('搜索消息失败:', error);
            throw new Error(`搜索消息失败: ${error.message}`);
        }
    }

    /**
     * 获取消息统计
     * @param {string} shopId - 店铺ID
     * @param {Object} timeRange - 时间范围
     */
    async getMessageStats(shopId, timeRange = {}) {
        try {
            const stats = await this.messageRepository.getMessageStats(shopId, timeRange);

            return {
                success: true,
                stats: {
                    totalMessages: stats.totalCount,
                    userMessages: stats.userMessageCount,
                    adminMessages: stats.adminMessageCount,
                    activeConversations: stats.activeConversationCount,
                    averageResponseTime: stats.averageResponseTime,
                    peakHours: stats.peakHours
                }
            };

        } catch (error) {
            console.error('获取消息统计失败:', error);
            throw new Error(`获取消息统计失败: ${error.message}`);
        }
    }

    /**
     * 验证消息数据
     * @private
     */
    validateMessageData(messageData) {
        const required = ['content', 'shopId', 'userId', 'sender'];
        const missing = required.filter(field => !messageData[field]);
        
        if (missing.length > 0) {
            throw new Error(`缺少必需字段: ${missing.join(', ')}`);
        }

        if (messageData.content.trim().length === 0) {
            throw new Error('消息内容不能为空');
        }

        if (messageData.content.length > 10000) {
            throw new Error('消息内容过长，最多10000个字符');
        }

        if (!['user', 'admin', 'system'].includes(messageData.sender)) {
            throw new Error('无效的发送者类型');
        }
    }

    /**
     * 格式化消息数据
     * @private
     */
    formatMessage(message) {
        return {
            id: message.id,
            conversationId: message.conversationId,
            content: message.content,
            type: message.type,
            sender: message.sender,
            timestamp: message.timestamp,
            isRead: message.isRead,
            metadata: message.metadata || {},
            // 格式化时间显示
            timeFormatted: this.formatMessageTime(message.timestamp),
            // 添加消息状态
            status: this.getMessageStatus(message)
        };
    }

    /**
     * 格式化消息时间
     * @private
     */
    formatMessageTime(timestamp) {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffMs = now - messageTime;
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
            return messageTime.toLocaleDateString('zh-CN');
        }
    }

    /**
     * 获取消息状态
     * @private
     */
    getMessageStatus(message) {
        if (message.isRead) {
            return 'read';
        } else if (message.isDelivered) {
            return 'delivered';
        } else {
            return 'sent';
        }
    }
}

module.exports = MessageService;