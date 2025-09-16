/**
 * ConnectionHandler - 更新版连接处理器
 * 使用新的服务层架构，符合 Controllers → Services → Repositories → Database 模式
 * 替换直接的仓库访问，通过服务层处理业务逻辑
 */

const ErrorHandler = require('../utils/ErrorHandler');

class ConnectionHandler {
    constructor(services) {
        // 新的服务层依赖
        this.shopService = services.shopService;
        this.conversationService = services.conversationService;
        this.notificationService = services.notificationService;
        this.securityManager = services.securityManager;
        
        // 存储活跃连接
        this.activeConnections = new Map();
        
        // 连接会话清理定时器
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // 每5分钟清理一次
        
        console.log('🔗 ConnectionHandler 已更新到服务层架构');
    }

    /**
     * 处理安全连接请求
     * 使用新的店铺服务进行认证和验证
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

            // 使用店铺服务验证API密钥
            let authResult;
            try {
                authResult = await this.shopService.validateApiKey(shopKey);
            } catch (error) {
                throw error;
            }

            if (!authResult.valid) {
                if (this.securityManager) {
                    await this.securityManager.logSecurityEvent('API_VALIDATION_FAILED', {
                        apiKey: shopKey,
                        shopId,
                        userId,
                        ip: this.getClientIp(req),
                        userAgent: req.headers['user-agent'],
                        timestamp: new Date().toISOString()
                    });
                }
                
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_API_KEY, authResult.error);
            }

            const shop = authResult.shop;

            // 验证店铺ID匹配
            if (shop.id !== shopId) {
                if (this.securityLogger) {
                    await this.securityLogger.logSecurityEvent('SHOP_ID_MISMATCH', {
                        providedShopId: shopId,
                        actualShopId: shop.id,
                        apiKey: shopKey,
                        userId,
                        ip: this.getClientIp(req)
                    });
                }
                
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_SHOP_ID, '店铺ID不匹配');
            }

            // 域名验证（如果提供了域名）
            if (domain) {
                let domainValid = false;
                try {
                    // 使用安全管理器验证域名
                    const validationResult = await this.securityManager.validateApiKeyAndDomain(shopKey, domain, shopId);
                    domainValid = validationResult.valid;
                } catch (error) {
                    console.warn('域名验证失败:', error);
                    domainValid = false;
                }

                if (!domainValid) {
                    if (this.securityManager) {
                        await this.securityManager.logSecurityEvent('INVALID_DOMAIN', {
                            domain,
                            shopId: shop.id,
                            userId,
                            ip: this.getClientIp(req)
                        });
                    }
                    
                    return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_DOMAIN, '域名验证失败');
                }
            }

            // 创建或获取对话（使用对话服务）
            const conversation = await this.conversationService.createOrGetConversation({
                shopId: shop.id,
                userId,
                metadata: {
                    userInfo,
                    connectionInfo: {
                        ip: this.getClientIp(req),
                        userAgent: req.headers['user-agent'],
                        domain,
                        version,
                        timestamp: timestamp || new Date().toISOString()
                    }
                }
            });

            // 生成会话令牌
            const sessionToken = this.generateSessionToken(shop.id, userId, conversation.id);
            
            // 存储活跃连接信息
            this.activeConnections.set(sessionToken, {
                shopId: shop.id,
                userId,
                conversationId: conversation.id,
                connectedAt: new Date(),
                lastActivity: new Date(),
                metadata: {
                    userInfo,
                    domain,
                    version,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent']
                }
            });

            // 更新店铺连接统计（使用店铺服务）
            try {
                await this.shopService.recordUsageStats(shop.id, {
                    connections: 1,
                    activeUsers: this.getActiveUserCount(shop.id)
                });
            } catch (statsError) {
                console.warn('更新连接统计失败:', statsError);
                // 不影响连接建立流程
            }

            // 发送连接建立通知（使用通知服务）
            if (this.notificationService) {
                try {
                    await this.notificationService.notifyNewConnection({
                        shopId: shop.id,
                        userId,
                        conversationId: conversation.id,
                        userInfo,
                        timestamp: new Date()
                    });
                } catch (notificationError) {
                    console.warn('发送连接通知失败:', notificationError);
                    // 不影响连接建立流程
                }
            }

            // 记录成功连接日志
            if (this.securityLogger) {
                await this.securityLogger.logConnectionEvent('CONNECT_SUCCESS', {
                    shopId: shop.id,
                    userId,
                    conversationId: conversation.id,
                    sessionToken,
                    ip: this.getClientIp(req),
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`🔗 客户端连接成功: ${shop.name} - ${userId}`);

            ErrorHandler.sendSuccess(res, {
                sessionToken,
                conversationId: conversation.id,
                shopInfo: {
                    id: shop.id,
                    name: shop.name,
                    config: shop.config || {}
                },
                connectionStatus: 'connected',
                timestamp: new Date().toISOString()
            }, '连接建立成功');

        } catch (error) {
            console.error('安全连接建立失败:', error);
            
            if (this.securityLogger) {
                await this.securityLogger.logError(error, {
                    endpoint: '/api/connect',
                    body: req.body,
                    ip: this.getClientIp(req)
                });
            }

            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '连接建立失败');
        }
    }

    /**
     * 处理断开连接请求
     */
    async handleDisconnect(req, res) {
        try {
            const { sessionToken, userId, reason } = req.body;

            if (!sessionToken) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.MISSING_SESSION_TOKEN, '缺少会话令牌');
            }

