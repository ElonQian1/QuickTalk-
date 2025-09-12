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
            const { userId, message, shopKey, timestamp } = req.body;
            const apiKey = req.headers['x-shop-key'] || shopKey;
            const shopId = req.headers['x-shop-id'];

            console.log(`📤 发送消息请求: userId=${userId}, shopId=${shopId}, message=${message?.substring(0, 50)}...`);

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

            let validation = null;

            // 如果有API密钥，进行安全验证
            if (apiKey && shopId) {
                validation = await this.security.validateApiKeyAndDomain(apiKey, req.get('host'), shopId);
                
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

            // 保存消息到数据库（如果有消息仓库的话）
            if (this.messageRepo) {
                try {
                    const conversationId = validation ? 
                        `${validation.shop.id}_${userId}` : 
                        `guest_${userId}`;
                    
                    await this.messageRepo.addMessage({
                        conversationId,
                        sender: 'user',
                        message,
                        timestamp: new Date(),
                        userId,
                        shopId: validation?.shop.id
                    });
                } catch (dbError) {
                    console.error('❌ 保存消息到数据库失败:', dbError);
                    // 不阻塞API响应，只记录错误
                }
            }

            console.log(`✅ 消息发送成功: userId=${userId}`);

            res.json({
                success: true,
                data: {
                    messageId: 'msg_' + Date.now(),
                    timestamp: new Date(),
                    conversationId: validation ? `${validation.shop.id}_${userId}` : `guest_${userId}`
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
                        messages = await this.messageRepo.getMessages(conversationId, lastId);
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
                    hasMore: false
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
