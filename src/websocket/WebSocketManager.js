// WebSocket管理器 - 模块化实现
// 负责处理WebSocket连接、消息路由和客户端管理

const WebSocketHelper = require('../utils/WebSocketHelper');

class WebSocketManager {
    constructor(server, messageAdapter) {
        this.server = server;
        this.messageAdapter = messageAdapter;
        this.wss = null;
        
        // 客户端连接管理
        this.clients = new Map(); // userId -> WebSocket连接
        this.shopClients = new Map(); // shopId -> Set<userId>
        this.connectionStats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesHandled: 0
        };
        
        this.isInitialized = false;
    }
    
    /**
     * 初始化WebSocket服务器
     */
    initialize() {
        console.log('🔍 [NEW-WS] 使用新版模块化WebSocket管理器初始化...');
        if (this.isInitialized) {
            console.log('⚠️ WebSocket管理器已经初始化');
            return this.wss;
        }
        
        // 创建WebSocket服务器
        this.wss = new (require('ws')).Server({
            server: this.server,
            path: '/ws',
            perMessageDeflate: false
        });
        
        // 设置连接处理
        this.wss.on('connection', (ws, req) => {
            this.handleNewConnection(ws, req);
        });
        
        // 心跳检测
        this.startHeartbeat();
        
        this.isInitialized = true;
        console.log('🔌 WebSocket管理器初始化完成');
        console.log(`   📡 WebSocket路径: ws://localhost:3030/ws`);
        
        return this.wss;
    }
    
    /**
     * 处理新的WebSocket连接
     */
    handleNewConnection(ws, req) {
        console.log('🔗 新的WebSocket连接');
        
        // 连接统计
        this.connectionStats.totalConnections++;
        this.connectionStats.activeConnections++;
        
        // 连接状态
        ws.isAlive = true;
        ws.userId = null;
        ws.shopId = null;
        ws.authenticated = false;
        ws.connectedAt = new Date();
        
        // 事件处理器
        ws.on('message', (message) => {
            this.handleMessage(ws, message);
        });
        
        ws.on('close', (code, reason) => {
            this.handleDisconnection(ws, code, reason);
        });
        
        ws.on('error', (error) => {
            this.handleError(ws, error);
        });
        
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        
        // 发送连接确认
        this.sendMessage(ws, {
            type: 'connection_established',
            timestamp: Date.now(),
            message: 'WebSocket连接已建立'
        });
    }
    
    /**
     * 处理WebSocket消息
     */
    async handleMessage(ws, message) {
        try {
            const data = JSON.parse(message);
            this.connectionStats.messagesHandled++;
            
            console.log('📨 收到WebSocket消息:', data.type, `(用户: ${ws.userId || '未认证'})`);
            
            switch (data.type) {
                case 'auth':
                    await this.handleAuth(ws, data);
                    break;
                    
                case 'send_message':
                    await this.handleSendMessage(ws, data);
                    break;
                    
                case 'send_multimedia_message':
                    await this.handleSendMultimediaMessage(ws, data);
                    break;
                    
                case 'user_connect':
                    await this.handleUserConnect(ws, data);
                    break;
                    
                case 'user_message':
                    await this.handleUserMessage(ws, data);
                    break;
                    
                case 'ping':
                    this.handlePing(ws, data);
                    break;
                    
                default:
                    console.log('⚠️ 未知消息类型:', data.type);
                    this.sendError(ws, `未知消息类型: ${data.type}`);
            }
            
        } catch (e) {
            console.error('❌ WebSocket消息解析失败:', e);
            this.sendError(ws, '消息格式错误');
        }
    }
    
    /**
     * 处理用户认证
     */
    async handleAuth(ws, data) {
        try {
            // 支持两种认证方式：
            // 1. sessionId 认证（用于管理端）
            // 2. shopKey + shopId + userId 认证（用于客户端）
            
            if (data.sessionId) {
                // 通过 sessionId 认证（管理端）
                console.log('🔐 [WEBSOCKET] 尝试通过sessionId认证:', data.sessionId);
                
                // 验证session并获取用户信息
                if (global.database) {
                    try {
                        const session = await global.database.getAsync(
                            'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
                            [data.sessionId]
                        );
                        
                        if (session) {
                            const user = await global.database.getAsync(
                                'SELECT * FROM users WHERE id = ?',
                                [session.user_id]
                            );
                            
                            if (user) {
                                // 设置连接信息
                                ws.userId = user.id;
                                ws.sessionId = data.sessionId;
                                ws.userRole = user.role;
                                ws.authenticated = true;
                                
                                // 注册客户端
                                this.registerClient(ws);
                                
                                // 发送认证成功消息
                                this.sendMessage(ws, {
                                    type: 'auth_success',
                                    message: 'WebSocket认证成功',
                                    userId: user.id,
                                    userRole: user.role,
                                    timestamp: Date.now()
                                });
                                
                                console.log(`✅ [WEBSOCKET] SessionId认证成功: ${user.id} (${user.role})`);
                                return;
                            }
                        }
                        
                        console.log('❌ [WEBSOCKET] SessionId认证失败: 无效的session或用户');
                        this.sendError(ws, 'SessionId认证失败: 无效的session');
                        return;
                        
                    } catch (error) {
                        console.error('❌ [WEBSOCKET] SessionId认证数据库错误:', error);
                        this.sendError(ws, 'SessionId认证失败: 数据库错误');
                        return;
                    }
                } else {
                    console.error('❌ [WEBSOCKET] SessionId认证失败: 数据库不可用');
                    this.sendError(ws, 'SessionId认证失败: 数据库不可用');
                    return;
                }
            }
            
            // 传统认证方式（客户端）
            if (!data.shopKey || !data.shopId || !data.userId) {
                this.sendError(ws, '认证信息不完整');
                return;
            }
            
            // 这里可以添加更严格的认证逻辑
            // 例如验证shopKey是否有效
            
            // 使用WebSocketHelper进行标准化认证
            const authResult = WebSocketHelper.authenticate(ws, {
                userId: data.userId,
                shopId: data.shopId,
                shopKey: data.shopKey,
                isCustomer: false
            });
            
            // 注册客户端
            this.registerClient(ws);
            
            // 发送认证成功消息
            WebSocketHelper.sendAuthSuccess(ws, authResult);
            
            console.log(`✅ WebSocket用户认证成功: ${data.userId} (店铺: ${data.shopId})`);
            
        } catch (e) {
            console.error('❌ WebSocket认证失败:', e);
            this.sendError(ws, '认证失败: ' + e.message);
        }
    }
    
    /**
     * 处理用户发送消息
     */
    async handleSendMessage(ws, data) {
        if (!ws.authenticated) {
            this.sendError(ws, '请先进行认证');
            return;
        }
        
        try {
            console.log(`📤 用户 ${ws.userId} 发送消息: "${data.message}"`);
            
            // 保存消息到数据库 - 使用正确的方法名和格式
            const conversationId = `${data.shopId}_${data.userId}`;
            const messageData = {
                conversationId: conversationId,
                senderType: 'customer',
                senderId: data.userId,
                content: data.message,
                timestamp: new Date().toISOString()
            };
            
            await this.messageAdapter.addMessage(messageData);
            
            // 发送确认
            WebSocketHelper.sendMessageSent(ws);
            
            console.log(`✅ 用户消息已保存: ${data.userId} -> "${data.message}"`);
            
            // 通知店铺管理员（如果在线）
            this.notifyShopStaff(data.shopId, {
                type: 'new_user_message',
                userId: data.userId,
                message: data.message,
                timestamp: Date.now()
            });
            
        } catch (e) {
            console.error('❌ 保存用户消息失败:', e);
            this.sendError(ws, '消息发送失败');
        }
    }

    /**
     * 处理用户发送多媒体消息
     */
    async handleSendMultimediaMessage(ws, data) {
        if (!ws.authenticated) {
            this.sendError(ws, '请先进行认证');
            return;
        }
        
        try {
            console.log(`📷 用户 ${ws.userId} 发送多媒体消息: ${data.fileName} (${data.messageType})`);
            
            // 🔍 调试信息
            console.log('🔍 调试信息:', `conversationId=${data.shopId}_${data.userId}, shopId=${data.shopId}, userId=${data.userId}, content=${data.content || data.fileName}`);
            
            // 保存多媒体消息到数据库 - 🔧 修复消息内容和类型
            const conversationId = `${data.shopId}_${data.userId}`;
            
            // 🔧 智能识别消息类型
            let messageType = data.messageType || data.message_type || 'file';
            if (messageType === 'file' && data.fileType) {
                // 如果前端发送的是file类型，但fileType是image/*，则修正为image
                if (data.fileType.startsWith('image/')) {
                    messageType = 'image';
                    console.log('🔧 修正消息类型: file -> image (基于fileType)');
                }
            }
            // 也可以通过URL路径判断
            if (messageType === 'file' && data.fileUrl && data.fileUrl.includes('/uploads/image/')) {
                messageType = 'image';
                console.log('🔧 修正消息类型: file -> image (基于URL路径)');
            }
            
            const messageData = {
                conversationId: conversationId,
                senderType: 'customer',
                senderId: data.userId,
                content: data.fileUrl || data.fileName || '[多媒体文件]', // 🔧 优先使用fileUrl
                messageType: messageType, // 🔧 使用修正后的类型
                fileUrl: data.fileUrl,
                fileName: data.fileName,
                fileId: data.fileId,
                fileSize: data.fileSize,
                timestamp: new Date().toISOString()
            };
            
            console.log('💾 即将保存的消息数据:', messageData);
            await this.messageAdapter.addMessage(messageData);
            
            // 发送确认
            WebSocketHelper.sendMultimediaMessageSent(ws, {
                id: data.fileId,
                url: data.fileUrl,
                name: data.fileName,
                type: data.messageType
            });
            
            console.log(`✅ 用户多媒体消息已保存: ${data.userId} -> ${data.fileName}`);
            
            // 通知店铺管理员（如果在线）
            this.notifyShopStaff(data.shopId, {
                type: 'new_multimedia_message',
                userId: data.userId,
                messageType: data.messageType,
                fileUrl: data.fileUrl,
                fileName: data.fileName,
                fileId: data.fileId,
                timestamp: Date.now()
            });
            
        } catch (e) {
            console.error('❌ 保存用户多媒体消息失败:', e);
            this.sendError(ws, '多媒体消息发送失败');
        }
    }
    
    /**
     * 处理心跳包
     */
    handlePing(ws, data) {
        this.sendMessage(ws, {
            type: 'pong',
            timestamp: Date.now()
        });
    }
    
    /**
     * 处理客户端用户连接 - 自动认证机制
     */
    async handleUserConnect(ws, data) {
        try {
            console.log('🔗 客户端用户连接:', data.userId);
            
            // 客户端自动认证 - 不需要shopKey验证
            ws.userId = data.userId;
            ws.shopId = 'default_shop'; // 默认店铺ID，或从URL参数获取
            ws.authenticated = true;
            ws.isCustomer = true; // 标记为客户端用户
            
            // 注册客户端
            this.registerClient(ws);
            
            // 发送连接成功消息
            this.sendMessage(ws, {
                type: 'connection_success',
                message: '客服连接已建立',
                userId: data.userId,
                timestamp: Date.now()
            });
            
            console.log(`✅ 客户端用户自动认证成功: ${data.userId}`);
            
        } catch (e) {
            console.error('❌ 客户端用户连接失败:', e);
            this.sendError(ws, '连接失败: ' + e.message);
        }
    }
    
    /**
     * 处理客户端用户消息 - 无需预先认证
     */
    async handleUserMessage(ws, data) {
        try {
            console.log(`📤 客户端用户 ${data.userId} 发送消息: "${data.message}"`);
            
            // 如果还未认证，自动进行认证
            if (!ws.authenticated) {
                ws.userId = data.userId;
                ws.shopId = 'default_shop'; // 默认店铺ID
                ws.authenticated = true;
                ws.isCustomer = true;
                
                // 注册客户端
                this.registerClient(ws);
                console.log(`🔧 自动认证客户端用户: ${data.userId}`);
            }
            
            // 保存消息到数据库
            const conversationId = `${ws.shopId}_${data.userId}`;
            const messageData = {
                conversationId: conversationId,
                senderType: 'customer',
                senderId: data.userId,
                content: data.message,
                timestamp: new Date().toISOString()
            };
            
            await this.messageAdapter.addMessage(messageData);
            
            // 发送确认
            this.sendMessage(ws, {
                type: 'message_sent',
                message: '消息发送成功',
                timestamp: Date.now()
            });
            
            console.log(`✅ 客户端用户消息已保存: ${data.userId} -> "${data.message}"`);
            
            // 通知店铺管理员（如果在线）
            this.notifyShopStaff(ws.shopId, {
                type: 'new_user_message',
                userId: data.userId,
                message: data.message,
                timestamp: Date.now()
            });
            
        } catch (e) {
            console.error('❌ 保存客户端用户消息失败:', e);
            this.sendError(ws, '消息发送失败');
        }
    }
    
    /**
     * 注册客户端连接
     */
    registerClient(ws) {
        // 添加到客户端映射
        this.clients.set(ws.userId, ws);
        
        // 添加到店铺客户端映射
        if (!this.shopClients.has(ws.shopId)) {
            this.shopClients.set(ws.shopId, new Set());
        }
        this.shopClients.get(ws.shopId).add(ws.userId);
        
        console.log(`📊 当前在线用户: ${this.clients.size}，店铺 ${ws.shopId} 在线用户: ${this.shopClients.get(ws.shopId).size}`);
    }
    
    /**
     * 移除客户端连接
     */
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
        
        this.connectionStats.activeConnections--;
    }
    
    /**
     * 处理连接断开
     */
    handleDisconnection(ws, code, reason) {
        console.log(`🔌 WebSocket连接断开: ${code} (用户: ${ws.userId || '未认证'})`);
        this.removeClient(ws);
    }
    
    /**
     * 处理连接错误
     */
    handleError(ws, error) {
        console.error('❌ WebSocket连接错误:', error);
        this.removeClient(ws);
    }
    
    /**
     * 向客户端推送消息（客服回复）
     */
    async pushMessageToUser(userId, message, messageType = 'staff') {
        console.log(`🔍 [PUSH-DEBUG] 开始推送消息:`);
        console.log(`   目标用户ID: ${userId}`);
        console.log(`   当前在线用户: [${Array.from(this.clients.keys()).join(', ')}]`);
        
        // 🔧 修复用户ID匹配问题：尝试多种格式
        let ws = this.clients.get(userId);
        let actualUserId = userId;
        
        // 如果直接查找失败，尝试添加 user_ 前缀
        if (!ws && !userId.startsWith('user_')) {
            const userIdWithPrefix = 'user_' + userId;
            ws = this.clients.get(userIdWithPrefix);
            if (ws) {
                actualUserId = userIdWithPrefix;
                console.log(`🔍 找到带前缀的用户ID: ${userIdWithPrefix}`);
            }
        }
        
        // 如果还是失败，尝试去掉 user_ 前缀
        if (!ws && userId.startsWith('user_')) {
            const userIdWithoutPrefix = userId.substring(5);
            ws = this.clients.get(userIdWithoutPrefix);
            if (ws) {
                actualUserId = userIdWithoutPrefix;
                console.log(`🔍 找到不带前缀的用户ID: ${userIdWithoutPrefix}`);
            }
        }
        
        if (ws && ws.readyState === require('ws').OPEN && ws.authenticated) {
            try {
                // 🔧 修复重复消息问题：只发送一种格式的消息
                let messageData;
                if (typeof message === 'object' && message !== null) {
                    // 如果是对象（多媒体消息），创建兼容格式
                    messageData = {
                        type: 'staff_message', // 用于客户端界面
                        ...message,
                        timestamp: Date.now()
                    };
                } else {
                    // 如果是字符串（普通文本消息）
                    messageData = {
                        type: 'staff_message',
                        message: message,
                        content: message,
                        messageType: messageType,
                        timestamp: Date.now()
                    };
                }
                
                // 🔧 只发送一条消息，避免重复
                this.sendMessage(ws, messageData);
                
                const displayMessage = typeof message === 'object' ? 
                    `[${message.messageType || message.message_type || '消息'}]` : message;
                console.log(`📨 客服消息已推送: ${actualUserId} -> "${displayMessage}"`);
                return true;
                
            } catch (e) {
                console.error('❌ 推送消息失败:', e);
                this.removeClient(ws);
                return false;
            }
        }
        
        console.log(`⚠️ 用户 ${userId} 不在线，无法推送消息`);
        console.log(`   WebSocket状态: ${ws ? `存在，readyState=${ws.readyState}, authenticated=${ws.authenticated}` : '不存在'}`);
        return false;
    }
    
    /**
     * 批量推送消息给店铺的所有在线用户
     */
    async broadcastToShop(shopId, message, messageType = 'system') {
        const userIds = this.shopClients.get(shopId);
        if (!userIds) {
            console.log(`⚠️ 店铺 ${shopId} 没有在线用户`);
            return 0;
        }
        
        let sentCount = 0;
        for (const userId of userIds) {
            if (await this.pushMessageToUser(userId, message, messageType)) {
                sentCount++;
            }
        }
        
        if (sentCount > 0) {
            console.log(`📨 店铺广播消息: ${shopId} (${sentCount}个用户收到)`);
        }
        
        return sentCount;
    }
    
    /**
     * 发送消息到WebSocket
     */
    sendMessage(ws, data) {
        return WebSocketHelper.sendMessage(ws, data);
    }
    
    /**
     * 发送错误消息
     */
    sendError(ws, message) {
        return WebSocketHelper.sendError(ws, message);
    }
    
    /**
     * 通知店铺工作人员
     */
    notifyShopStaff(shopId, data) {
        console.log(`🔔 店铺 ${shopId} 有新用户消息，等待客服回复`);
        console.log(`🔍 [NOTIFY] 通知数据:`, data);
        
        // 统计连接
        let totalConnections = 0;
        let authenticatedConnections = 0;
        let adminConnections = 0;
        
        // 向所有管理端连接推送新消息通知
        this.wss.clients.forEach((ws) => {
            totalConnections++;
            
            if (ws.authenticated) {
                authenticatedConnections++;
                console.log(`� [NOTIFY] 找到认证连接: userId=${ws.userId}, sessionId=${ws.sessionId ? '有' : '无'}, role=${ws.role}`);
            }
            
            if (ws.authenticated && ws.sessionId && ws.readyState === require('ws').OPEN) {
                adminConnections++;
                try {
                    // 构建消息数据
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
                    
                    this.sendMessage(ws, notification);
                    console.log(`📨 已向管理端推送新用户消息: ${shopId}_${data.userId} -> "${data.message}"`);
                } catch (e) {
                    console.error('❌ 向管理端推送消息失败:', e);
                }
            }
        });
        
        console.log(`🔍 [NOTIFY] 连接统计: 总连接=${totalConnections}, 认证连接=${authenticatedConnections}, 管理端连接=${adminConnections}`);
    }

    /**
     * 通知管理端消息发送成功
     */
    notifyAdminMessageSent(shopId, userId, messageData) {
        // 查找有sessionId认证的admin连接（管理端）
        this.wss.clients.forEach((ws) => {
            if (ws.authenticated && ws.sessionId && ws.readyState === require('ws').OPEN) {
                try {
                    const notification = {
                        type: 'staff_message',
                        shopId: shopId,
                        userId: userId,
                        message: messageData,
                        timestamp: Date.now()
                    };
                    
                    this.sendMessage(ws, notification);
                    console.log(`🔔 已通知管理端消息发送成功: ${shopId}_${userId}`);
                } catch (e) {
                    console.error('❌ 通知管理端失败:', e);
                }
            }
        });
    }
    
    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        const interval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    console.log(`💔 清理死连接: ${ws.userId || '未认证用户'}`);
                    return ws.terminate();
                }
                
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30秒检测一次
        
        this.wss.on('close', () => {
            clearInterval(interval);
        });
        
        console.log('💓 WebSocket心跳检测已启动 (30秒间隔)');
    }
    
    /**
     * 获取连接统计信息
     */
    getStats() {
        return {
            ...this.connectionStats,
            activeConnections: this.clients.size,
            shopsWithUsers: this.shopClients.size,
            shops: Array.from(this.shopClients.entries()).map(([shopId, userIds]) => ({
                shopId,
                onlineUsers: userIds.size,
                users: Array.from(userIds)
            }))
        };
    }
    
    /**
     * 获取在线用户列表
     */
    getOnlineUsers() {
        return Array.from(this.clients.keys());
    }
    
    /**
     * 关闭WebSocket服务器
     */
    close() {
        if (this.wss) {
            this.wss.close();
            console.log('🔌 WebSocket服务器已关闭');
        }
    }
}

module.exports = WebSocketManager;
