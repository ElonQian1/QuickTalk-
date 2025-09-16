const ErrorHandler = require('../utils/ErrorHandler');

/**
 * 客户端连接处理模块
 * 处理客户端的连接建立和认证
 */
class ConnectionHandler {
    constructor(shopRepository, messageRepository, authValidator, domainValidator, securityLogger) {
        this.shopRepository = shopRepository;
        this.messageRepository = messageRepository;
        this.authValidator = authValidator;
        this.domainValidator = domainValidator;
        this.securityLogger = securityLogger;
        
        // 存储活跃连接
        this.activeConnections = new Map();
        
        // 连接会话清理定时器
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // 每5分钟清理一次
    }

    /**
     * 处理安全连接请求
     */
    async handleSecureConnect(req, res) {
        try {
            const {
                userId,
                timestamp,
                shopKey,
                shopId,
                domain,
                version,
                userInfo = {}
            } = req.body;

            // 验证必要参数
            const validationError = ErrorHandler.validateRequiredParams(req.body, ['userId', 'shopKey', 'shopId']);
            if (validationError) {
                return ErrorHandler.sendError(res, validationError.code, validationError.message);
            }

            // 验证API密钥
            const authResult = await this.authValidator.validateApiKey(shopKey);
            if (!authResult.valid) {
                await this.securityLogger.logApiKeyEvent('VALIDATION_FAILED', {
                    apiKey: shopKey,
                    shopId,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    success: false,
                    error: authResult.error,
                    timestamp: new Date().toISOString()
                });

                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_API_KEY, authResult.error);
            }

            const shop = authResult.shop;

            // 验证店铺ID匹配
            if (shop.id !== shopId) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.UNAUTHORIZED_ACCESS, '店铺ID不匹配');
            }

            // 验证域名
            const requestDomain = domain || this.domainValidator.extractDomainFromRequest(req);
            const domainResult = this.domainValidator.validateDomain(requestDomain, shop.domain);
            
            if (!domainResult.valid) {
                await this.securityLogger.logDomainEvent('VALIDATION_FAILED', {
                    requestDomain,
                    authorizedDomain: shop.domain,
                    shopId: shop.id,
                    ip: this.getClientIp(req),
                    success: false,
                    error: domainResult.reason
                });

                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.UNAUTHORIZED_ACCESS, domainResult.reason, {
                    requestDomain,
                    authorizedDomain: shop.domain
                });
            }

            // 生成会话ID
            const sessionId = this.generateSessionId(shopId, userId);
            
            // 创建或获取对话
            const conversation = await this.messageRepository.createOrGetConversation(
                shopId, 
                userId, 
                {
                    ...userInfo,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent']
                }
            );

            // 记录连接信息
            this.activeConnections.set(sessionId, {
                shopId,
                userId,
                conversationId: conversation.id,
                shop,
                connectedAt: new Date(),
                lastActivity: new Date(),
                ip: this.getClientIp(req),
                userAgent: req.headers['user-agent'],
                domain: requestDomain,
                version
            });

            // 更新店铺使用统计
            await this.shopRepository.recordUsageStats(shopId, {
                requests: 1,
                uniqueVisitors: 1
            });

            // 记录成功日志
            await this.securityLogger.logApiKeyEvent('VALIDATION_SUCCESS', {
                apiKey: shopKey,
                shopId,
                ip: this.getClientIp(req),
                userAgent: req.headers['user-agent'],
                success: true,
                timestamp: new Date().toISOString()
            });

            console.log(`🔗 安全连接建立成功: ${shop.name} - ${userId}`);

            ErrorHandler.sendSuccess(res, {
                sessionId,
                shop: {
                    id: shop.id,
                    name: shop.name,
                    domain: shop.domain
                },
                conversation: {
                    id: conversation.id,
                    status: conversation.status
                },
                connected: true,
                version: version || '1.0.0'
            }, '连接建立成功');

        } catch (error) {
            console.error('安全连接失败:', error);
            await this.securityLogger.logError(error, {
                endpoint: '/api/secure-connect',
                body: req.body,
                ip: this.getClientIp(req)
            });

            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '服务器内部错误');
        }
    }

    /**
     * 处理基础连接请求（向后兼容）
     */
    async handleConnect(req, res) {
        try {
            const { userId, timestamp } = req.body;

            const validationError = ErrorHandler.validateRequiredParams(req.body, ['userId']);
            if (validationError) {
                return ErrorHandler.sendError(res, validationError.code, validationError.message);
            }

            // 生成临时会话ID
            const sessionId = this.generateSessionId('guest', userId);
            
            // 记录基础连接
            this.activeConnections.set(sessionId, {
                shopId: 'guest',
                userId,
                connectedAt: new Date(),
                lastActivity: new Date(),
                ip: this.getClientIp(req),
                userAgent: req.headers['user-agent'],
                type: 'basic'
            });

            console.log(`🔗 基础连接建立: ${userId}`);

            ErrorHandler.sendSuccess(res, {
                sessionId,
                connected: true,
                type: 'basic'
            }, '基础连接建立成功');

        } catch (error) {
            console.error('基础连接失败:', error);
            await this.securityLogger.logError(error, {
                endpoint: '/api/connect',
                body: req.body,
                ip: this.getClientIp(req)
            });

            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '服务器内部错误');
        }
    }

    /**
     * 检查连接状态
     */
    async handleConnectionStatus(req, res) {
        try {
            const { sessionId } = req.params;
            const connection = this.activeConnections.get(sessionId);

            if (!connection) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.CONVERSATION_NOT_FOUND, '会话不存在');
            }

            // 更新最后活动时间
            connection.lastActivity = new Date();

            ErrorHandler.sendSuccess(res, {
                sessionId,
                connected: true,
                shopId: connection.shopId,
                userId: connection.userId,
                connectedAt: connection.connectedAt,
                lastActivity: connection.lastActivity
            }, '连接状态正常');

        } catch (error) {
            console.error('状态检查失败:', error);
            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '服务器内部错误');
        }
    }

    /**
     * 断开连接
     */
    async handleDisconnect(req, res) {
        try {
            const { sessionId } = req.body;

            const validationError = ErrorHandler.validateRequiredParams(req.body, ['sessionId']);
            if (validationError) {
                return ErrorHandler.sendError(res, validationError.code, validationError.message);
            }

            const connection = this.activeConnections.get(sessionId);
            if (connection) {
                this.activeConnections.delete(sessionId);
                console.log(`🔌 连接已断开: ${connection.shopId} - ${connection.userId}`);
            }

            ErrorHandler.sendSuccess(res, {}, '连接已断开');

        } catch (error) {
            console.error('断开连接失败:', error);
            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '服务器内部错误');
        }
    }

    /**
     * 获取活跃连接列表
     */
    getActiveConnections(shopId = null) {
        const connections = Array.from(this.activeConnections.entries()).map(([sessionId, connection]) => ({
            sessionId,
            ...connection
        }));

        if (shopId) {
            return connections.filter(conn => conn.shopId === shopId);
        }

        return connections;
    }

    /**
     * 获取连接统计
     */
    getConnectionStats() {
        const connections = Array.from(this.activeConnections.values());
        const shopStats = new Map();

        connections.forEach(conn => {
            if (!shopStats.has(conn.shopId)) {
                shopStats.set(conn.shopId, 0);
            }
            shopStats.set(conn.shopId, shopStats.get(conn.shopId) + 1);
        });

        return {
            totalConnections: connections.length,
            shopConnections: Object.fromEntries(shopStats),
            uptime: process.uptime()
        };
    }

    /**
     * 生成会话ID
     */
    generateSessionId(shopId, userId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `sess_${timestamp}_${random}`;
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
     * 清理过期会话
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expireTime = 30 * 60 * 1000; // 30分钟

        for (const [sessionId, connection] of this.activeConnections.entries()) {
            if (now - connection.lastActivity > expireTime) {
                this.activeConnections.delete(sessionId);
                console.log(`🧹 清理过期会话: ${sessionId}`);
            }
        }
    }

    /**
     * 验证会话
     */
    validateSession(sessionId) {
        const connection = this.activeConnections.get(sessionId);
        if (!connection) {
            return { valid: false, error: '会话不存在' };
        }

        // 检查会话是否过期
        const now = new Date();
        const expireTime = 30 * 60 * 1000; // 30分钟
        
        if (now - connection.lastActivity > expireTime) {
            this.activeConnections.delete(sessionId);
            return { valid: false, error: '会话已过期' };
        }

        // 更新最后活动时间
        connection.lastActivity = now;

        return { valid: true, connection };
    }

    /**
     * 销毁连接处理器
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.activeConnections.clear();
    }
}

module.exports = ConnectionHandler;
