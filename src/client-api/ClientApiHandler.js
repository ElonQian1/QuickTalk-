// 客户端API处理器
class ClientApiHandler {
    constructor(securityManager, messageRepository) {
        this.security = securityManager;
        this.messageRepo = messageRepository;
        this.sessions = new Map(); // 简单的会话存储
    }

    /**
     * 安全连接API
     */
    async handleSecureConnect(req, res) {
        try {
            const { userId, shopKey, shopId, domain, timestamp, version } = req.body;
            const apiKey = req.headers['x-shop-key'] || shopKey;
            const requestShopId = req.headers['x-shop-id'] || shopId;

            console.log(`🔒 安全连接请求: userId=${userId}, shopId=${requestShopId}, domain=${domain}`);

            // 验证必要参数
            if (!userId || !apiKey || !requestShopId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数: userId, shopKey, shopId'
                    }
                });
            }

            // 验证API密钥和域名
            const validation = await this.security.validateApiKeyAndDomain(apiKey, domain, requestShopId);
            
            if (!validation.valid) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: validation.code,
                        message: validation.message
                    }
                });
            }

            // 创建会话
            const sessionId = this.generateSessionId();
            this.sessions.set(sessionId, {
                userId,
                shopId: validation.shop.id,
                shopName: validation.shop.name,
                domain,
                connectedAt: new Date(),
                type: 'secure'
            });

            console.log(`✅ 安全连接建立成功: ${sessionId}`);

            res.json({
                success: true,
                data: {
                    sessionId,
                    connected: true,
                    shop: {
                        id: validation.shop.id,
                        name: validation.shop.name
                    },
                    type: 'secure'
                },
                message: '安全连接建立成功'
            });

        } catch (error) {
            console.error('❌ 安全连接处理失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '服务器内部错误'
                }
            });
        }
    }

    /**
     * 基础连接API
     */
    async handleBasicConnect(req, res) {
        try {
            const { userId, timestamp } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数: userId'
                    }
                });
            }

            // 创建基础会话
            const sessionId = this.generateSessionId();
            this.sessions.set(sessionId, {
                userId,
                connectedAt: new Date(),
                type: 'basic'
            });

            console.log(`✅ 基础连接建立成功: ${sessionId}`);

            res.json({
                success: true,
                data: {
                    sessionId,
                    connected: true,
                    type: 'basic'
                },
                message: '基础连接建立成功'
            });

        } catch (error) {
            console.error('❌ 基础连接处理失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '服务器内部错误'
                }
            });
        }
    }

    /**
     * 发送消息API
     */
    async handleSendMessage(req, res) {
        try {
            const { userId, user_id, message, shopKey, api_key, timestamp } = req.body;
            const actualUserId = userId || user_id; // 支持两种参数格式
            const apiKey = req.headers['x-shop-key'] || shopKey || api_key;
            const shopId = req.headers['x-shop-id'];

            console.log(`📤 发送消息请求: userId=${actualUserId}, shopId=${shopId}, message=${message?.substring(0, 50)}...`);

            // 验证必要参数
            if (!actualUserId || !message) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数: userId/user_id, message'
                    }
                });
            }

            let validation = null;

            // 如果有API密钥，进行安全验证
            if (apiKey && req.body.domain) {
                validation = await this.security.validateApiKeyAndDomain(apiKey, req.body.domain, shopId);
                
                if (!validation.valid) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: validation.code,
                            message: validation.message
                        }
                    });
                }
            } else if (apiKey) {
                // 如果有API密钥但没有domain，尝试从headers获取host
                const host = req.get('host') || req.get('origin') || 'localhost';
                validation = await this.security.validateApiKeyAndDomain(apiKey, host, shopId);
                
                if (!validation.valid) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: validation.code,
                            message: validation.message
                        }
                    });
                }
            }

            // 如果没有验证通过，返回错误（不允许guest模式）
            if (!validation || !validation.valid) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTHENTICATION_REQUIRED',
                        message: '需要有效的API密钥和域名验证'
                    }
                });
            }

            // 保存消息到数据库（如果有消息仓库的话）
            if (this.messageRepo) {
                try {
                    // 现在validation已经保证不为null
                    const conversationId = `${validation.shop.id}_${actualUserId}`;
                    
                    await this.messageRepo.addMessage({
                        conversationId,
                        senderType: 'customer', // 客户发送的消息
                        senderId: actualUserId,
                        senderName: null, // 可以后续从用户信息获取
                        content: message,
                        messageType: 'text'
                    });
                } catch (dbError) {
                    console.error('❌ 保存消息到数据库失败:', dbError);
                    // 不阻塞API响应，只记录错误
                }
            }

            console.log(`✅ 消息发送成功: userId=${actualUserId}`);

            res.json({
                success: true,
                data: {
                    messageId: 'msg_' + Date.now(),
                    timestamp: new Date(),
                    conversationId: `${validation.shop.id}_${actualUserId}`
                },
                message: '消息发送成功'
            });

        } catch (error) {
            console.error('❌ 发送消息处理失败:', error);
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
     * 获取消息API
     */
    async handleGetMessages(req, res) {
        try {
            const { userId, lastId = 0 } = req.query;
            const apiKey = req.headers['x-shop-key'];
            const shopId = req.headers['x-shop-id'];

            console.log(`📥 获取消息请求: userId=${userId}, lastId=${lastId}, shopId=${shopId}`);

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: '缺少必要参数: userId'
                    }
                });
            }

            let messages = [];
            let conversationId = null;

            // 如果有认证信息，验证并获取消息
            if (apiKey && shopId) {
                const validation = await this.security.validateApiKeyAndDomain(apiKey, req.get('host'), shopId);
                
                if (!validation.valid) {
                    return res.status(401).json({
                        success: false,
                        error: {
                            code: 'AUTHENTICATION_REQUIRED',
                            message: '需要认证'
                        }
                    });
                }

                conversationId = `${validation.shop.id}_${userId}`;

                // 从数据库获取消息（如果有消息仓库的话）
                if (this.messageRepo) {
                    try {
                        // 获取所有消息，然后根据lastId进行过滤
                        const rawMessages = await this.messageRepo.getConversationMessages(conversationId, {
                            limit: 100,
                            offset: 0,
                            orderBy: 'created_at',
                            orderDirection: 'ASC'
                        });
                        
                        console.log(`🔍 解析conversationId: ${conversationId} -> shopId: ${validation.shop.id}, userId: ${userId}`);
                        console.log(`✅ 获取到 ${rawMessages.length} 条消息`);
                        
                        // 转换消息格式为前端期望的格式，并添加序号
                        let allMessages = rawMessages.map((msg, index) => {
                            const baseMsg = {
                                id: msg.id,
                                sequenceId: index + 1, // 添加可比较的序号
                                message: msg.content,
                                timestamp: msg.created_at,
                                raw_sender: msg.sender_type
                            };
                            
                            if (msg.sender_type === 'admin') {
                                return {
                                    ...baseMsg,
                                    type: 'staff_message',
                                    sender: 'staff'
                                };
                            } else {
                                return {
                                    ...baseMsg,
                                    type: 'user_message',
                                    sender: 'user'
                                };
                            }
                        });
                        
                        // 根据lastId过滤新消息
                        const lastSeqId = parseInt(lastId) || 0;
                        const newMessages = allMessages.filter(msg => msg.sequenceId > lastSeqId);
                        
                        // 只返回客服消息给客户端
                        messages = newMessages.filter(msg => msg.sender === 'staff');
                        
                        console.log(`🔍 转换后的消息格式:`, messages.length > 0 ? messages[0] : '无消息');
                        
                    } catch (dbError) {
                        console.error('❌ 从数据库获取消息失败:', dbError);
                        // 返回空消息数组，不阻塞API
                    }
                }
            }

            console.log(`✅ 消息获取成功: ${messages.length} 条消息`);

            res.json({
                success: true,
                data: {
                    messages,
                    conversationId,
                    hasMore: false,
                    maxSequenceId: messages.length > 0 ? Math.max(...messages.map(m => m.sequenceId)) : lastId
                }
            });

        } catch (error) {
            console.error('❌ 获取消息处理失败:', error);
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
     * 健康检查API
     */
    async handleHealthCheck(req, res) {
        const connections = this.getConnectionStats();
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            data: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                connections,
                version: '1.0.0'
            }
        });
    }

    /**
     * 连接统计API
     */
    async handleConnectionStats(req, res) {
        const stats = this.getConnectionStats();
        
        res.json({
            success: true,
            data: stats
        });
    }

    /**
     * 生成会话ID
     */
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * 获取连接统计
     */
    getConnectionStats() {
        const totalConnections = this.sessions.size;
        const shopConnections = {};
        
        for (const [sessionId, session] of this.sessions) {
            if (session.shopId) {
                shopConnections[session.shopId] = (shopConnections[session.shopId] || 0) + 1;
            }
        }

        return {
            totalConnections,
            shopConnections,
            uptime: process.uptime()
        };
    }

    /**
     * 清理过期会话
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expireTime = 30 * 60 * 1000; // 30分钟

        for (const [sessionId, session] of this.sessions) {
            if (now - session.connectedAt > expireTime) {
                this.sessions.delete(sessionId);
                console.log(`🧹 清理过期会话: ${sessionId}`);
            }
        }
    }
}

module.exports = ClientApiHandler;
