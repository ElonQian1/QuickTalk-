/**
 * WebSocketManager - 更新版WebSocket管理器
 * 使用新的服务层架构，符合 Controllers → Services → Repositories → Database 模式
 * 替换直接的适配器访问，通过服务层处理业务逻辑
 */

const WebSocketHelper = require('../utils/WebSocketHelper');

class WebSocketManager {
    constructor(server, services, legacyServices = {}) {
        this.server = server;
        
        // 新的服务层依赖
        this.messageService = services.messageService;
        this.conversationService = services.conversationService;
        this.shopService = services.shopService;
        this.notificationService = services.notificationService;
        this.autoReplyService = services.autoReplyService;
        
        // 保持向后兼容的依赖
        this.messageAdapter = legacyServices.messageAdapter;
        
        this.wss = null;
        
        // 客户端连接管理
        this.clients = new Map(); // userId -> WebSocket连接
        this.shopClients = new Map(); // shopId -> Set<userId>
        this.connectionStats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesHandled: 0,
            serviceLayerActive: true
        };
        
        this.isInitialized = false;
        
        console.log('🔌 WebSocketManager 已更新到服务层架构');
    }
    
    /**
     * 初始化WebSocket服务器
     */
    initialize() {
        console.log('🔍 [SERVICE-LAYER-WS] 使用服务层WebSocket管理器初始化...');
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
        console.log('🔌 服务层WebSocket管理器初始化完成');
        
        return this.wss;
    }
    
    /**
     * 处理新的WebSocket连接
     */
    async handleNewConnection(ws, req) {
        try {
            console.log('🔗 新的WebSocket连接建立');
            
            const clientId = this.generateClientId();
            const clientInfo = {
                id: clientId,
                ws: ws,
                connected: true,
                connectedAt: new Date(),
                lastActivity: new Date(),
                ip: this.getClientIP(req),
                userAgent: req.headers['user-agent'] || '',
                userId: null,
                shopId: null,
                conversationId: null,
                isAuthenticated: false
            };
            
            // 设置WebSocket事件处理器
            ws.on('message', async (data) => {
                await this.handleMessage(ws, data, clientInfo);
            });
            
            ws.on('close', (code, reason) => {
                this.handleConnectionClose(clientInfo, code, reason);
            });
            
            ws.on('error', (error) => {
                this.handleConnectionError(clientInfo, error);
            });
            
            // 添加到客户端管理
            this.clients.set(clientId, clientInfo);
            this.connectionStats.totalConnections++;
            this.connectionStats.activeConnections++;
            
            // 发送连接确认
            this.sendToClient(ws, {
                type: 'connection_established',
                clientId: clientId,
                timestamp: new Date().toISOString(),
                serverVersion: '2.0-service-layer'
            });
            
            console.log(`✅ WebSocket连接已建立，客户端ID: ${clientId}`);
            
        } catch (error) {
            console.error('WebSocket连接建立失败:', error);
            ws.close(1011, '服务器内部错误');
        }
    }
    
    /**
     * 处理WebSocket消息
     */
    async handleMessage(ws, data, clientInfo) {
        try {
            let message;
            
            try {
                message = JSON.parse(data.toString());
            } catch (parseError) {
                console.error('消息解析失败:', parseError);
                this.sendError(ws, 'INVALID_JSON', '消息格式错误');
                return;
            }
            
            // 更新客户端活动时间
            clientInfo.lastActivity = new Date();
            this.connectionStats.messagesHandled++;
            
            console.log(`📥 收到消息类型: ${message.type}, 客户端: ${clientInfo.id}`);
            
            // 根据消息类型路由处理
            switch (message.type) {
                case 'auth':
                    await this.handleAuthMessage(ws, message, clientInfo);
                    break;
                    
                case 'send_message':
                    await this.handleSendMessage(ws, message, clientInfo);
                    break;
                    
                case 'get_messages':
                    await this.handleGetMessages(ws, message, clientInfo);
                    break;
                    
                case 'join_conversation':
                    await this.handleJoinConversation(ws, message, clientInfo);
                    break;
                    
                case 'leave_conversation':
                    await this.handleLeaveConversation(ws, message, clientInfo);
                    break;
                    
                case 'typing':
                    await this.handleTypingIndicator(ws, message, clientInfo);
                    break;
                    
                case 'ping':
                    this.handlePing(ws, message, clientInfo);
                    break;
                    
                default:
                    console.warn(`未知消息类型: ${message.type}`);
                    this.sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `未知的消息类型: ${message.type}`);
            }
            
        } catch (error) {
            console.error('处理WebSocket消息失败:', error);
            this.sendError(ws, 'MESSAGE_HANDLING_ERROR', '消息处理失败');
        }
    }
    
    /**
     * 处理认证消息
     */
    async handleAuthMessage(ws, message, clientInfo) {
        try {
            const { shopKey, userId, conversationId } = message.data || {};
            
            if (!shopKey || !userId) {
                this.sendError(ws, 'MISSING_AUTH_DATA', '缺少认证信息');
                return;
            }
            
            // 使用店铺服务验证API密钥
            let authResult;
            try {
                authResult = await this.shopService.validateApiKey(shopKey);
            } catch (error) {
                console.warn('服务层验证失败，回退到适配器验证:', error);
                // 回退到消息适配器验证（向后兼容）
                if (this.messageAdapter && this.messageAdapter.validateShopKey) {
                    authResult = await this.messageAdapter.validateShopKey(shopKey);
                } else {
                    throw error;
                }
            }
            
            if (!authResult.valid) {
                this.sendError(ws, 'INVALID_API_KEY', authResult.error || '无效的API密钥');
                return;
            }
            
            const shop = authResult.shop;
            
            // 创建或获取对话（使用对话服务）
            let conversation;
            if (conversationId) {
                // 验证现有对话
                try {
                    conversation = await this.conversationService.getConversation(conversationId);
                    if (!conversation || conversation.shopId !== shop.id) {
                        throw new Error('对话不存在或不属于该店铺');
                    }
                } catch (error) {
                    console.warn('获取现有对话失败，创建新对话:', error);
                    conversation = await this.conversationService.createOrGetConversation({
                        shopId: shop.id,
                        userId
                    });
                }
            } else {
                // 创建新对话
                conversation = await this.conversationService.createOrGetConversation({
                    shopId: shop.id,
                    userId
                });
            }
            
            // 更新客户端信息
            clientInfo.userId = userId;
            clientInfo.shopId = shop.id;
            clientInfo.conversationId = conversation.id;
            clientInfo.isAuthenticated = true;
            
            // 添加到店铺客户端组
            if (!this.shopClients.has(shop.id)) {
                this.shopClients.set(shop.id, new Set());
            }
            this.shopClients.get(shop.id).add(clientInfo.id);
            
            // 发送认证成功响应
            this.sendToClient(ws, {
                type: 'auth_success',
                data: {
                    userId,
                    shopId: shop.id,
                    shopName: shop.name,
                    conversationId: conversation.id,
                    clientId: clientInfo.id
                },
                timestamp: new Date().toISOString()
            });
            
            // 发送连接通知（使用通知服务）
            if (this.notificationService) {
                try {
                    await this.notificationService.notifyNewConnection({
                        shopId: shop.id,
                        userId,
                        conversationId: conversation.id,
                        clientId: clientInfo.id,
                        timestamp: new Date()
                    });
                } catch (notificationError) {
                    console.warn('发送连接通知失败:', notificationError);
                }
            }
            
            console.log(`🔐 客户端认证成功: ${userId} (店铺: ${shop.name})`);
            
        } catch (error) {
            console.error('认证处理失败:', error);
            this.sendError(ws, 'AUTH_FAILED', '认证失败');
        }
    }
    
    /**
     * 处理发送消息
     */
    async handleSendMessage(ws, message, clientInfo) {
        try {
            if (!clientInfo.isAuthenticated) {
                this.sendError(ws, 'NOT_AUTHENTICATED', '未认证');
                return;
            }
            
            const { content, messageType = 'text', metadata = {} } = message.data || {};
            
            if (!content) {
                this.sendError(ws, 'MISSING_CONTENT', '缺少消息内容');
                return;
            }
            
            // 使用消息服务发送消息
            const result = await this.messageService.sendMessage({
                conversationId: clientInfo.conversationId,
                senderId: clientInfo.userId,
                senderType: 'customer',
                content,
                messageType,
                metadata: {
                    ...metadata,
                    source: 'websocket',
                    clientId: clientInfo.id,
                    ip: clientInfo.ip,
                    userAgent: clientInfo.userAgent
                }
            });
            
            // 发送确认响应
            this.sendToClient(ws, {
                type: 'message_sent',
                data: {
                    messageId: result.message.id,
                    conversationId: clientInfo.conversationId,
                    timestamp: result.message.createdAt
                }
            });
            
            // 广播消息到店铺的其他客户端
            this.broadcastToShop(clientInfo.shopId, {
                type: 'new_message',
                data: {
                    messageId: result.message.id,
                    conversationId: clientInfo.conversationId,
                    senderId: clientInfo.userId,
                    senderType: 'customer',
                    content,
                    messageType,
                    timestamp: result.message.createdAt
                }
            }, clientInfo.id);
            
            // 尝试自动回复
            if (this.autoReplyService) {
                try {
                    const autoReplyResult = await this.autoReplyService.processMessage({
                        messageId: result.message.id,
                        conversationId: clientInfo.conversationId,
                        content,
                        metadata: {
                            shopId: clientInfo.shopId,
                            userId: clientInfo.userId,
                            messageType
                        }
                    });
                    
                    if (autoReplyResult.shouldReply) {
                        // 发送自动回复
                        const autoReply = await this.messageService.sendMessage({
                            conversationId: clientInfo.conversationId,
                            senderId: 'system',
                            senderType: 'assistant',
                            content: autoReplyResult.replyContent,
                            messageType: 'text',
                            metadata: {
                                isAutoReply: true,
                                confidence: autoReplyResult.confidence,
                                intent: autoReplyResult.intent
                            }
                        });
                        
                        // 发送自动回复到客户端
                        this.sendToClient(ws, {
                            type: 'new_message',
                            data: {
                                messageId: autoReply.message.id,
                                conversationId: clientInfo.conversationId,
                                senderId: 'system',
                                senderType: 'assistant',
                                content: autoReplyResult.replyContent,
                                messageType: 'text',
                                timestamp: autoReply.message.createdAt,
                                isAutoReply: true
                            }
                        });
                    }
                } catch (autoReplyError) {
                    console.warn('自动回复处理失败:', autoReplyError);
                }
            }
            
            console.log(`📤 消息已发送: ${clientInfo.userId} -> ${content.substring(0, 50)}...`);
            
        } catch (error) {
            console.error('发送消息失败:', error);
            this.sendError(ws, 'SEND_MESSAGE_FAILED', '发送消息失败');
        }
    }
    
    /**
     * 处理获取消息
     */
    async handleGetMessages(ws, message, clientInfo) {
        try {
            if (!clientInfo.isAuthenticated) {
                this.sendError(ws, 'NOT_AUTHENTICATED', '未认证');
                return;
            }
            
            const { lastMessageId, limit = 50 } = message.data || {};
            
            // 使用消息服务获取消息
            const result = await this.messageService.getConversationMessages({
                conversationId: clientInfo.conversationId,
                afterId: lastMessageId,
                limit: Math.min(limit, 100)
            });
            
            // 发送消息历史
            this.sendToClient(ws, {
                type: 'messages_history',
                data: {
                    messages: result.messages,
                    conversationId: clientInfo.conversationId,
                    hasMore: result.hasMore,
                    totalCount: result.totalCount
                }
            });
            
            console.log(`📥 发送消息历史: ${result.messages.length} 条消息`);
            
        } catch (error) {
            console.error('获取消息失败:', error);
            this.sendError(ws, 'GET_MESSAGES_FAILED', '获取消息失败');
        }
    }
    
    /**
     * 处理加入对话
     */
    async handleJoinConversation(ws, message, clientInfo) {
        try {
            if (!clientInfo.isAuthenticated) {
                this.sendError(ws, 'NOT_AUTHENTICATED', '未认证');
                return;
            }
            
            const { conversationId } = message.data || {};
            
            if (!conversationId) {
                this.sendError(ws, 'MISSING_CONVERSATION_ID', '缺少对话ID');
                return;
            }
            
            // 验证对话权限（使用对话服务）
            const conversation = await this.conversationService.getConversation(conversationId);
            if (!conversation || conversation.shopId !== clientInfo.shopId) {
                this.sendError(ws, 'INVALID_CONVERSATION', '无效的对话');
                return;
            }
            
            // 更新客户端对话ID
            clientInfo.conversationId = conversationId;
            
            // 发送加入成功响应
            this.sendToClient(ws, {
                type: 'conversation_joined',
                data: {
                    conversationId,
                    joinedAt: new Date().toISOString()
                }
            });
            
            console.log(`🏠 客户端加入对话: ${clientInfo.userId} -> ${conversationId}`);
            
        } catch (error) {
            console.error('加入对话失败:', error);
            this.sendError(ws, 'JOIN_CONVERSATION_FAILED', '加入对话失败');
        }
    }
    
    /**
     * 处理离开对话
     */
    async handleLeaveConversation(ws, message, clientInfo) {
        try {
            // 发送离开确认
            this.sendToClient(ws, {
                type: 'conversation_left',
                data: {
                    conversationId: clientInfo.conversationId,
                    leftAt: new Date().toISOString()
                }
            });
            
            console.log(`🚪 客户端离开对话: ${clientInfo.userId} <- ${clientInfo.conversationId}`);
            
            // 重置对话ID
            clientInfo.conversationId = null;
            
        } catch (error) {
            console.error('离开对话失败:', error);
            this.sendError(ws, 'LEAVE_CONVERSATION_FAILED', '离开对话失败');
        }
    }
    
    /**
     * 处理输入指示器
     */
    async handleTypingIndicator(ws, message, clientInfo) {
        try {
            if (!clientInfo.isAuthenticated || !clientInfo.conversationId) {
                return;
            }
            
            const { isTyping } = message.data || {};
            
            // 广播输入状态到店铺的其他客户端
            this.broadcastToShop(clientInfo.shopId, {
                type: 'user_typing',
                data: {
                    userId: clientInfo.userId,
                    conversationId: clientInfo.conversationId,
                    isTyping: !!isTyping,
                    timestamp: new Date().toISOString()
                }
            }, clientInfo.id);
            
        } catch (error) {
            console.error('处理输入指示器失败:', error);
        }
    }
    
    /**
     * 处理心跳
     */
    handlePing(ws, message, clientInfo) {
        this.sendToClient(ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 处理连接关闭
     */
    async handleConnectionClose(clientInfo, code, reason) {
        try {
            console.log(`🔌 WebSocket连接关闭: ${clientInfo.id}, 代码: ${code}, 原因: ${reason}`);
            
            // 从客户端管理中移除
            this.clients.delete(clientInfo.id);
            this.connectionStats.activeConnections--;
            
            // 从店铺客户端组中移除
            if (clientInfo.shopId && this.shopClients.has(clientInfo.shopId)) {
                this.shopClients.get(clientInfo.shopId).delete(clientInfo.id);
                if (this.shopClients.get(clientInfo.shopId).size === 0) {
                    this.shopClients.delete(clientInfo.shopId);
                }
            }
            
            // 发送断开连接通知（使用通知服务）
            if (clientInfo.isAuthenticated && this.notificationService) {
                try {
                    await this.notificationService.notifyConnectionClosed({
                        shopId: clientInfo.shopId,
                        userId: clientInfo.userId,
                        conversationId: clientInfo.conversationId,
                        clientId: clientInfo.id,
                        reason: reason || 'connection_closed',
                        timestamp: new Date()
                    });
                } catch (notificationError) {
                    console.warn('发送断开连接通知失败:', notificationError);
                }
            }
            
        } catch (error) {
            console.error('处理连接关闭失败:', error);
        }
    }
    
    /**
     * 处理连接错误
     */
    handleConnectionError(clientInfo, error) {
        console.error(`WebSocket连接错误 ${clientInfo.id}:`, error);
    }
    
    /**
     * 向客户端发送消息
     */
    sendToClient(ws, message) {
        try {
            if (ws.readyState === 1) { // WebSocket.OPEN
                ws.send(JSON.stringify(message));
            }
        } catch (error) {
            console.error('发送消息到客户端失败:', error);
        }
    }
    
    /**
     * 发送错误消息
     */
    sendError(ws, code, message) {
        this.sendToClient(ws, {
            type: 'error',
            error: {
                code,
                message
            },
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 广播消息到店铺
     */
    broadcastToShop(shopId, message, excludeClientId = null) {
        const shopClientIds = this.shopClients.get(shopId);
        if (!shopClientIds) return;
        
        for (const clientId of shopClientIds) {
            if (clientId === excludeClientId) continue;
            
            const clientInfo = this.clients.get(clientId);
            if (clientInfo && clientInfo.ws.readyState === 1) {
                this.sendToClient(clientInfo.ws, message);
            }
        }
    }
    
    /**
     * 生成客户端ID
     */
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    }
    
    /**
     * 获取客户端IP
     */
    getClientIP(req) {
        return req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }
    
    /**
     * 启动心跳检测
     */
    startHeartbeat() {
        setInterval(() => {
            this.clients.forEach((clientInfo, clientId) => {
                if (clientInfo.ws.readyState === 1) {
                    // 检查最后活动时间
                    const inactiveTime = Date.now() - clientInfo.lastActivity.getTime();
                    if (inactiveTime > 30000) { // 30秒无活动
                        this.sendToClient(clientInfo.ws, {
                            type: 'ping',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            });
        }, 30000); // 每30秒检查一次
    }
    
    /**
     * 获取连接统计
     */
    getConnectionStats() {
        return {
            ...this.connectionStats,
            activeClientsByShop: Object.fromEntries(
                Array.from(this.shopClients.entries()).map(([shopId, clients]) => [
                    shopId,
                    clients.size
                ])
            )
        };
    }
    
    /**
     * 优雅关闭
     */
    async shutdown() {
        try {
            console.log('🔄 关闭WebSocket管理器...');
            
            // 通知所有客户端即将关闭
            for (const clientInfo of this.clients.values()) {
                if (clientInfo.ws.readyState === 1) {
                    this.sendToClient(clientInfo.ws, {
                        type: 'server_shutdown',
                        message: '服务器即将关闭',
                        timestamp: new Date().toISOString()
                    });
                    clientInfo.ws.close(1001, '服务器关闭');
                }
            }
            
            // 关闭WebSocket服务器
            if (this.wss) {
                this.wss.close();
            }
            
            // 清空连接
            this.clients.clear();
            this.shopClients.clear();
            
            console.log('✅ WebSocket管理器关闭完成');
            
        } catch (error) {
            console.error('关闭WebSocket管理器失败:', error);
            throw error;
        }
    }
    
    /**
     * 创建服务层兼容的WebSocketManager工厂方法
     * @param {Object} server - HTTP服务器
     * @param {Object} services - 服务层对象
     * @param {Object} legacyServices - 兼容旧服务
     */
    static createWithServices(server, services, legacyServices = {}) {
        return new WebSocketManager(server, services, legacyServices);
    }
    
    /**
     * 迁移辅助方法：逐步迁移现有实例到服务层
     * @param {WebSocketManager} existingManager - 现有管理器
     * @param {Object} services - 新服务层对象
     */
    static migrateToServices(existingManager, services) {
        // 注入服务依赖
        existingManager.messageService = services.messageService;
        existingManager.conversationService = services.conversationService;
        existingManager.shopService = services.shopService;
        existingManager.notificationService = services.notificationService;
        existingManager.autoReplyService = services.autoReplyService;
        
        // 更新统计信息
        existingManager.connectionStats.serviceLayerActive = true;
        
        console.log('✅ WebSocketManager 已迁移到服务层架构');
        return existingManager;
    }
}

module.exports = WebSocketManager;