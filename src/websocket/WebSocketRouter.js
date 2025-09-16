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
     * 集成Express路由 - HTTP API已整合到client-api，此方法保留供兼容
     * @deprecated 使用 client-api-router.js 中的统一API
     */
    setupRoutes(app) {
        console.log('ℹ️ WebSocket HTTP API 已整合到 client-api-router.js');
        console.log('ℹ️ setupRoutes() 方法已废弃，请使用统一的客户端API');
        
        // ❌ 以下路由已移动到 src/client-api/client-api-router.js：
        // - GET  /api/websocket/status
        // - GET  /api/websocket/users  
        // - POST /api/websocket/push
        // - POST /api/websocket/broadcast
        
        // 只有WebSocket服务器初始化是必要的，HTTP路由由统一API处理
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
