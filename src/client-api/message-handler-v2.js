/**
 * MessageHandler - 更新版消息处理器
 * 使用新的服务层架构，符合 Controllers → Services → Repositories → Database 模式
 * 替换直接的仓库访问，通过服务层处理业务逻辑
 */

const ErrorHandler = require('../utils/ErrorHandler');

class MessageHandler {
    constructor(services, legacyServices = {}) {
        // 新的服务层依赖
        this.messageService = services.messageService;
        this.conversationService = services.conversationService;
        this.shopService = services.shopService;
        this.notificationService = services.notificationService;
        this.autoReplyService = services.autoReplyService;
        
        // 保持向后兼容的依赖
        this.connectionHandler = legacyServices.connectionHandler;
        this.securityLogger = legacyServices.securityLogger;
        
        // 向后兼容：保持原有的仓库访问（逐步迁移）
        this.messageRepository = legacyServices.messageRepository;
        
        console.log('📝 MessageHandler 已更新到服务层架构');
    }

    /**
     * 处理发送消息请求
     * 使用新的消息服务而非直接访问仓库
     */
    async handleSendMessage(req, res) {
        try {
            const {
                userId,
                message,
                shopKey,
                apiKey, // 兼容旧版本
                timestamp,
                messageType = 'text',
                attachments = []
            } = req.body;

            // 验证必要参数
            const validationError = ErrorHandler.validateRequiredParams(req.body, ['userId', 'message']);
            if (validationError) {
                return ErrorHandler.sendError(res, validationError.code, validationError.message);
            }

            // 获取API密钥（兼容不同字段名）
            const finalApiKey = shopKey || apiKey || req.headers['x-shop-key'];
            
            if (!finalApiKey) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_API_KEY, '缺少API密钥');
            }

            // 店铺验证和获取
            let shop = req.shop;
            
