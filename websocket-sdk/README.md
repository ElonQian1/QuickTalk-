# Customer Service WebSocket SDK

供独立站前端集成的客服聊天 SDK。

## 安装

```bash
npm install customer-service-sdk
```

## 使用方法

### 基本使用

```javascript
import { createCustomerServiceSDK } from 'customer-service-sdk';

const sdk = createCustomerServiceSDK({
  serverUrl: 'ws://localhost:8080',
  apiKey: 'your-shop-api-key',
  customerId: 'unique-customer-id',
  customerName: '客户姓名',
  customerEmail: 'customer@example.com'
});

// 连接到服务器
await sdk.connect();

// 监听消息
sdk.on('message', (message) => {
  console.log('收到消息:', message);
});

// 发送消息
sdk.sendMessage('你好，我需要帮助');
```

### 事件监听

```javascript
// 连接状态
sdk.on('connected', () => {
  console.log('已连接到客服系统');
});

sdk.on('disconnected', () => {
  console.log('与客服系统断开连接');
});

// 消息相关
sdk.on('message', (message) => {
  console.log('新消息:', message);
});

sdk.on('typing', (data) => {
  console.log('客服正在输入...', data.isTyping);
});

// 客服状态
sdk.on('staffOnline', () => {
  console.log('客服上线了');
});

sdk.on('staffOffline', () => {
  console.log('客服离线了');
});

// 错误处理
sdk.on('error', (error) => {
  console.error('连接错误:', error);
});
```

### 发送不同类型的消息

```javascript
// 文本消息
sdk.sendMessage('你好');

// 图片消息
sdk.sendMessage('', 'image', 'https://example.com/image.jpg');

// 文件消息
sdk.sendMessage('文件名.pdf', 'file', 'https://example.com/file.pdf');
```

### 获取历史消息

```javascript
try {
  const messages = await sdk.getMessageHistory(20, 0);
  console.log('历史消息:', messages);
} catch (error) {
  console.error('获取历史消息失败:', error);
}
```

### 完整示例

```html
<!DOCTYPE html>
<html>
<head>
    <title>客服聊天</title>
</head>
<body>
    <div id="chat-container">
        <div id="messages"></div>
        <input type="text" id="message-input" placeholder="输入消息...">
        <button onclick="sendMessage()">发送</button>
    </div>

    <script src="path/to/customer-service-sdk.js"></script>
    <script>
        const sdk = createCustomerServiceSDK({
            serverUrl: 'ws://localhost:8080',
            apiKey: 'your-shop-api-key',
            customerId: 'customer-' + Date.now(),
            customerName: '匿名用户'
        });

        // 初始化聊天
        async function initChat() {
            try {
                await sdk.connect();
                
                // 监听消息
                sdk.on('message', displayMessage);
                sdk.on('connected', () => {
                    console.log('连接成功');
                });
                
            } catch (error) {
                console.error('连接失败:', error);
            }
        }

        // 显示消息
        function displayMessage(message) {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.textContent = `${message.senderType === 'staff' ? '客服' : '我'}: ${message.content}`;
            messagesDiv.appendChild(messageDiv);
        }

        // 发送消息
        function sendMessage() {
            const input = document.getElementById('message-input');
            const message = input.value.trim();
            
            if (message) {
                sdk.sendMessage(message);
                displayMessage({
                    content: message,
                    senderType: 'customer'
                });
                input.value = '';
            }
        }

        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', initChat);

        // 页面关闭时断开连接
        window.addEventListener('beforeunload', () => {
            sdk.disconnect();
        });
    </script>
</body>
</html>
```

## API 参考

### SDK 配置 (SDKConfig)

- `serverUrl`: WebSocket 服务器地址
- `apiKey`: 店铺 API 密钥
- `customerId`: 客户唯一标识
- `customerName`: 客户姓名（可选）
- `customerEmail`: 客户邮箱（可选）
- `customerAvatar`: 客户头像（可选）
- `reconnectInterval`: 重连间隔，默认 3000ms
- `maxReconnectAttempts`: 最大重连次数，默认 5 次

### 方法

- `connect()`: 连接到服务器
- `disconnect()`: 断开连接
- `sendMessage(content, messageType?, fileUrl?)`: 发送消息
- `sendTyping(isTyping)`: 发送打字状态
- `getMessageHistory(limit?, offset?)`: 获取历史消息
- `on(eventType, listener)`: 添加事件监听器
- `off(eventType, listener?)`: 移除事件监听器
- `isConnected()`: 检查连接状态
- `getSessionId()`: 获取当前会话ID

### 事件类型

- `connected`: 连接成功
- `disconnected`: 连接断开
- `message`: 收到新消息
- `typing`: 打字状态变化
- `staffOnline`: 客服上线
- `staffOffline`: 客服离线
- `error`: 发生错误
- `reconnecting`: 重连中