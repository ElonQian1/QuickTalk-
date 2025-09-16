/**
 * ConversationService - 对话业务逻辑服务
 * 负责对话管理的业务逻辑
 */

class ConversationService {
    constructor(messageRepository, shopRepository, notificationService) {
        this.messageRepository = messageRepository;
        this.shopRepository = shopRepository;
        this.notificationService = notificationService;
    }

    /**
     * 创建或获取对话
     * @param {string} shopId - 店铺ID
     * @param {string} userId - 用户ID
     * @param {Object} userData - 用户数据（可选）
     */
    async createOrGetConversation(shopId, userId, userData = {}) {
        try {
            // 1. 验证店铺是否存在
            const shop = await this.shopRepository.getShopById(shopId);
            if (!shop) {
                throw new Error('店铺不存在');
            }

            // 2. 创建或获取对话
            const conversation = await this.messageRepository.createOrGetConversation(
                shopId,
                userId,
                userData
            );

            // 3. 如果是新对话，发送通知
            if (conversation.isNew) {
                await this.notificationService.notifyNewConversation({
                    conversationId: conversation.id,
                    shopId,
                    userId,
                    userData
                });
            }

            return conversation;

        } catch (error) {
            console.error('创建或获取对话失败:', error);
            throw new Error(`创建或获取对话失败: ${error.message}`);
        }
    }

    /**
     * 获取店铺对话列表
     * @param {string} shopId - 店铺ID
     * @param {Object} options - 查询选项
     */
    async getShopConversations(shopId, options = {}) {
        try {
            // 1. 验证店铺
            if (!shopId) {
                throw new Error('店铺ID不能为空');
            }

            // 2. 设置查询选项
            const queryOptions = {
                limit: options.limit || 20,
                offset: options.offset || 0,
                includeLastMessage: true,
                includeUnreadCount: true,
                status: options.status || 'all', // all, active, closed
                sortBy: options.sortBy || 'lastActivity',
                sortOrder: options.sortOrder || 'DESC'
            };

            // 3. 获取对话列表
            const conversations = await this.messageRepository.getShopConversations(
                shopId,
                queryOptions
            );

            // 4. 格式化对话数据
            const formattedConversations = conversations.map(conv => this.formatConversation(conv));

            return {
                success: true,
                conversations: formattedConversations,
                total: conversations.length,
                hasMore: conversations.length === queryOptions.limit
            };

        } catch (error) {
            console.error('获取店铺对话列表失败:', error);
            throw new Error(`获取店铺对话列表失败: ${error.message}`);
        }
    }

    /**
     * 获取对话详情
     * @param {string} conversationId - 对话ID
     */
    async getConversationDetails(conversationId) {
        try {
            if (!conversationId) {
                throw new Error('对话ID不能为空');
            }

            const conversation = await this.messageRepository.getConversationById(conversationId);
            if (!conversation) {
                throw new Error('对话不存在');
            }

            return {
                success: true,
                conversation: this.formatConversation(conversation)
            };

        } catch (error) {
            console.error('获取对话详情失败:', error);
            throw new Error(`获取对话详情失败: ${error.message}`);
        }
    }

    /**
     * 更新对话状态
     * @param {string} conversationId - 对话ID
     * @param {string} status - 新状态 (active, closed, archived)
     */
    async updateConversationStatus(conversationId, status) {
        try {
            const validStatuses = ['active', 'closed', 'archived'];
            if (!validStatuses.includes(status)) {
                throw new Error(`无效的对话状态: ${status}`);
            }

            const result = await this.messageRepository.updateConversationStatus(
                conversationId,
                status
            );

            // 发送状态更新通知
            await this.notificationService.notifyConversationStatusUpdate({
                conversationId,
                status,
                timestamp: new Date()
            });

            return {
                success: true,
                conversationId,
                status
            };

        } catch (error) {
            console.error('更新对话状态失败:', error);
            throw new Error(`更新对话状态失败: ${error.message}`);
        }
    }

    /**
     * 更新对话最后活动时间
     * @param {string} conversationId - 对话ID
     */
    async updateLastActivity(conversationId) {
        try {
            const timestamp = new Date();
            await this.messageRepository.updateConversationLastActivity(
                conversationId,
                timestamp
            );

            return {
                success: true,
                lastActivity: timestamp
            };

        } catch (error) {
            console.error('更新对话活动时间失败:', error);
            throw new Error(`更新对话活动时间失败: ${error.message}`);
        }
    }

    /**
     * 分配对话给客服
     * @param {string} conversationId - 对话ID
     * @param {string} assigneeId - 被分配客服的ID
     */
    async assignConversation(conversationId, assigneeId) {
        try {
            // 1. 验证客服是否存在（这里可能需要UserService的支持）
            // const assignee = await this.userService.getUserById(assigneeId);
            // if (!assignee || assignee.role !== 'staff') {
            //     throw new Error('指定的客服不存在或无权限');
            // }

            // 2. 更新对话分配
            const result = await this.messageRepository.assignConversation(
                conversationId,
                assigneeId
            );

            // 3. 发送分配通知
            await this.notificationService.notifyConversationAssigned({
                conversationId,
                assigneeId,
                timestamp: new Date()
            });

            return {
                success: true,
                conversationId,
                assigneeId
            };

        } catch (error) {
            console.error('分配对话失败:', error);
            throw new Error(`分配对话失败: ${error.message}`);
        }
    }

