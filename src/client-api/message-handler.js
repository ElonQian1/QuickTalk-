/**
 * 客户端消息处理模块
 * 处理消息发送和接收
 */
class MessageHandler {
    constructor(messageRepository, connectionHandler, securityLogger) {
        this.messageRepository = messageRepository;
        this.connectionHandler = connectionHandler;
        this.securityLogger = securityLogger;
    }

    /**
     * 处理发送消息请求
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
            if (!userId || !message) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数: userId, message'
                    }
                });
            }

            // 获取API密钥（兼容不同字段名）
            const finalApiKey = shopKey || apiKey || req.headers['x-shop-key'];
            
            if (!finalApiKey) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'MISSING_API_KEY',
                        message: '缺少API密钥'
                    }
                });
            }

            // 如果请求已经通过认证中间件，使用已验证的店铺信息
            let shop = req.shop;
            
            // 如果没有通过中间件，手动验证
            if (!shop) {
                const authResult = await this.connectionHandler.authValidator.validateApiKey(finalApiKey);
                if (!authResult.valid) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: authResult.code,
                            message: authResult.error
                        }
                    });
                }
                shop = authResult.shop;
            }

            // 验证消息内容
            if (message.length > 5000) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MESSAGE_TOO_LONG',
                        message: '消息内容过长，最多5000字符'
                    }
                });
            }

            // 创建或获取对话
            const conversation = await this.messageRepository.createOrGetConversation(
                shop.id,
                userId,
                {
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent']
                }
            );

            // 添加消息
            const messageData = {
                conversationId: conversation.id,
                senderType: 'user',
                senderId: userId,
                senderName: userId,
                message: message.trim(),
                messageType,
                attachments,
                metadata: {
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    timestamp: timestamp || new Date().toISOString()
                }
            };

            const result = await this.messageRepository.addMessage(messageData);

            // 更新店铺使用统计
            await this.connectionHandler.shopRepository.recordUsageStats(shop.id, {
                requests: 1,
                messages: 1
            });

            console.log(`📨 消息已发送: ${shop.name} - ${userId}: ${message.substring(0, 50)}...`);

            res.json({
                success: true,
                data: {
                    messageId: result.id,
                    conversationId: conversation.id,
                    timestamp: new Date().toISOString(),
                    status: 'sent'
                },
                message: '消息发送成功'
            });

        } catch (error) {
            console.error('发送消息失败:', error);
            await this.securityLogger.logError(error, {
                endpoint: '/api/send',
                body: req.body,
                ip: this.getClientIp(req)
            });

            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '消息发送失败'
                }
            });
        }
    }

    /**
     * 处理获取消息请求
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

            // 如果请求已通过认证中间件，使用已验证的店铺信息
            let shop = req.shop;
            
            // 如果没有通过中间件，尝试从header获取并验证
            if (!shop) {
                const apiKey = req.headers['x-shop-key'];
                if (apiKey) {
                    const authResult = await this.connectionHandler.authValidator.validateApiKey(apiKey);
                    if (authResult.valid) {
                        shop = authResult.shop;
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

            // 获取用户的对话
            const conversation = await this.messageRepository.getConversationByUserId(shop.id, userId);
            
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

            // 获取新消息（在lastId之后的消息）
            const messages = await this.messageRepository.getNewMessages(conversation.id, lastId);

            // 标记客服发送的消息为已读
            if (messages.length > 0) {
                const staffMessageIds = messages
                    .filter(msg => msg.sender_type === 'staff')
                    .map(msg => msg.id);
                
                if (staffMessageIds.length > 0) {
                    await this.messageRepository.markMessagesAsRead(conversation.id, 'user', staffMessageIds);
                }
            }

            // 格式化消息返回格式
            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                type: msg.sender_type === 'user' ? 'user_message' : 'staff_message',
                message: msg.message,
                sender: {
                    type: msg.sender_type,
                    id: msg.sender_id,
                    name: msg.sender_name
                },
                timestamp: msg.created_at,
                messageType: msg.message_type,
                attachments: msg.attachments,
                metadata: msg.metadata
            }));

            res.json({
                success: true,
                data: {
                    messages: formattedMessages,
                    conversationId: conversation.id,
                    hasMore: messages.length === limit,
                    lastMessageId: messages.length > 0 ? Math.max(...messages.map(m => m.id)) : lastId
                }
            });

        } catch (error) {
            console.error('获取消息失败:', error);
            await this.securityLogger.logError(error, {
                endpoint: '/api/client/messages',
                query: req.query,
                ip: this.getClientIp(req)
            });

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
     * 处理消息历史请求
     */
    async handleGetMessageHistory(req, res) {
        try {
            const { userId } = req.params;
            const {
                limit = 50,
                offset = 0,
                beforeId,
                afterId
            } = req.query;

            if (!req.shop) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: '需要认证'
                    }
                });
            }

            // 获取对话
            const conversation = await this.messageRepository.getConversationByUserId(req.shop.id, userId);
            
            if (!conversation) {
                return res.json({
                    success: true,
                    data: {
                        messages: [],
                        hasMore: false
                    }
                });
            }

            // 获取消息历史
            const messages = await this.messageRepository.getMessages(conversation.id, {
                limit: Math.min(parseInt(limit), 100),
                offset: parseInt(offset),
                beforeId: beforeId ? parseInt(beforeId) : null,
                afterId: afterId ? parseInt(afterId) : null,
                orderBy: 'created_at',
                orderDirection: 'DESC'
            });

            // 格式化消息
            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                type: msg.sender_type === 'user' ? 'user_message' : 'staff_message',
                message: msg.message,
                sender: {
                    type: msg.sender_type,
                    id: msg.sender_id,
                    name: msg.sender_name
                },
                timestamp: msg.created_at,
                messageType: msg.message_type,
                attachments: msg.attachments,
                isRead: msg.is_read,
                readAt: msg.read_at
            }));

            res.json({
                success: true,
                data: {
                    messages: formattedMessages,
                    conversationId: conversation.id,
                    hasMore: messages.length === parseInt(limit),
                    totalMessages: await this.getTotalMessageCount(conversation.id)
                }
            });

        } catch (error) {
            console.error('获取消息历史失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取消息历史失败'
                }
            });
        }
    }

    /**
     * 处理消息状态更新
     */
    async handleUpdateMessageStatus(req, res) {
        try {
            const { userId } = req.params;
            const { messageIds, status } = req.body;

            if (!req.shop) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: '需要认证'
                    }
                });
            }

            const conversation = await this.messageRepository.getConversationByUserId(req.shop.id, userId);
            
            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: {
                        code: 'CONVERSATION_NOT_FOUND',
                        message: '对话不存在'
                    }
                });
            }

            if (status === 'read') {
                await this.messageRepository.markMessagesAsRead(conversation.id, 'user', messageIds);
            }

            res.json({
                success: true,
                message: '消息状态更新成功'
            });

        } catch (error) {
            console.error('更新消息状态失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '更新消息状态失败'
                }
            });
        }
    }

    /**
     * 获取消息总数
     */
    async getTotalMessageCount(conversationId) {
        try {
            const result = await this.messageRepository.db.get(
                'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
                [conversationId]
            );
            return result ? result.count : 0;
        } catch (error) {
            console.error('获取消息总数失败:', error);
            return 0;
        }
    }

    /**
     * 获取客户端IP
     */
    getClientIp(req) {
        return req.ip ||
               req.connection?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }

    /**
     * 验证消息内容
     */
    validateMessageContent(message) {
        if (!message || typeof message !== 'string') {
            return { valid: false, error: '消息内容无效' };
        }

        if (message.trim().length === 0) {
            return { valid: false, error: '消息内容不能为空' };
        }

        if (message.length > 5000) {
            return { valid: false, error: '消息内容过长' };
        }

        return { valid: true };
    }

    /**
     * 过滤敏感内容
     */
    filterSensitiveContent(message) {
        // 简单的敏感词过滤，实际项目中可以使用专业的内容审核服务
        const sensitiveWords = ['fuck', '傻逼', '垃圾', '骗子'];
        let filteredMessage = message;

        sensitiveWords.forEach(word => {
            const regex = new RegExp(word, 'gi');
            filteredMessage = filteredMessage.replace(regex, '*'.repeat(word.length));
        });

        return filteredMessage;
    }
}

module.exports = MessageHandler;
