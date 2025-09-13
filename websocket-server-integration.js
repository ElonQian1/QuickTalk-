// WebSocket服务器支持 - 添加到server.js
// 需要先安装: npm install ws

const WebSocket = require('ws');

// 在现有server.js中添加以下代码：

// 1. 在文件顶部添加WebSocket支持
const http = require('http');
const server = http.createServer(app); // 替换原有的app.listen

// 2. 创建WebSocket服务器
const wss = new WebSocket.Server({ 
    server: server,
    path: '/ws'
});

// 3. WebSocket连接管理
const clients = new Map(); // userId -> WebSocket连接
const shopClients = new Map(); // shopId -> Set<userId>

wss.on('connection', (ws, req) => {
    console.log('🔗 新的WebSocket连接');
    
    ws.isAlive = true;
    ws.userId = null;
    ws.shopId = null;
    ws.authenticated = false;
    
    // 心跳检测
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            await handleWebSocketMessage(ws, data);
        } catch (e) {
            console.error('❌ WebSocket消息解析失败:', e);
            sendError(ws, '消息格式错误');
        }
    });
    
    ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket连接关闭: ${code}`);
        removeClient(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket错误:', error);
        removeClient(ws);
    });
});

async function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'auth':
            // 认证
            if (!data.shopKey || !data.shopId || !data.userId) {
                sendError(ws, '认证信息不完整');
                return;
            }
            
            ws.userId = data.userId;
            ws.shopId = data.shopId;
            ws.shopKey = data.shopKey;
            ws.authenticated = true;
            
            // 注册客户端
            clients.set(data.userId, ws);
            if (!shopClients.has(data.shopId)) {
                shopClients.set(data.shopId, new Set());
            }
            shopClients.get(data.shopId).add(data.userId);
            
            ws.send(JSON.stringify({
                type: 'auth_success',
                message: '认证成功',
                userId: data.userId
            }));
            
            console.log(`✅ 用户认证成功: ${data.userId} (店铺: ${data.shopId})`);
            break;
            
        case 'send_message':
            // 发送消息
            if (!ws.authenticated) {
                sendError(ws, '未认证的连接');
                return;
            }
            
            try {
                // 保存消息到数据库
                await messageAdapter.saveMessage({
                    userId: data.userId,
                    shopId: data.shopId,
                    message: data.message,
                    messageType: 'user',
                    timestamp: new Date().toISOString()
                });
                
                console.log(`📨 用户消息已保存: ${data.userId}`);
                
            } catch (e) {
                console.error('❌ 保存用户消息失败:', e);
                sendError(ws, '消息发送失败');
            }
            break;
            
        default:
            sendError(ws, '未知消息类型: ' + data.type);
    }
}

// 服务器向客户端推送消息（客服回复）
async function pushMessageToUser(userId, message, messageType = 'staff') {
    const ws = clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN && ws.authenticated) {
        try {
            ws.send(JSON.stringify({
                type: 'staff_message',
                message: message,
                messageType: messageType,
                timestamp: Date.now()
            }));
            
            console.log(`📨 客服消息已推送: ${userId}`);
            return true;
            
        } catch (e) {
            console.error('❌ 推送消息失败:', e);
            removeClient(ws);
            return false;
        }
    }
    return false;
}

function sendError(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'error',
            message: message
        }));
    }
}

function removeClient(ws) {
    if (ws.userId) {
        clients.delete(ws.userId);
        
        if (ws.shopId && shopClients.has(ws.shopId)) {
            shopClients.get(ws.shopId).delete(ws.userId);
            
            if (shopClients.get(ws.shopId).size === 0) {
                shopClients.delete(ws.shopId);
            }
        }
    }
}

// 4. 修改客服回复API以支持WebSocket推送
app.post('/api/admin/send-reply', async (req, res) => {
    try {
        const { conversationId, content, senderId, messageType } = req.body;
        
        // 解析用户ID
        const match = conversationId.match(/user_([^_]+(?:_[^_]+)*)/);
        const userId = match ? `user_${match[1]}` : conversationId;
        
        // 保存消息到数据库
        const result = await messageAdapter.saveMessage({
            conversationId,
            content,
            senderId,
            messageType: messageType || 'staff',
            timestamp: new Date().toISOString()
        });
        
        // 通过WebSocket推送给用户
        const pushed = await pushMessageToUser(userId, content);
        
        res.json({ 
            success: true, 
            result,
            pushed, // 是否成功推送
            method: pushed ? 'websocket' : 'offline'
        });
        
        console.log(`📨 客服回复已发送: ${conversationId} (WebSocket: ${pushed})`);
        
    } catch (error) {
        console.error('❌ 发送回复失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. 心跳检测
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

// 6. 启动服务器（替换原有的app.listen）
server.listen(3030, () => {
    console.log('✅ 服务器启动在 http://localhost:3030 (支持WebSocket)');
});

console.log('✅ WebSocket服务器已启动');

// 导出推送函数供其他地方使用
module.exports = { pushMessageToUser };
