# 🚀 实时客服系统集成指南

## 📋 快速集成方法

### 方法一：替换现有客服代码（推荐）

直接用以下代码替换您朋友网站上的原有客服代码：

```html
<style>
.viewport-nav{outline:#000;position:fixed;right:40px;bottom:40px;z-index:999999}
.viewport-nav .nav-box{background:rgba(0,0,0,.8);border-radius:100%;text-align:center;margin:15px 0;width:100px;height:100px;line-height:100px;box-shadow:0 0 5px 2px rgba(255,255,255,.5)}
.viewport-nav .nav-box p{padding:0 1px;font-size:31px;color:#fff;white-space:normal;font-weight:700}
.viewport-nav .nav-box#cb{position:relative;cursor:pointer}
.viewport-nav .nav-box .nav-dabaowei,.viewport-nav .nav-box .nav-sxsx{font-size:24px}

/* 实时客服聊天窗口样式 */
.customer-service-chat {
    position: fixed;
    bottom: 160px;
    right: 40px;
    width: 380px;
    height: 520px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    display: none;
    flex-direction: column;
    z-index: 999998;
    overflow: hidden;
    transform: scale(0);
    transform-origin: bottom right;
    transition: all 0.3s ease;
}

.customer-service-chat.open {
    display: flex;
    transform: scale(1);
}

.customer-service-chat.minimized {
    height: 60px;
}

.customer-service-chat.minimized .chat-body,
.customer-service-chat.minimized .chat-input-area,
.customer-service-chat.minimized .connection-status {
    display: none;
}

/* 聊天窗口头部 */
.chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.chat-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
}

.chat-controls {
    display: flex;
    gap: 10px;
}

.chat-controls button {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.3s;
}

.chat-controls button:hover {
    background: rgba(255,255,255,0.3);
}

/* 聊天内容区域 */
.chat-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

.chat-messages {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 15px;
    background: #fafbfc;
}

.chat-messages::-webkit-scrollbar {
    width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
    background: #f1f1f1;
}

.chat-messages::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
}

/* 消息样式 */
.message {
    display: flex;
    flex-direction: column;
    margin-bottom: 10px;
}

.message-text {
    padding: 12px 16px;
    border-radius: 18px;
    max-width: 80%;
    word-wrap: break-word;
    line-height: 1.4;
}

.message-time {
    font-size: 11px;
    color: #999;
    margin-top: 5px;
    text-align: center;
}

.system-message .message-text {
    background: #f0f0f0;
    color: #666;
    align-self: center;
    text-align: center;
    font-size: 13px;
}

.user-message {
    align-items: flex-end;
}

.user-message .message-text {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    align-self: flex-end;
}

.user-message .message-time {
    text-align: right;
}

.staff-message {
    align-items: flex-start;
}

.staff-message .message-text {
    background: #f8f9fa;
    color: #333;
    border: 1px solid #e9ecef;
    align-self: flex-start;
}

.staff-message .message-time {
    text-align: left;
}

/* 输入区域 */
.chat-input-area {
    padding: 15px 20px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
    background: white;
}

.chat-input {
    flex: 1;
    padding: 10px 15px;
    border: 1px solid #ddd;
    border-radius: 20px;
    outline: none;
    font-size: 14px;
    font-family: inherit;
}

.chat-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.chat-send-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
}

.chat-send-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.chat-send-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}

/* 连接状态 */
.connection-status {
    padding: 8px 20px;
    background: #f8f9fa;
    border-top: 1px solid #eee;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
}

.status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}

.status-connected {
    background: #28a745;
    animation: pulse 2s infinite;
}

.status-disconnected {
    background: #dc3545;
}

.status-connecting {
    background: #ffc107;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

/* 响应式设计 */
@media (max-width: 768px) {
    .customer-service-chat {
        width: calc(100vw - 20px);
        right: 10px;
        left: 10px;
        bottom: 160px;
    }
    
    .viewport-nav {
        bottom: 20px;
        right: 20px;
    }
}
</style>

<div class="viewport-nav">
    <ul>
        <li><div class="nav-box"><p>登入</p></div></li>
        <li><div class="nav-box"><p>注册</p></div></li>
        <li>
            <div class="nav-box animate__animated animate__backInLeft" id="cb">
                <a onclick="toggleCustomerService()">
                    <p class="animate__animated animate__infinite animate__heartBeat">客服</p>
                </a>
            </div>
        </li>
        <li><div class="nav-box"><p>优惠</p></div></li>
    </ul>
</div>

<!-- 实时客服聊天窗口 -->
<div class="customer-service-chat" id="customer-service-chat">
    <div class="chat-header">
        <h3>在线客服</h3>
        <div class="chat-controls">
            <button onclick="minimizeCustomerService()">−</button>
            <button onclick="closeCustomerService()">×</button>
        </div>
    </div>
    <div class="chat-body">
        <div class="chat-messages" id="chat-messages">
            <div class="message system-message">
                <span class="message-text">欢迎使用在线客服，请问有什么可以帮助您的吗？</span>
                <span class="message-time" id="welcome-time"></span>
            </div>
        </div>
        <div class="chat-input-area">
            <input type="text" class="chat-input" id="chat-input" placeholder="请输入您的消息..." onkeypress="handleChatKeyPress(event)">
            <button class="chat-send-btn" id="chat-send-btn" onclick="sendChatMessage()">发送</button>
        </div>
    </div>
    <div class="connection-status">
        <span class="status-indicator" id="status-indicator"></span>
        <span id="status-text">连接中...</span>
    </div>
</div>

<!-- 引入实时客服JavaScript文件 -->
<script src="http://您的服务器地址:3030/realtime-customer-service.js"></script>
```

