/**
 * 客户端API路由模块
 * 整合所有客户端相关的API接口
 */
const express = require('express');
const { RateLimiter, RateLimitConfigs } = require('../security/rate-limiter');

class ClientApiRouter {
    constructor(connectionHandler, messageHandler, authValidator, domainValidator, securityLogger) {
        this.connectionHandler = connectionHandler;
        this.messageHandler = messageHandler;
        this.authValidator = authValidator;
        this.domainValidator = domainValidator;
        this.securityLogger = securityLogger;
        
        // 创建路由器
        this.router = express.Router();
        
        // 创建限流器
        this.connectionLimiter = new RateLimiter(RateLimitConfigs.CONNECTION);
        this.messageLimiter = new RateLimiter(RateLimitConfigs.MESSAGE_SEND);
        this.clientApiLimiter = new RateLimiter(RateLimitConfigs.CLIENT_API);
        
        this.initializeRoutes();
    }

    /**
     * 初始化路由
     */
    initializeRoutes() {
        // 应用全局中间件
        this.router.use(this.securityLogger.createAccessLogMiddleware());
        this.router.use(this.clientApiLimiter.createMiddleware());

        // ========== 连接相关路由 ==========
        
        // 安全连接建立
        this.router.post('/secure-connect', 
            this.connectionLimiter.createMiddleware(),
            (req, res) => this.connectionHandler.handleSecureConnect(req, res)
        );

        // 基础连接建立（向后兼容）
        this.router.post('/connect',
            this.connectionLimiter.createMiddleware(),
            (req, res) => this.connectionHandler.handleConnect(req, res)
        );

        // 连接状态检查
        this.router.get('/status/:sessionId',
            (req, res) => this.connectionHandler.handleConnectionStatus(req, res)
        );

        // 断开连接
        this.router.post('/disconnect',
            (req, res) => this.connectionHandler.handleDisconnect(req, res)
        );

        // ========== 消息相关路由 ==========

        // 发送消息
        this.router.post('/send',
            this.messageLimiter.createMiddleware(),
            this.authValidator.createOptionalMiddleware(),
            this.domainValidator.createOptionalMiddleware(),
            (req, res) => this.messageHandler.handleSendMessage(req, res)
        );

        // 获取新消息 (客户端轮询接口)
        this.router.get('/client/messages',
            this.authValidator.createOptionalMiddleware(),
            (req, res) => this.messageHandler.handleGetMessages(req, res)
        );

        // 获取消息历史
        this.router.get('/client/messages/:userId/history',
            this.authValidator.createMiddleware(),
            this.domainValidator.createMiddleware(),
            (req, res) => this.messageHandler.handleGetMessageHistory(req, res)
        );

        // 更新消息状态
        this.router.put('/client/messages/:userId/status',
            this.authValidator.createMiddleware(),
            this.domainValidator.createMiddleware(),
            (req, res) => this.messageHandler.handleUpdateMessageStatus(req, res)
        );

        // ========== 客户端信息路由 ==========

        // 获取店铺基本信息
        this.router.get('/shop/info',
            this.authValidator.createMiddleware(),
            (req, res) => this.handleGetShopInfo(req, res)
        );

        // 获取客服在线状态
        this.router.get('/staff/status',
            this.authValidator.createOptionalMiddleware(),
            (req, res) => this.handleGetStaffStatus(req, res)
        );

        // ========== 健康检查路由 ==========

        // API健康检查
        this.router.get('/health',
            (req, res) => this.handleHealthCheck(req, res)
        );

        // 连接统计
        this.router.get('/stats/connections',
            (req, res) => this.handleConnectionStats(req, res)
        );

        // ========== 服务层健康检查 ==========
        
        // 服务层健康检查 (整合自 server.js)
        this.router.get('/health/services',
            (req, res) => this.handleServicesHealth(req, res)
        );
        
        // 服务层统计 (整合自 server.js)
        this.router.get('/stats/services',
            (req, res) => this.handleServicesStats(req, res)
        );

        // ========== WebSocket管理路由 ==========
        
        // WebSocket状态 (整合自 websocket/WebSocketRouter.js)
        this.router.get('/websocket/status',
            (req, res) => this.handleWebSocketStatus(req, res)
        );
        
        // WebSocket在线用户 (整合自 websocket/WebSocketRouter.js)
        this.router.get('/websocket/users',
            (req, res) => this.handleWebSocketUsers(req, res)
        );
        
        // WebSocket消息推送 (整合自 websocket/WebSocketRouter.js)
        this.router.post('/websocket/push',
            this.messageLimiter.createMiddleware(),
            (req, res) => this.handleWebSocketPush(req, res)
        );
        
        // WebSocket广播 (整合自 websocket/WebSocketRouter.js)
        this.router.post('/websocket/broadcast',
            this.messageLimiter.createMiddleware(),
            (req, res) => this.handleWebSocketBroadcast(req, res)
        );

        // ========== 管理员操作路由 ==========
        
        // 管理员回复 (整合自 websocket/WebSocketAPI.js)
        this.router.post('/admin/send-reply',
            this.messageLimiter.createMiddleware(),
            (req, res) => this.handleAdminSendReply(req, res)
        );
        
        // 管理员广播消息 (整合自 websocket/WebSocketAPI.js)
        this.router.post('/admin/broadcast-message',
            this.messageLimiter.createMiddleware(),
            (req, res) => this.handleAdminBroadcast(req, res)
        );
        
        // 管理员查看在线用户 (整合自 websocket/WebSocketAPI.js)
        this.router.get('/admin/online-users',
            (req, res) => this.handleAdminOnlineUsers(req, res)
        );

        // ========== 消息控制器功能 ==========
        
        // 消息搜索 (整合自 controllers/MessageController.js)
        this.router.get('/messages/search',
            this.authValidator.createMiddleware(),
            (req, res) => this.handleMessageSearch(req, res)
        );
        
        // 消息统计 (整合自 controllers/MessageController.js)
        this.router.get('/messages/stats',
            this.authValidator.createMiddleware(),
            (req, res) => this.handleMessageStats(req, res)
        );
        
        // 未读消息数 (整合自 controllers/MessageController.js)
        this.router.get('/messages/unread',
            this.authValidator.createMiddleware(),
            (req, res) => this.handleUnreadCount(req, res)
        );
        
        // 对话消息 (整合自 controllers/MessageController.js)
        this.router.get('/messages/conversation/:conversationId',
            this.authValidator.createMiddleware(),
            (req, res) => this.handleConversationMessages(req, res)
        );

        // ========== 兼容性路由 ==========

        // 兼容旧版本的消息接收接口
        this.router.get('/messages',
            this.authValidator.createOptionalMiddleware(),
            (req, res) => {
                // 重定向到新接口
                req.url = '/client/messages';
                this.messageHandler.handleGetMessages(req, res);
            }
        );

        // 错误处理中间件
        this.router.use(this.handleErrors.bind(this));
    }

