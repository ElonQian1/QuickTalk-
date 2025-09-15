// WebSocket客服系统支持模块
// 实现真正的实时通信，大幅减少服务器日志

const WebSocket = require('ws');

class WebSocketManager {
    constructor(server, messageAdapter) {
        this.server = server;
        this.messageAdapter = messageAdapter;
        this.clients = new Map(); // userId -> WebSocket连接
        this.shopClients = new Map(); // shopId -> Set<userId>
        this.wss = null;
        this.logCount = 0;
    }
    
    initialize() {
        console.log('🔍 [OLD-WS] 使用旧版WebSocket管理器初始化...');
        // 创建WebSocket服务器
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/ws',
            perMessageDeflate: false
        });
        
        this.wss.on('connection', (ws, req) => {
            console.log('🔗 新的WebSocket连接');
            
            ws.isAlive = true;
            ws.userId = null;
            ws.shopId = null;
            ws.authenticated = false;
            
            // 心跳检测
            ws.on('pong', () => {
                ws.isAlive = true;
            });
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (e) {
                    console.error('❌ WebSocket消息解析失败:', e);
                    this.sendError(ws, '消息格式错误');
                }
            });
            
            ws.on('close', (code, reason) => {
                this.logCount++;
                if (this.logCount % 5 === 0) { // 每5次连接断开才记录一次日志
                    console.log(`🔌 WebSocket连接关闭: ${code} (已处理${this.logCount}次断开)`);
                }
                this.removeClient(ws);
            });
            
            ws.on('error', (error) => {
                console.error('❌ WebSocket错误:', error);
                this.removeClient(ws);
            });
        });
        
        // 定期清理死连接
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
        
        this.wss.on('close', () => {
            clearInterval(interval);
        });
        
        console.log('✅ WebSocket服务器已启动');
    }
    
    async handleMessage(ws, data) {
        switch (data.type) {
            case 'auth':
                await this.handleAuth(ws, data);
                break;
                
            case 'send_message':
                await this.handleSendMessage(ws, data);
                break;
                
            default:
                this.sendError(ws, '未知消息类型: ' + data.type);
        }
    }
    
    async handleAuth(ws, data) {
        try {
            // 验证shopKey和shopId
            if (!data.shopKey || !data.shopId || !data.userId) {
                this.sendError(ws, '认证信息不完整');
                return;
            }
            
            // 这里可以添加更严格的认证逻辑
            // 目前简化处理
            
            ws.userId = data.userId;
            ws.shopId = data.shopId;
            ws.shopKey = data.shopKey;
            ws.authenticated = true;
            
            // 注册客户端
            this.clients.set(data.userId, ws);
            
            if (!this.shopClients.has(data.shopId)) {
                this.shopClients.set(data.shopId, new Set());
            }
            this.shopClients.get(data.shopId).add(data.userId);
            
            // 发送认证成功消息
            ws.send(JSON.stringify({
                type: 'auth_success',
                message: '认证成功',
                userId: data.userId
            }));
            
            console.log(`✅ 用户认证成功: ${data.userId} (店铺: ${data.shopId})`);
            
        } catch (e) {
            console.error('❌ WebSocket认证失败:', e);
            this.sendError(ws, '认证失败: ' + e.message);
        }
    }
    
    async handleSendMessage(ws, data) {
        if (!ws.authenticated) {
            this.sendError(ws, '未认证的连接');
            return;
        }
        
        try {
            // 保存消息到数据库
            await this.messageAdapter.saveMessage({
                userId: data.userId,
                shopId: data.shopId,
                message: data.message,
                messageType: 'user',
                timestamp: new Date().toISOString()
            });
            
            // 📨 消息发送成功 - 简化日志
            console.log(`📨 用户消息已保存: ${data.userId}`);
            
            // 通知客服后台有新消息
            this.notifyShopStaff(data.shopId, {
                type: 'new_user_message',
                userId: data.userId,
                message: data.message,
                timestamp: data.timestamp
            });
            
        } catch (e) {
            console.error('❌ 保存用户消息失败:', e);
            this.sendError(ws, '消息发送失败');
        }
    }
    
    // 服务器向客户端推送消息（客服回复）
    async pushMessageToUser(userId, message, messageType = 'staff') {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN && ws.authenticated) {
            try {
                ws.send(JSON.stringify({
                    type: 'staff_message',
                    message: message,
                    messageType: messageType,
                    timestamp: Date.now()
                }));
                
                // 📨 客服消息推送 - 这是唯一的推送日志
                console.log(`📨 客服消息已推送: ${userId}`);
                return true;
                
            } catch (e) {
                console.error('❌ 推送消息失败:', e);
                this.removeClient(ws);
                return false;
            }
        }
        return false; // 用户不在线，需要其他方式通知
    }
    
    // 批量推送消息给店铺的所有在线用户
    async broadcastToShop(shopId, message, messageType = 'system') {
        const userIds = this.shopClients.get(shopId);
        if (!userIds) return 0;
        
        let sentCount = 0;
        for (const userId of userIds) {
            if (await this.pushMessageToUser(userId, message, messageType)) {
                sentCount++;
            }
        }
        
        if (sentCount > 0) {
            console.log(`📨 店铺广播消息: ${shopId} (${sentCount}个用户)`);
        }
        
        return sentCount;
    }
    
    sendError(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                message: message
            }));
        }
    }
    
    removeClient(ws) {
        if (ws.userId) {
            this.clients.delete(ws.userId);
            
            if (ws.shopId && this.shopClients.has(ws.shopId)) {
                this.shopClients.get(ws.shopId).delete(ws.userId);
                
                // 如果店铺没有在线用户了，清理
                if (this.shopClients.get(ws.shopId).size === 0) {
                    this.shopClients.delete(ws.shopId);
                }
            }
        }
    }
    
    // 通知客服后台有新消息
    notifyShopStaff(shopId, data) {
        console.log(`🔔 店铺${shopId}有新用户消息`);
        console.log(`🔍 [NOTIFY] 通知数据:`, data);
        
        // 统计连接
        let totalConnections = 0;
        let authenticatedConnections = 0;
        let adminConnections = 0;
        
        // 查找管理端连接并推送通知
        this.clients.forEach((ws, userId) => {
            totalConnections++;
            
            if (ws && ws.readyState === 1) { // WebSocket.OPEN = 1
                authenticatedConnections++;
                console.log(`🔍 [NOTIFY] 检查连接: userId=${userId}, 状态=${ws.readyState}`);
                
                // 发送新用户消息通知给所有管理端
                try {
                    const notification = {
                        type: 'new_user_message',
                        shopId: shopId,
                        userId: data.userId,
                        message: data.message,
                        content: data.message,
                        conversationId: `${shopId}_${data.userId}`,
                        timestamp: data.timestamp || Date.now(),
                        sender: 'customer',
                        senderType: 'customer'
                    };
                    
                    // 如果是多媒体消息，添加文件信息
                    if (data.fileUrl) {
                        notification.file_url = data.fileUrl;
                        notification.file_name = data.fileName;
                        notification.message_type = data.messageType || 'image';
                        notification.messageType = data.messageType || 'image';
                    }
                    
                    ws.send(JSON.stringify(notification));
                    adminConnections++;
                    console.log(`� 已向管理端推送新用户消息: ${userId} <- ${shopId}_${data.userId} -> "${data.message}"`);
                } catch (e) {
                    console.error(`❌ 向管理端 ${userId} 推送消息失败:`, e.message);
                }
            }
        });
        
        console.log(`🔍 [NOTIFY] 连接统计: 总连接=${totalConnections}, 有效连接=${authenticatedConnections}, 推送成功=${adminConnections}`);
    }
    
    // 获取在线用户统计
    getOnlineStats() {
        return {
            totalClients: this.clients.size,
            shopCount: this.shopClients.size,
            shops: Array.from(this.shopClients.entries()).map(([shopId, userIds]) => ({
                shopId,
                onlineUsers: userIds.size
            }))
        };
    }
}

module.exports = WebSocketManager;

// 使用示例：
// const WebSocketManager = require('./websocket-manager');
// const wsManager = new WebSocketManager(server, messageAdapter);
// wsManager.initialize();
//
// // 在客服回复时推送消息
// wsManager.pushMessageToUser('user_123', '您好，有什么可以帮助您的吗？');
//
// // 广播系统消息
// wsManager.broadcastToShop('shop_123', '系统维护通知');
