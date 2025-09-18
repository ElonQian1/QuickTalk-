// WebSocket路由模块
// 集成WebSocket管理器到主服务器

const WebSocketManager = require('./WebSocketManager');

class WebSocketRouter {
    constructor() {
        this.wsManager = null;
        this.isInitialized = false;
    }
    
    /**
     * 初始化WebSocket路由
     */
    initialize(server, messageAdapter) {
        if (this.isInitialized) {
            console.log('⚠️ WebSocket路由已经初始化');
            return this.wsManager;
        }
        
        console.log('🚀 初始化WebSocket路由系统...');
        
        // 创建WebSocket管理器
        this.wsManager = new WebSocketManager(server, messageAdapter);
        
        // 初始化WebSocket服务器
        this.wsManager.initialize();
        
        this.isInitialized = true;
        console.log('✅ WebSocket路由系统初始化完成');
        
        return this.wsManager;
    }
    
    /**
     * 集成Express路由 - 添加WebSocket相关的HTTP API
     */
    setupRoutes(app) {
        if (!this.wsManager) {
            console.error('❌ WebSocket管理器未初始化');
            return;
        }
        
        // WebSocket状态API
        app.get('/api/websocket/status', (req, res) => {
            const stats = this.wsManager.getStats();
            res.json({
                success: true,
                data: {
                    isActive: true,
                    ...stats,
                    uptime: process.uptime()
                }
            });
        });
        
        // 在线用户列表API
        app.get('/api/websocket/users', (req, res) => {
            const users = this.wsManager.getOnlineUsers();
            res.json({
                success: true,
                data: {
                    users,
                    count: users.length
                }
            });
        });
        
        // 服务器推送消息API（供管理后台使用）
        app.post('/api/websocket/push', async (req, res) => {
            try {
                const { userId, message, messageType = 'staff' } = req.body;
                
                if (!userId || !message) {
                    return res.status(400).json({
                        success: false,
                        error: '缺少必要参数：userId 和 message'
                    });
                }
                
                const pushed = await this.wsManager.pushMessageToUser(userId, message, messageType);
                
                res.json({
                    success: true,
                    data: {
                        pushed,
                        method: pushed ? 'websocket' : 'offline',
                        timestamp: Date.now()
                    }
                });
                
            } catch (error) {
                console.error('❌ WebSocket推送失败:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // 店铺广播API
        app.post('/api/websocket/broadcast', async (req, res) => {
            try {
                const { shopId, message, messageType = 'system' } = req.body;
                
                if (!shopId || !message) {
                    return res.status(400).json({
                        success: false,
                        error: '缺少必要参数：shopId 和 message'
                    });
                }
                
                const sentCount = await this.wsManager.broadcastToShop(shopId, message, messageType);
                
                res.json({
                    success: true,
                    data: {
                        sentCount,
                        shopId,
                        timestamp: Date.now()
                    }
                });
                
            } catch (error) {
                console.error('❌ WebSocket广播失败:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        console.log('📡 WebSocket API路由已设置:');
        console.log('   GET  /api/websocket/status - WebSocket状态');
        console.log('   GET  /api/websocket/users - 在线用户');
        console.log('   POST /api/websocket/push - 推送消息');
        console.log('   POST /api/websocket/broadcast - 店铺广播');
    }
    
    /**
     * 获取WebSocket管理器实例
     */
    getManager() {
        return this.wsManager;
    }
    
    /**
     * 关闭WebSocket路由
     */
    close() {
        if (this.wsManager) {
            this.wsManager.close();
        }
    }
}

// 导出单例
const wsRouter = new WebSocketRouter();
module.exports = wsRouter;