    /**
     * 获取店铺信息
     */
    async handleGetShopInfo(req, res) {
        try {
            const shop = req.shop;
            
            res.json({
                success: true,
                data: {
                    id: shop.id,
                    name: shop.name,
                    domain: shop.domain,
                    status: shop.status,
                    settings: shop.settings || {},
                    lastUsed: shop.last_used_at
                }
            });
        } catch (error) {
            console.error('获取店铺信息失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取店铺信息失败'
                }
            });
        }
    }

    /**
     * 获取客服在线状态
     */
    async handleGetStaffStatus(req, res) {
        try {
            const shopId = req.shop?.id;
            
            // 这里可以扩展为真实的客服在线状态检查
            const staffStatus = {
                online: true,
                available: true,
                averageResponseTime: '2分钟',
                queueLength: 0
            };

            res.json({
                success: true,
                data: staffStatus
            });
        } catch (error) {
            console.error('获取客服状态失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取客服状态失败'
                }
            });
        }
    }

    /**
     * 健康检查
     */
    async handleHealthCheck(req, res) {
        try {
            const stats = this.connectionHandler.getConnectionStats();
            
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                data: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    connections: stats,
                    version: '1.0.0'
                }
            });
        } catch (error) {
            console.error('健康检查失败:', error);
            res.status(500).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    }

    /**
     * 连接统计
     */
    async handleConnectionStats(req, res) {
        try {
            const stats = this.connectionHandler.getConnectionStats();
            const connections = this.connectionHandler.getActiveConnections();

            res.json({
                success: true,
                data: {
                    ...stats,
                    connections: connections.map(conn => ({
                        sessionId: conn.sessionId,
                        shopId: conn.shopId,
                        userId: conn.userId,
                        connectedAt: conn.connectedAt,
                        lastActivity: conn.lastActivity,
                        ip: conn.ip,
                        domain: conn.domain
                    }))
                }
            });
        } catch (error) {
            console.error('获取连接统计失败:', error);
            res.status(500).json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: '获取连接统计失败'
                }
            });
        }
    }

    /**
     * 错误处理中间件
     */
    handleErrors(error, req, res, next) {
        console.error('客户端API错误:', error);
        
        // 记录错误日志
        this.securityLogger.logError(error, {
            url: req.url,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            body: req.body,
            query: req.query
        });

        if (res.headersSent) {
            return next(error);
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: '服务器内部错误'
            }
        });
    }

    /**
     * 获取路由器
     */
    getRouter() {
        return this.router;
    }

    // ========== 服务层健康检查处理方法 ==========

    /**
     * 服务层健康检查 (整合自 server.js)
     */
    async handleServicesHealth(req, res) {
        try {
            // 如果有服务层，检查其健康状态
            if (global.serviceLayer && global.serviceLayer.serviceFactory) {
                const healthStatus = await global.serviceLayer.serviceFactory.getHealthStatus();
                res.json(healthStatus);
            } else {
                // 基础健康检查
                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: 'healthy',
                        websocket: 'healthy',
                        api: 'healthy'
                    }
                });
            }
        } catch (error) {
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * 服务层统计 (整合自 server.js)
     */
    async handleServicesStats(req, res) {
        try {
            if (global.serviceLayer && global.serviceLayer.serviceFactory) {
                const stats = global.serviceLayer.serviceFactory.getServiceStats();
                res.json({
                    success: true,
                    stats
                });
            } else {
                res.json({
                    success: true,
                    stats: {
                        activeServices: 0,
                        totalRequests: 0,
                        uptime: process.uptime()
                    }
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ========== WebSocket管理处理方法 ==========

    /**
     * WebSocket状态 (整合自 websocket/WebSocketRouter.js)
     */
    async handleWebSocketStatus(req, res) {
        try {
            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager) {
                const stats = wsManager.getStats();
                res.json({
                    success: true,
                    data: {
                        connected: stats.connected || 0,
                        total: stats.total || 0,
                        rooms: stats.rooms || 0,
                        status: 'active'
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        connected: 0,
                        total: 0,
                        rooms: 0,
                        status: 'inactive'
                    }
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * WebSocket在线用户 (整合自 websocket/WebSocketRouter.js)
     */
    async handleWebSocketUsers(req, res) {
        try {
            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager) {
                const users = wsManager.getConnectedUsers();
                res.json({
                    success: true,
                    data: {
                        users: users || [],
                        count: users ? users.length : 0
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        users: [],
                        count: 0
                    }
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * WebSocket消息推送 (整合自 websocket/WebSocketRouter.js)
     */
    async handleWebSocketPush(req, res) {
        try {
            const { userId, message } = req.body;
            
            if (!userId || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'userId 和 message 是必需的'
                });
            }

            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager) {
                const result = await wsManager.sendToUser(userId, message);
                res.json({
                    success: true,
                    data: { delivered: result }
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: 'WebSocket服务不可用'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * WebSocket广播 (整合自 websocket/WebSocketRouter.js)
     */
    async handleWebSocketBroadcast(req, res) {
        try {
            const { message, target } = req.body;
            
            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'message 是必需的'
                });
            }

            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager) {
                const result = await wsManager.broadcast(message, target);
                res.json({
                    success: true,
                    data: { sent: result }
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: 'WebSocket服务不可用'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ========== 管理员操作处理方法 ==========

    /**
     * 管理员回复 (整合自 websocket/WebSocketAPI.js)
     */
    async handleAdminSendReply(req, res) {
        try {
            const result = await this.messageHandler.handleSendMessage(req, res);
            // 如果处理成功，也通过WebSocket通知
            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager && req.body.userId) {
                wsManager.sendToUser(req.body.userId, {
                    type: 'admin_reply',
                    message: req.body.content
                });
            }
            return result;
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 管理员广播消息 (整合自 websocket/WebSocketAPI.js)
     */
    async handleAdminBroadcast(req, res) {
        try {
            const { message, shopId } = req.body;
            
            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'message 是必需的'
                });
            }

            const wsManager = global.wsManager || global.webSocketManager;
            if (wsManager) {
                const target = shopId ? { shopId } : null;
                const result = await wsManager.broadcast({
                    type: 'admin_broadcast',
                    message: message,
                    timestamp: new Date().toISOString()
                }, target);
                
                res.json({
                    success: true,
                    data: { sent: result }
                });
            } else {
                res.status(503).json({
                    success: false,
                    error: 'WebSocket服务不可用'
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 管理员查看在线用户 (整合自 websocket/WebSocketAPI.js)
     */
    async handleAdminOnlineUsers(req, res) {
        try {
            return this.handleWebSocketUsers(req, res);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ========== 消息控制器功能处理方法 ==========

    /**
     * 消息搜索 (整合自 controllers/MessageController.js)
     */
    async handleMessageSearch(req, res) {
        try {
            const { query, shopId, startDate, endDate } = req.query;
            
            // 使用消息处理器进行搜索
            const searchParams = {
                query,
                shopId,
                startDate,
                endDate
            };
            
            const results = await this.messageHandler.searchMessages(searchParams);
            
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 消息统计 (整合自 controllers/MessageController.js)
     */
    async handleMessageStats(req, res) {
        try {
            const { shopId, period } = req.query;
            
            const stats = await this.messageHandler.getMessageStats({
                shopId,
                period: period || 'today'
            });
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 未读消息数 (整合自 controllers/MessageController.js)
     */
    async handleUnreadCount(req, res) {
        try {
            const { userId, shopId } = req.query;
            
            const count = await this.messageHandler.getUnreadCount({
                userId,
                shopId
            });
            
            res.json({
                success: true,
                data: { unreadCount: count }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 对话消息 (整合自 controllers/MessageController.js)
     */
    async handleConversationMessages(req, res) {
        try {
            const { conversationId } = req.params;
            const { limit, offset } = req.query;
            
            const messages = await this.messageHandler.getConversationMessages({
                conversationId,
                limit: parseInt(limit) || 50,
                offset: parseInt(offset) || 0
            });
            
            res.json({
                success: true,
                data: messages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 销毁资源
     */
    destroy() {
        if (this.connectionLimiter) {
            this.connectionLimiter.destroy();
        }
        if (this.messageLimiter) {
            this.messageLimiter.destroy();
        }
        if (this.clientApiLimiter) {
            this.clientApiLimiter.destroy();
        }
    }
}

module.exports = ClientApiRouter;
