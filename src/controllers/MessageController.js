/**
 * MessageController - 消息控制器
 * 使用新的服务层架构
 * 演示 Controllers → Services → Repositories → Database 模式
 */

class MessageController {
    constructor(services) {
        // 注入服务依赖
        this.messageService = services.messageService;
        this.conversationService = services.conversationService;
        this.notificationService = services.notificationService;
        this.autoReplyService = services.autoReplyService;
        
        // 保持向后兼容的仓库访问
        this.messageRepository = services.repositories?.messageRepository;
        
        console.log('📝 MessageController 初始化完成');
    }

    /**
     * 发送消息
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async sendMessage(req, res) {
        try {
            const {
                conversationId,
                senderId,
                senderType,
                content,
                messageType = 'text',
                metadata = {}
            } = req.body;

            // 验证必需参数
            if (!conversationId || !senderId || !content) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: conversationId, senderId, content'
                });
            }

            // 使用消息服务发送消息
            const result = await this.messageService.sendMessage({
                conversationId,
                senderId,
                senderType,
                content,
                messageType,
                metadata
            });

            // 如果是客户消息，尝试自动回复
            if (senderType === 'customer' && this.autoReplyService) {
                try {
                    const autoReplyResult = await this.autoReplyService.processMessage({
                        messageId: result.message.id,
                        conversationId,
                        content,
                        metadata
                    });

                    if (autoReplyResult.shouldReply) {
                        // 发送自动回复
                        await this.messageService.sendMessage({
                            conversationId,
                            senderId: 'system',
                            senderType: 'assistant',
                            content: autoReplyResult.replyContent,
                            messageType: 'text',
                            metadata: {
                                isAutoReply: true,
                                confidence: autoReplyResult.confidence,
                                intent: autoReplyResult.intent
                            }
                        });
                    }
                } catch (autoReplyError) {
                    console.warn('自动回复处理失败:', autoReplyError);
                    // 不影响原消息发送
                }
            }

            res.json({
                success: true,
                message: result.message,
                conversation: result.conversation
            });

        } catch (error) {
            console.error('发送消息失败:', error);
            res.status(500).json({
                success: false,
                error: '发送消息失败',
                details: error.message
            });
        }
    }

    /**
     * 获取对话消息
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getConversationMessages(req, res) {
        try {
            const { conversationId } = req.params;
            const {
                page = 1,
                limit = 50,
                beforeTimestamp,
                afterTimestamp,
                messageType
            } = req.query;

            if (!conversationId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少对话ID'
                });
            }

            // 使用消息服务获取消息
            const result = await this.messageService.getConversationMessages({
                conversationId,
                page: parseInt(page),
                limit: parseInt(limit),
                beforeTimestamp: beforeTimestamp ? new Date(beforeTimestamp) : undefined,
                afterTimestamp: afterTimestamp ? new Date(afterTimestamp) : undefined,
                messageType
            });

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('获取对话消息失败:', error);
            res.status(500).json({
                success: false,
                error: '获取消息失败',
                details: error.message
            });
        }
    }

    /**
     * 标记消息为已读
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async markMessagesAsRead(req, res) {
        try {
            const { conversationId } = req.params;
            const { userId, messageIds } = req.body;

            if (!conversationId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: conversationId, userId'
                });
            }

            // 使用消息服务标记已读
            const result = await this.messageService.markMessagesAsRead({
                conversationId,
                userId,
                messageIds
            });

            res.json({
                success: true,
                markedCount: result.markedCount,
                unreadCount: result.unreadCount
            });

        } catch (error) {
            console.error('标记消息已读失败:', error);
            res.status(500).json({
                success: false,
                error: '标记消息已读失败',
                details: error.message
            });
        }
    }

    /**
     * 搜索消息
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async searchMessages(req, res) {
        try {
            const {
                query,
                shopId,
                conversationId,
                dateFrom,
                dateTo,
                messageType,
                senderType,
                page = 1,
                limit = 20
            } = req.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: '缺少搜索关键词'
                });
            }

            // 使用消息服务搜索
            const result = await this.messageService.searchMessages({
                query,
                shopId,
                conversationId,
                dateFrom: dateFrom ? new Date(dateFrom) : undefined,
                dateTo: dateTo ? new Date(dateTo) : undefined,
                messageType,
                senderType,
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                ...result
            });

        } catch (error) {
            console.error('搜索消息失败:', error);
            res.status(500).json({
                success: false,
                error: '搜索消息失败',
                details: error.message
            });
        }
    }

    /**
     * 获取消息统计
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getMessageStats(req, res) {
        try {
            const { shopId, period = '24h' } = req.query;

            if (!shopId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少店铺ID'
                });
            }

            // 使用消息服务获取统计
            const stats = await this.messageService.getMessageStatistics({
                shopId,
                period
            });

            res.json({
                success: true,
                stats
            });

        } catch (error) {
            console.error('获取消息统计失败:', error);
            res.status(500).json({
                success: false,
                error: '获取统计失败',
                details: error.message
            });
        }
    }

    /**
     * 删除消息
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async deleteMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { userId, userRole } = req.body;

            if (!messageId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: messageId, userId'
                });
            }

            // 使用消息服务删除消息
            const result = await this.messageService.deleteMessage({
                messageId,
                userId,
                userRole
            });

            res.json({
                success: true,
                message: '消息删除成功',
                deletedMessage: result.deletedMessage
            });

        } catch (error) {
            console.error('删除消息失败:', error);
            res.status(500).json({
                success: false,
                error: '删除消息失败',
                details: error.message
            });
        }
    }

    /**
     * 撤回消息
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async recallMessage(req, res) {
        try {
            const { messageId } = req.params;
            const { userId } = req.body;

            if (!messageId || !userId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必需参数: messageId, userId'
                });
            }

            // 使用消息服务撤回消息
            const result = await this.messageService.recallMessage({
                messageId,
                userId
            });

            res.json({
                success: true,
                message: '消息撤回成功',
                recalledMessage: result.recalledMessage
            });

        } catch (error) {
            console.error('撤回消息失败:', error);
            res.status(500).json({
                success: false,
                error: '撤回消息失败',
                details: error.message
            });
        }
    }

    /**
     * 获取未读消息数量
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getUnreadCount(req, res) {
        try {
            const { userId, shopId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: '缺少用户ID'
                });
            }

            // 使用消息服务获取未读数量
            const result = await this.messageService.getUnreadMessageCount({
                userId,
                shopId
            });

            res.json({
                success: true,
                unreadCount: result.unreadCount,
                conversationCounts: result.conversationCounts
            });

        } catch (error) {
            console.error('获取未读消息数量失败:', error);
            res.status(500).json({
                success: false,
                error: '获取未读数量失败',
                details: error.message
            });
        }
    }

    /**
     * 创建Express路由
     * @param {Express.Router} router - Express路由器
     */
    static createRoutes(router, controller) {
        // 消息相关路由
        router.post('/messages/send', (req, res) => controller.sendMessage(req, res));
        router.get('/messages/conversation/:conversationId', (req, res) => controller.getConversationMessages(req, res));
        router.put('/messages/conversation/:conversationId/read', (req, res) => controller.markMessagesAsRead(req, res));
        router.get('/messages/search', (req, res) => controller.searchMessages(req, res));
        router.get('/messages/stats', (req, res) => controller.getMessageStats(req, res));
        router.delete('/messages/:messageId', (req, res) => controller.deleteMessage(req, res));
        router.put('/messages/:messageId/recall', (req, res) => controller.recallMessage(req, res));
        router.get('/messages/unread', (req, res) => controller.getUnreadCount(req, res));

        console.log('✅ 消息控制器路由已注册');
    }
}

module.exports = MessageController;