### 方法二：简单引入JavaScript文件

如果您不想修改太多代码，只需在您朋友网站的 `</body>` 标签前添加：

```html
<script>
// 配置您的WebSocket服务器地址
window.CUSTOMER_SERVICE_CONFIG = {
    wsUrl: 'ws://您的服务器地址:3030/ws'
};
</script>
<script src="http://您的服务器地址:3030/realtime-customer-service.js"></script>
<script>
// 修改原有的客服按钮点击事件
document.addEventListener('DOMContentLoaded', function() {
    const customerServiceBtn = document.querySelector('#cb');
    if (customerServiceBtn) {
        customerServiceBtn.onclick = toggleCustomerService;
    }
});
</script>
```

## ⚙️ 配置说明

### 必须修改的配置项

1. **WebSocket服务器地址**：
   - 将代码中的 `ws://localhost:3030/ws` 改为您的实际服务器地址
   - 例如：`ws://您的域名:3030/ws` 或 `ws://您的IP:3030/ws`

2. **服务器部署**：
   - 确保您的Node.js服务器正在运行
   - 确保端口3030没有被防火墙阻挡
   - 如果是HTTPS网站，需要使用WSS协议

### 可选配置项

您可以修改以下配置来自定义外观和行为：

```javascript
const CONFIG = {
    // WebSocket服务器地址
    wsUrl: 'ws://您的服务器地址:3030/ws',
    
    // 样式配置
    position: 'bottom-right', // 位置：bottom-right, bottom-left, top-right, top-left
    zIndex: 999999, // 层级
    
    // 功能配置
    autoConnect: true, // 自动连接
    showWelcomeMessage: true, // 显示欢迎消息
    
    // 文本配置
    texts: {
        welcome: '欢迎使用在线客服，请问有什么可以帮助您的吗？',
        placeholder: '请输入您的消息...',
        sendButton: '发送',
        title: '在线客服'
    }
};
```

## 🧪 测试步骤

1. **部署您的服务器**：
   ```bash
   cd 论坛客服项目
   npm start
   ```

2. **修改WebSocket地址**：
   - 将代码中的 `localhost:3030` 改为您的实际服务器地址

3. **替换客服代码**：
   - 用提供的代码替换原有的客服代码

4. **测试功能**：
   - 点击客服按钮查看是否弹出聊天窗口
   - 发送消息测试是否能收到自动回复
   - 在客服后台测试是否能看到用户消息和回复

## 📋 部署检查清单

- [ ] Node.js服务器正常运行
- [ ] 端口3030可访问
- [ ] WebSocket地址配置正确
- [ ] 客服按钮点击事件正确绑定
- [ ] 聊天窗口样式显示正常
- [ ] 消息发送和接收功能正常
- [ ] 客服后台能正常管理对话

## 🎯 注意事项

1. **跨域问题**：如果网站和服务器不在同一域名，需要配置CORS
2. **HTTPS支持**：如果网站使用HTTPS，WebSocket也需要使用WSS协议
3. **防火墙**：确保服务器端口没有被防火墙阻挡
4. **浏览器兼容性**：支持现代浏览器，IE需要polyfill

## 🔧 故障排除

如果遇到问题，请检查：
1. 浏览器开发者工具的控制台是否有错误信息
2. Network标签页是否显示WebSocket连接失败
3. 服务器日志是否有错误信息
4. 防火墙和网络配置是否正确
