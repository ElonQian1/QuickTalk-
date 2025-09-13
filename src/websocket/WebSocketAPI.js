// WebSocket集成的客服回复API
// 在管理后台发送回复时，自动通过WebSocket推送给用户

/**
 * 在server.js的initializeRoutes函数中添加此API
 * 或者作为独立模块在适当位置注册
 */

function setupWebSocketIntegratedAPI(app, modularApp) {
    // 客服发送回复API - 集成WebSocket推送
    app.post('/api/admin/send-reply', async (req, res) => {
        try {
            const { conversationId, content, senderId, messageType } = req.body;
            
            if (!conversationId || !content) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要参数：conversationId 和 content'
                });
            }
            
            console.log(`📤 客服发送回复: ${conversationId} -> "${content}"`);
            
            // 1. 保存消息到数据库 - 使用正确的方法名和格式
            const messageAdapter = modularApp.getMessageAdapter();
            const result = await messageAdapter.addMessage({
                conversationId,
                senderType: 'admin', // 使用数据库约束允许的值
                senderId: senderId || 'admin',
                content,
                timestamp: new Date().toISOString()
            });
            
            // 2. 解析用户ID（从conversationId中提取）
            const userId = extractUserIdFromConversationId(conversationId);
            
            // 3. 通过WebSocket推送给用户
            let pushed = false;
            if (global.wsManager && userId) {
                pushed = await global.wsManager.pushMessageToUser(userId, content, messageType || 'admin');
            }
            
            // 4. 返回响应
            res.json({
                success: true,
                data: {
                    result,
                    pushed,
                    method: pushed ? 'websocket' : 'offline',
                    timestamp: Date.now(),
                    userId
                }
            });
            
            console.log(`✅ 客服回复已发送: ${conversationId} (WebSocket推送: ${pushed})`);
            
        } catch (error) {
            console.error('❌ 发送客服回复失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    // 批量客服消息API
    app.post('/api/admin/broadcast-message', async (req, res) => {
        try {
            const { shopId, message, messageType = 'system' } = req.body;
            
            if (!shopId || !message) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要参数：shopId 和 message'
                });
            }
            
            // 通过WebSocket广播给店铺所有在线用户
            let sentCount = 0;
            if (global.wsManager) {
                sentCount = await global.wsManager.broadcastToShop(shopId, message, messageType);
            }
            
            res.json({
                success: true,
                data: {
                    sentCount,
                    shopId,
                    message,
                    timestamp: Date.now()
                }
            });
            
            console.log(`📡 店铺广播完成: ${shopId} (${sentCount}个用户收到)`);
            
        } catch (error) {
            console.error('❌ 店铺广播失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    // WebSocket在线状态查询API
    app.get('/api/admin/online-users', (req, res) => {
        try {
            const stats = global.wsManager ? global.wsManager.getStats() : {
                activeConnections: 0,
                shops: []
            };
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('❌ 获取在线状态失败:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    
    console.log('📡 WebSocket集成API已设置:');
    console.log('   POST /api/admin/send-reply - 客服回复(WebSocket推送)');
    console.log('   POST /api/admin/broadcast-message - 店铺广播消息');
    console.log('   GET  /api/admin/online-users - 在线用户状态');
}

/**
 * 从conversationId中提取用户ID
 * 支持多种格式：user_abc123, user_abc123_shop_xyz, etc.
 */
function extractUserIdFromConversationId(conversationId) {
    try {
        // 尝试匹配 user_xxx 格式
        const match = conversationId.match(/user_([^_]+(?:_[^_]+)*)/);
        if (match) {
            return `user_${match[1]}`;
        }
        
        // 如果直接是用户ID格式
        if (conversationId.startsWith('user_')) {
            return conversationId;
        }
        
        console.log(`⚠️ 无法从conversationId提取用户ID: ${conversationId}`);
        return null;
        
    } catch (e) {
        console.error('❌ 提取用户ID失败:', e);
        return null;
    }
}

module.exports = { setupWebSocketIntegratedAPI };
