# QuickTalk 客服系统 - AI 编码指南

## 🏗️ 架构概览

这是一个模块化的实时客服系统，采用 Node.js + WebSocket + SQLite/内存数据库的架构。

### 核心组件
- **`server.js`**: 主服务器，集成模块化系统和传统组件
- **`src/modules/ModularApp.js`**: 新模块化架构的入口点
- **`src/websocket/WebSocketRouter.js`**: WebSocket 路由和管理
- **`src/database/`**: 数据库抽象层（ShopRepository, MessageAdapter）
- **`static/`**: 前端静态文件（用户界面和管理后台）

## 🔄 开发工作流

### 多终端运行模式 (重要!)
**始终使用独立终端运行不同服务，避免阻塞:**

```bash
# 终端 1: 启动后端服务器（开发模式，支持热加载）
npm run dev  # 使用 nodemon，自动重载

# 终端 2: 运行测试脚本
node test-*.js

# 终端 3: 数据库相关操作
node debug-database.js
node setup-test-data.js
```

### ⚠️ 开发模式重要原则
- **不要重启服务器**: 使用 `npm run dev` 开发模式，支持热加载
- **不要检测服务器状态**: AI代理开发时不需要检查服务器是否启动
- **不要自动重启服务**: 代码修改时让 nodemon 自动处理重载
- **日志获取**: 如果无法获取后端/前台日志，请用户复制日志内容提供给AI代理

### 数据库切换
```bash
# 切换到内存数据库（开发/测试）
npm run db:memory

# 切换到 SQLite 数据库（生产）
npm run db:sqlite
```

## 🔧 项目特定模式

### 双数据库系统
- **`database-sqlite.js`**: 持久化 SQLite 数据库
- **`database-memory.js`**: 内存数据库（测试用）
- 通过 npm scripts 动态切换，修改 `server.js` 中的 require 路径

### WebSocket 通信模式
```javascript
// 客户端连接模式
ws://localhost:3030/ws

// 消息格式标准
{
  type: 'message|join|leave|typing',
  content: 'text',
  userId: 'uuid',
  timestamp: Date.now()
}
```

### 模块化初始化顺序
1. 数据库层 (`database-sqlite` 或 `database-memory`)
2. 仓库层 (`ShopRepository`, `MessageAdapter`)
3. 安全层 (`SecurityManager`)
4. WebSocket 路由 (`WebSocketRouter`)
5. Express 路由集成

## 🧪 测试和调试

### 重要测试文件
- **`test-complete-websocket.js`**: 完整 WebSocket 功能测试
- **`test-message-flow.js`**: 消息流测试
- **`debug-database.js`**: 数据库状态检查
- **`setup-test-data.js`**: 初始化测试数据

### 调试工具
```bash
# 检查数据库结构
node check-database-structure.js

# 调试用户-店铺关系
node debug-user-shops.js

# 测试客户端API
node test-client-api.js
```

## 🔗 集成模式

### 嵌入式客服代码
使用 `integration-code-*.html` 文件生成第三方网站嵌入代码:
- **Smart Polling**: `integration-code-smart-polling.html`
- **WebSocket**: `integration-code-websocket.html`
- **Final Fixed**: `integration-code-final-fixed.html`

### API 端点
```javascript
// 客户端 API
GET  /api/messages/:conversationId  // 获取消息历史
POST /api/send                      // 发送消息
POST /api/connect                   // 建立连接

// 管理端 API
GET  /admin                         // 管理后台
POST /api/admin/login              // 管理员登录
```

## 📱 移动端支持

项目包含专门的移动端模块 (`src/mobile/`), 使用响应式设计适配手机端访问。

## ⚠️ 重要约定

- **开发模式优先**: 使用 `npm run dev` 启动，支持热加载，无需手动重启
- **不要重启服务器**: AI代理开发过程中禁止检测或重启服务器
- **日志处理**: 无法获取后端日志时，请用户复制日志内容提供
- **数据库选择**: 开发用内存库，生产用 SQLite
- **WebSocket 优先**: 实时功能依赖 WebSocket，HTTP API 仅作补充
- **模块化开发**: 新功能添加到 `src/modules/` 而非主 `server.js`