            if (!shop) {
                try {
                    // 使用店铺服务进行验证
                    const authResult = await this.shopService.validateApiKey(finalApiKey);
                    if (!authResult.valid) {
                        return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_API_KEY, authResult.error);
                    }
                    shop = authResult.shop;
                } catch (error) {
                    // 回退到连接处理器验证（向后兼容）
                    if (this.connectionHandler?.authValidator) {
                        const authResult = await this.connectionHandler.authValidator.validateApiKey(finalApiKey);
                        if (!authResult.valid) {
                            return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_API_KEY, authResult.error);
                        }
                        shop = authResult.shop;
                    } else {
                        throw error;
                    }
                }
            }

            // 验证消息内容
            if (message.length > 5000) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.MESSAGE_TOO_LONG, '消息内容过长，最多5000字符');
            }

            // 创建或获取对话（使用对话服务）
            const conversation = await this.conversationService.createOrGetConversation({
                shopId: shop.id,
                userId,
                metadata: {
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent']
                }
            });

            // 发送消息（使用消息服务）
            const messageResult = await this.messageService.sendMessage({
                conversationId: conversation.id,
                senderId: userId,
                senderType: 'customer',
                content: message.trim(),
                messageType,
                metadata: {
                    attachments,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    timestamp: timestamp || new Date().toISOString()
                }
            });

            // 更新店铺统计（使用店铺服务）
            try {
                await this.shopService.recordUsageStats(shop.id, {
                    requests: 1,
                    messages: 1
                });
            } catch (statsError) {
                console.warn('更新店铺统计失败:', statsError);
                // 不影响消息发送流程
            }

            // 尝试自动回复（如果启用）
            if (this.autoReplyService) {
                try {
                    const autoReplyResult = await this.autoReplyService.processMessage({
                        messageId: messageResult.message.id,
                        conversationId: conversation.id,
                        content: message,
                        metadata: {
                            shopId: shop.id,
                            userId,
                            messageType
                        }
                    });

                    if (autoReplyResult.shouldReply) {
                        // 发送自动回复
                        await this.messageService.sendMessage({
                            conversationId: conversation.id,
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

            console.log(`📨 消息已发送: ${shop.name} - ${userId}: ${message.substring(0, 50)}...`);

            ErrorHandler.sendSuccess(res, {
                messageId: messageResult.message.id,
                conversationId: conversation.id,
                timestamp: new Date().toISOString(),
                status: 'sent'
            }, '消息发送成功');

        } catch (error) {
            console.error('发送消息失败:', error);
            
            // 安全日志记录
            if (this.securityLogger) {
                await this.securityLogger.logError(error, {
                    endpoint: '/api/send',
                    body: req.body,
                    ip: this.getClientIp(req)
                });
            }

            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '消息发送失败');
        }
    }

    /**
     * 处理获取消息请求
     * 使用新的消息服务获取消息历史
     */
    async handleGetMessages(req, res) {
        try {
            const { userId } = req.query;
            const lastId = parseInt(req.query.lastId) || 0;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_USER_ID',
                        message: '缺少用户ID'
                    }
                });
            }

            // 店铺认证和获取
            let shop = req.shop;
            
            if (!shop) {
                const apiKey = req.headers['x-shop-key'];
                if (apiKey) {
                    try {
                        // 使用店铺服务验证
                        const authResult = await this.shopService.validateApiKey(apiKey);
                        if (authResult.valid) {
                            shop = authResult.shop;
                        }
                    } catch (error) {
                        // 回退到连接处理器验证（向后兼容）
                        if (this.connectionHandler?.authValidator) {
                            const authResult = await this.connectionHandler.authValidator.validateApiKey(apiKey);
                            if (authResult.valid) {
                                shop = authResult.shop;
                            }
                        }
                    }
                }
            }

            if (!shop) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: '需要认证'
                    }
                });
            }

            // 获取或创建对话
            const conversation = await this.conversationService.createOrGetConversation({
                shopId: shop.id,
                userId
            });

            if (!conversation) {
                return res.json({
                    success: true,
                    data: {
                        messages: [],
                        conversationId: null,
                        hasMore: false
                    }
                });
            }

            // 获取新消息（使用消息服务）
            const messagesResult = await this.messageService.getConversationMessages({
                conversationId: conversation.id,
                afterId: lastId,
                limit
            });

            // 标记客服消息为已读
            if (messagesResult.messages.length > 0) {
                const staffMessageIds = messagesResult.messages
                    .filter(msg => msg.senderType === 'staff')
                    .map(msg => msg.id);
                
                if (staffMessageIds.length > 0) {
                    try {
                        await this.messageService.markMessagesAsRead({
                            conversationId: conversation.id,
                            userId: 'user',
                            messageIds: staffMessageIds
                        });
                    } catch (markReadError) {
                        console.warn('标记消息已读失败:', markReadError);
                        // 不影响消息获取流程
                    }
                }
            }

            // 格式化消息返回格式（兼容原有API）
            const formattedMessages = messagesResult.messages.map(msg => ({
                id: msg.id,
                type: msg.senderType === 'customer' ? 'user_message' : 'staff_message',
                message: msg.content,
                sender: {
                    type: msg.senderType,
                    id: msg.senderId,
                    name: msg.senderName || msg.senderId
                },
                timestamp: msg.createdAt,
                messageType: msg.messageType,
                attachments: msg.metadata?.attachments || [],
                metadata: msg.metadata
            }));

            res.json({
                success: true,
                data: {
                    messages: formattedMessages,
                    conversationId: conversation.id,
                    hasMore: messagesResult.hasMore,
                    totalCount: messagesResult.totalCount
                }
            });

        } catch (error) {
            console.error('获取消息失败:', error);
            
            if (this.securityLogger) {
                await this.securityLogger.logError(error, {
                    endpoint: '/api/messages',
                    query: req.query,
                    ip: this.getClientIp(req)
                });
            }

            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取消息失败'
                }
            });
        }
    }

    /**
     * 处理获取对话历史请求
     * 使用新的对话服务
     */
    async handleGetConversationHistory(req, res) {
        try {
            const { conversationId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100);

            if (!conversationId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_CONVERSATION_ID',
                        message: '缺少对话ID'
                    }
                });
            }

            // 使用消息服务获取对话历史
            const result = await this.messageService.getConversationMessages({
                conversationId,
                page,
                limit
            });

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('获取对话历史失败:', error);
            
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取对话历史失败'
                }
            });
        }
    }

    /**
     * 处理连接状态检查
     */
    async handleConnectionCheck(req, res) {
        try {
            const { userId, apiKey } = req.query;

            if (!userId || !apiKey) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数'
                    }
                });
            }

            // 使用店铺服务验证API密钥
            let authResult;
            try {
                authResult = await this.shopService.validateApiKey(apiKey);
            } catch (error) {
                // 回退到连接处理器验证
                if (this.connectionHandler?.authValidator) {
                    authResult = await this.connectionHandler.authValidator.validateApiKey(apiKey);
                } else {
                    throw error;
                }
            }

            if (!authResult.valid) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'INVALID_API_KEY',
                        message: authResult.error || '无效的API密钥'
                    }
                });
            }

            // 获取对话信息
            const conversation = await this.conversationService.createOrGetConversation({
                shopId: authResult.shop.id,
                userId
            });

            // 获取未读消息数量
            const unreadCount = await this.messageService.getUnreadMessageCount({
                conversationId: conversation.id,
                userId: 'user'
            });

            res.json({
                success: true,
                data: {
                    connected: true,
                    conversationId: conversation.id,
                    shopId: authResult.shop.id,
                    shopName: authResult.shop.name,
                    unreadCount: unreadCount.unreadCount,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('连接检查失败:', error);
            
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '连接检查失败'
                }
            });
        }
    }

    /**
     * 获取客户端IP地址
     * @private
     */
    getClientIp(req) {
        return req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }

    /**
     * 创建服务层兼容的MessageHandler工厂方法
     * @param {Object} services - 服务层对象
     * @param {Object} legacyServices - 兼容旧服务
     */
    static createWithServices(services, legacyServices = {}) {
        return new MessageHandler(services, legacyServices);
    }

    /**
     * 迁移辅助方法：逐步迁移现有实例到服务层
     * @param {MessageHandler} existingHandler - 现有处理器
     * @param {Object} services - 新服务层对象
     */
    static migrateToServices(existingHandler, services) {
        // 注入服务依赖
        existingHandler.messageService = services.messageService;
        existingHandler.conversationService = services.conversationService;
        existingHandler.shopService = services.shopService;
        existingHandler.notificationService = services.notificationService;
        existingHandler.autoReplyService = services.autoReplyService;
        
        console.log('✅ MessageHandler 已迁移到服务层架构');
        return existingHandler;
    }
}

module.exports = MessageHandler;