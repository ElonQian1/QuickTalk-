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