            // 获取连接信息
            const connectionInfo = this.activeConnections.get(sessionToken);
            
            if (!connectionInfo) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INVALID_SESSION_TOKEN, '无效的会话令牌');
            }

            // 验证用户身份
            if (userId && connectionInfo.userId !== userId) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.UNAUTHORIZED, '用户身份不匹配');
            }

            // 更新对话状态（使用对话服务）
            try {
                await this.conversationService.updateConversationStatus({
                    conversationId: connectionInfo.conversationId,
                    status: 'disconnected',
                    metadata: {
                        disconnectReason: reason,
                        disconnectTime: new Date()
                    }
                });
            } catch (error) {
                console.warn('更新对话状态失败:', error);
                // 不影响断开连接流程
            }

            // 发送断开连接通知（使用通知服务）
            if (this.notificationService) {
                try {
                    await this.notificationService.notifyConnectionClosed({
                        shopId: connectionInfo.shopId,
                        userId: connectionInfo.userId,
                        conversationId: connectionInfo.conversationId,
                        reason,
                        timestamp: new Date()
                    });
                } catch (notificationError) {
                    console.warn('发送断开连接通知失败:', notificationError);
                }
            }

            // 移除活跃连接
            this.activeConnections.delete(sessionToken);

            // 更新店铺连接统计
            if (this.shopService) {
                try {
                    await this.shopService.recordUsageStats(connectionInfo.shopId, {
                        disconnections: 1,
                        activeUsers: this.getActiveUserCount(connectionInfo.shopId)
                    });
                } catch (statsError) {
                    console.warn('更新断开连接统计失败:', statsError);
                }
            }

            // 记录断开连接日志
            if (this.securityLogger) {
                await this.securityLogger.logConnectionEvent('DISCONNECT_SUCCESS', {
                    shopId: connectionInfo.shopId,
                    userId: connectionInfo.userId,
                    conversationId: connectionInfo.conversationId,
                    sessionToken,
                    reason,
                    duration: Date.now() - connectionInfo.connectedAt.getTime(),
                    timestamp: new Date().toISOString()
                });
            }

            console.log(`🔌 客户端断开连接: ${connectionInfo.userId}, 原因: ${reason}`);

            ErrorHandler.sendSuccess(res, {
                disconnected: true,
                timestamp: new Date().toISOString()
            }, '断开连接成功');

        } catch (error) {
            console.error('断开连接失败:', error);
            
            if (this.securityLogger) {
                await this.securityLogger.logError(error, {
                    endpoint: '/api/disconnect',
                    body: req.body,
                    ip: this.getClientIp(req)
                });
            }

            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '断开连接失败');
        }
    }

    /**
     * 获取连接状态
     */
    async handleGetConnectionStatus(req, res) {
        try {
            const { sessionToken } = req.query;

            if (!sessionToken) {
                return ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.MISSING_SESSION_TOKEN, '缺少会话令牌');
            }

            const connectionInfo = this.activeConnections.get(sessionToken);
            
            if (!connectionInfo) {
                return res.json({
                    success: true,
                    data: {
                        connected: false,
                        status: 'disconnected'
                    }
                });
            }

            // 更新最后活动时间
            connectionInfo.lastActivity = new Date();

            // 获取对话统计信息（使用对话服务）
            let conversationStats = {};
            if (this.conversationService) {
                try {
                    conversationStats = await this.conversationService.getConversationStats(connectionInfo.conversationId);
                } catch (error) {
                    console.warn('获取对话统计失败:', error);
                }
            }

            res.json({
                success: true,
                data: {
                    connected: true,
                    status: 'active',
                    connectionInfo: {
                        shopId: connectionInfo.shopId,
                        userId: connectionInfo.userId,
                        conversationId: connectionInfo.conversationId,
                        connectedAt: connectionInfo.connectedAt,
                        lastActivity: connectionInfo.lastActivity,
                        duration: Date.now() - connectionInfo.connectedAt.getTime()
                    },
                    conversationStats
                }
            });

        } catch (error) {
            console.error('获取连接状态失败:', error);
            
            ErrorHandler.sendError(res, ErrorHandler.ERROR_CODES.INTERNAL_ERROR, '获取连接状态失败');
        }
    }

    /**
     * 生成会话令牌
     * @private
     */
    generateSessionToken(shopId, userId, conversationId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2);
        return `${shopId}-${userId}-${conversationId}-${timestamp}-${random}`;
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
     * 获取指定店铺的活跃用户数量
     * @private
     */
    getActiveUserCount(shopId) {
        return Array.from(this.activeConnections.values())
            .filter(conn => conn.shopId === shopId)
            .length;
    }

    /**
     * 清理过期会话
     * @private
     */
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredTokens = [];

        for (const [token, connectionInfo] of this.activeConnections.entries()) {
            // 超过30分钟无活动的会话被认为是过期的
            const inactiveTime = now.getTime() - connectionInfo.lastActivity.getTime();
            if (inactiveTime > 30 * 60 * 1000) {
                expiredTokens.push(token);
            }
        }

        for (const token of expiredTokens) {
            const connectionInfo = this.activeConnections.get(token);
            this.activeConnections.delete(token);
            
            console.log(`🧹 清理过期会话: ${connectionInfo.userId}`);
            
            // 记录会话过期日志
            if (this.securityLogger) {
                this.securityLogger.logConnectionEvent('SESSION_EXPIRED', {
                    shopId: connectionInfo.shopId,
                    userId: connectionInfo.userId,
                    conversationId: connectionInfo.conversationId,
                    sessionToken: token,
                    inactiveTime,
                    timestamp: new Date().toISOString()
                }).catch(error => {
                    console.warn('记录会话过期日志失败:', error);
                });
            }
        }

        if (expiredTokens.length > 0) {
            console.log(`🧹 已清理 ${expiredTokens.length} 个过期会话`);
        }
    }

    /**
     * 获取活跃连接统计
     */
    getActiveConnectionStats() {
        const stats = {
            totalConnections: this.activeConnections.size,
            shopStats: {},
            oldestConnection: null,
            newestConnection: null
        };

        for (const connectionInfo of this.activeConnections.values()) {
            const shopId = connectionInfo.shopId;
            
            if (!stats.shopStats[shopId]) {
                stats.shopStats[shopId] = {
                    activeUsers: 0,
                    connections: []
                };
            }
            
            stats.shopStats[shopId].activeUsers++;
            stats.shopStats[shopId].connections.push({
                userId: connectionInfo.userId,
                conversationId: connectionInfo.conversationId,
                connectedAt: connectionInfo.connectedAt,
                lastActivity: connectionInfo.lastActivity
            });

            // 跟踪最老和最新的连接
            if (!stats.oldestConnection || connectionInfo.connectedAt < stats.oldestConnection.connectedAt) {
                stats.oldestConnection = connectionInfo;
            }
            
            if (!stats.newestConnection || connectionInfo.connectedAt > stats.newestConnection.connectedAt) {
                stats.newestConnection = connectionInfo;
            }
        }

        return stats;
    }

    /**
     * 优雅关闭
     */
    async shutdown() {
        try {
            console.log('🔄 关闭连接处理器...');
            
            // 清理定时器
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            // 通知所有活跃连接即将关闭
            const disconnectPromises = [];
            for (const [token, connectionInfo] of this.activeConnections.entries()) {
                if (this.notificationService) {
                    disconnectPromises.push(
                        this.notificationService.notifyConnectionClosed({
                            shopId: connectionInfo.shopId,
                            userId: connectionInfo.userId,
                            conversationId: connectionInfo.conversationId,
                            reason: 'server_shutdown',
                            timestamp: new Date()
                        }).catch(error => {
                            console.warn(`通知连接关闭失败 ${token}:`, error);
                        })
                    );
                }
            }

            await Promise.all(disconnectPromises);

            // 清空连接
            this.activeConnections.clear();
            
            console.log('✅ 连接处理器关闭完成');
            
        } catch (error) {
            console.error('关闭连接处理器失败:', error);
            throw error;
        }
    }

    /**
     * 创建服务层兼容的ConnectionHandler工厂方法
     * @param {Object} services - 服务层对象
     * @param {Object} legacyServices - 兼容旧服务
     */
    static createWithServices(services) {
        return new ConnectionHandler(services);
    }

    /**
     * 迁移辅助方法：逐步迁移现有实例到服务层
     * @param {ConnectionHandler} existingHandler - 现有处理器
     * @param {Object} services - 新服务层对象
     */
    static migrateToServices(existingHandler, services) {
        // 注入服务依赖
        existingHandler.shopService = services.shopService;
        existingHandler.conversationService = services.conversationService;
        existingHandler.notificationService = services.notificationService;
        existingHandler.securityManager = services.securityManager;
        
        console.log('✅ ConnectionHandler 已迁移到服务层架构');
        return existingHandler;
    }
}

module.exports = ConnectionHandler;