    /**
     * 获取对话统计
     * @param {string} shopId - 店铺ID
     * @param {Object} timeRange - 时间范围
     */
    async getConversationStats(shopId, timeRange = {}) {
        try {
            const stats = await this.messageRepository.getConversationStats(shopId, timeRange);

            return {
                success: true,
                stats: {
                    totalConversations: stats.totalCount,
                    activeConversations: stats.activeCount,
                    closedConversations: stats.closedCount,
                    averageMessagesPerConversation: stats.averageMessageCount,
                    averageConversationDuration: stats.averageDuration,
                    newConversationsToday: stats.newTodayCount,
                    responseRate: stats.responseRate,
                    customerSatisfaction: stats.satisfactionScore
                }
            };

        } catch (error) {
            console.error('获取对话统计失败:', error);
            throw new Error(`获取对话统计失败: ${error.message}`);
        }
    }

    /**
     * 搜索对话
     * @param {Object} searchParams - 搜索参数
     */
    async searchConversations(searchParams) {
        try {
            const {
                shopId,
                keyword,
                status,
                assigneeId,
                dateFrom,
                dateTo,
                limit = 20,
                offset = 0
            } = searchParams;

            const searchConditions = {
                shopId,
                keyword,
                status,
                assigneeId,
                dateFrom,
                dateTo,
                limit,
                offset
            };

            const searchResults = await this.messageRepository.searchConversations(searchConditions);

            const formattedResults = searchResults.map(conv => this.formatConversation(conv));

            return {
                success: true,
                conversations: formattedResults,
                total: searchResults.length,
                hasMore: searchResults.length === limit
            };

        } catch (error) {
            console.error('搜索对话失败:', error);
            throw new Error(`搜索对话失败: ${error.message}`);
        }
    }

    /**
     * 关闭过期的空闲对话
     * @param {number} maxIdleDays - 最大空闲天数，默认7天
     */
    async closeIdleConversations(maxIdleDays = 7) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxIdleDays);

            const result = await this.messageRepository.closeIdleConversations(cutoffDate);

            console.log(`已关闭 ${result.closedCount} 个空闲对话`);

            return {
                success: true,
                closedCount: result.closedCount,
                cutoffDate
            };

        } catch (error) {
            console.error('关闭空闲对话失败:', error);
            throw new Error(`关闭空闲对话失败: ${error.message}`);
        }
    }

    /**
     * 格式化对话数据
     * @private
     */
    formatConversation(conversation) {
        return {
            id: conversation.id,
            shopId: conversation.shopId,
            userId: conversation.userId,
            status: conversation.status,
            assigneeId: conversation.assigneeId,
            createdAt: conversation.createdAt,
            lastActivity: conversation.lastActivity,
            
            // 用户信息
            userInfo: {
                id: conversation.userId,
                name: conversation.userName || `用户${conversation.userId.slice(-4)}`,
                avatar: conversation.userAvatar,
                email: conversation.userEmail,
                metadata: conversation.userMetadata || {}
            },

            // 对话统计
            stats: {
                messageCount: conversation.messageCount || 0,
                unreadCount: conversation.unreadCount || 0,
                duration: this.calculateConversationDuration(
                    conversation.createdAt,
                    conversation.lastActivity
                )
            },

            // 最后一条消息
            lastMessage: conversation.lastMessage ? {
                id: conversation.lastMessage.id,
                content: conversation.lastMessage.content,
                type: conversation.lastMessage.type,
                sender: conversation.lastMessage.sender,
                timestamp: conversation.lastMessage.timestamp,
                timeFormatted: this.formatRelativeTime(conversation.lastMessage.timestamp)
            } : null,

            // 格式化的时间显示
            timeFormatted: {
                created: this.formatRelativeTime(conversation.createdAt),
                lastActivity: this.formatRelativeTime(conversation.lastActivity)
            }
        };
    }

    /**
     * 计算对话持续时间（分钟）
     * @private
     */
    calculateConversationDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        return Math.floor((end - start) / 60000); // 返回分钟数
    }

    /**
     * 格式化相对时间
     * @private
     */
    formatRelativeTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return '刚刚';
        } else if (diffMins < 60) {
            return `${diffMins}分钟前`;
        } else if (diffHours < 24) {
            return `${diffHours}小时前`;
        } else if (diffDays < 30) {
            return `${diffDays}天前`;
        } else {
            return time.toLocaleDateString('zh-CN');
        }
    }
}

module.exports = ConversationService;