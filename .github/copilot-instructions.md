# QuickTalk 客服系统 - GitHub Copilot 指导文件

## 🚨 **严格技术约束 - 必须遵守** 🚨

**⚠️ 本项目严格禁止使用 Node.js，只允许纯 Rust 后端 + 静态前端架构 ⚠️**

## 📋 项目状态总览

### 🔄 项目移植历史
这是一个完全基于 Rust 的实时客服系统，采用 Axum + WebSocket + SQLite 的纯 Rust 架构。

- **原始版本**: Node.js + Express + WebSocket (已废弃，Git提交: b7c4b19c678a723342223fc002503441b6859ed9)
- **当前版本**: **纯Rust + Axum + WebSocket实现 (强制要求)**
- **迁移时间**: 2025年9月19日
- **迁移数据**: 从旧版数据库成功迁移248条消息、75个会话、3个商店、75个客户

### 🎯 **严格技术约束 (绝对禁止违反)**

#### ❌ **绝对禁止的技术**
- **Node.js** - 任何形式的 Node.js 代码、依赖或运行时
- **npm/yarn** - 任何 Node.js 包管理器
- **Express/Koa** - 任何 Node.js Web 框架
- **Vue.js/React/Angular** - 任何前端框架
- **TypeScript编译** - 任何需要构建步骤的前端技术
- **Webpack/Vite** - 任何前端构建工具

#### ✅ **唯一允许的技术栈**
- **后端**: 100% 纯 Rust + Axum 框架
- **数据库**: SQLite + SQLx (Rust 异步库)
- **前端**: 纯静态 HTML/CSS/JavaScript 文件
- **WebSocket**: Rust 原生 WebSocket 实现
- **启动方式**: 仅允许 `cargo run` 命令

### 🏗️ 当前架构 (纯 Rust)### 后端架构 (100% 纯 Rust)
```
backend/
├── Cargo.toml          # 单一包配置，无多binary
├── src/
│   └── main.rs         # 唯一入口点，包含所有功能
└── quicktalk.sqlite    # SQLite数据库文件
```

### 前端架构 (纯静态文件)
```
static/
├── admin-mobile.html   # 管理后台界面
├── index.html          # 客户服务界面
├── js/                 # 纯 JavaScript 文件 (无构建)
│   ├── mobile-message-manager.js
│   ├── secure-customer-service-sdk.js
│   └── simple-customer-service-sdk.js
├── css/               # 纯 CSS 样式文件
└── assets/           # 静态资源
```

### ⚠️ **严格开发原则 (禁止违反)**

- **🚫 禁止 Node.js**: 绝对不允许运行任何 `node`、`npm`、`yarn` 命令
- **🚫 禁止构建步骤**: 前端文件必须是原生 HTML/CSS/JS，无需编译
- **🚫 禁止多进程**: 只允许单一 `cargo run` 进程启动整个系统
- **✅ 唯一启动方式**: `cd backend && cargo run`
- **✅ 静态文件服务**: 所有前端资源由 Rust 后端直接提供## 🔧 项目特定模式



## 🚀 开发规范### 双数据库系统

- **`database-sqlite.js`**: 持久化 SQLite 数据库

### 数据库架构 (SQLite + SQLx)
- **shops**: 商店信息
- **customers**: 客户信息  
- **conversations**: 对话会话
- **messages**: 消息记录
- **admins**: 管理员账户

## 🚀 **开发规范 (纯 Rust)**

### ⚠️ **严格启动流程**
```bash
# ✅ 唯一正确的启动方式
cd backend && cargo run

# ❌ 绝对禁止的命令
npm start               # 禁止
npm run dev            # 禁止  
node server.js         # 禁止
cargo run --bin *      # 禁止多binary
```

### 服务器URL  
- **主界面**: http://localhost:3030/
- **管理后台**: http://localhost:3030/admin    
- **移动端管理**: http://localhost:3030/mobile/admin  
- **WebSocket**: ws://localhost:3030/ws
- **API健康检查**: http://localhost:3030/api/health

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



### 核心API端点### 模块化初始化顺序

```rust1. 数据库层 (`database-sqlite` 或 `database-memory`)

// 静态文件服务2. 仓库层 (`ShopRepository`, `MessageAdapter`)

### 核心API端点 (纯 Rust 实现)
```rust
// 静态文件服务
GET  /static/*          # 静态资源
GET  /assets/*          # 前端资源
GET  /uploads/*         # 上传文件

// 页面路由
GET  /                  # 主页 (index.html)
GET  /admin             # 管理后台 (admin-mobile.html)
GET  /mobile/admin      # 移动端管理

// API接口
GET  /api/health        # 健康检查
GET  /api/shops         # 商店列表
GET  /api/conversations # 对话列表
POST /api/messages      # 发送消息
GET  /api/conversations/:id/messages # 获取消息
POST /api/upload        # 文件上传
```

## 🧪 **测试和调试 (Rust 环境)**

### ⚠️ **重要提醒: 禁止 Node.js 测试**
```bash
# ❌ 绝对禁止运行的 Node.js 命令
node test-complete-websocket.js    # 禁止
node test-message-flow.js          # 禁止
node debug-database.js             # 禁止
node setup-test-data.js            # 禁止
node check-database-structure.js   # 禁止
node debug-user-shops.js           # 禁止
node test-client-api.js            # 禁止
```

## 🛠️ **开发指导 (纯 Rust)**



### Rust开发约定
- **单文件架构**: 所有代码在 `main.rs` 中，不拆分模块
- **Axum框架**: 使用Axum处理HTTP和WebSocket
- **SQLx数据库**: 使用SQLx + SQLite，支持异步操作
- **错误处理**: 使用Result类型，统一错误响应格式

### 前端开发约定  
- **纯静态**: 不使用构建工具，直接编写HTML/CSS/JS
- **兼容旧版**: 保持与 b7c4b19 版本的API兼容性
- **WebSocket通信**: 使用原有的WebSocket消息格式
- **响应式设计**: 支持桌面端和移动端

### 数据库操作
```rust
// 使用SQLx异步操作
sqlx::query("SELECT * FROM messages WHERE conversation_id = ?")
    .bind(conversation_id)
    .fetch_all(&state.db)
    .await
```

## 🔗 集成模式



### 数据库操作### API 端点

```rust```javascript

// 使用SQLx异步操作// 客户端 API

sqlx::query("SELECT * FROM messages WHERE conversation_id = ?")GET  /api/messages/:conversationId  // 获取消息历史

    .bind(conversation_id)POST /api/send                      // 发送消息

    .fetch_all(&state.db)POST /api/connect                   // 建立连接

    .await

```// 管理端 API

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

## 📊 迁移详情

### 数据迁移映射
```
旧版 (Node.js)           →   新版 (Rust)
================================
messages.user_id        →   customers.id
messages.sender='user'   →   sender_type='customer'  
messages.sender='admin'  →   sender_type='agent'
messages.message        →   content
自动创建conversations表基于shop_id+user_id组合
```

### 迁移统计
- ✅ 248条消息完全迁移
- ✅ 75个对话会话自动创建
- ✅ 75个客户档案建立
- ✅ 3个商店配置保留
- ✅ 2个管理员账户迁移

## 📱 移动端支持
项目包含专门的移动端模块，使用响应式设计适配手机端访问。

## ⚠️ **重要约定 (纯 Rust)**
- **开发模式**: 使用 `cargo run` 启动，Rust 自动编译重载
- **禁止重启**: AI代理开发过程中不检测或重启服务器
- **日志处理**: 无法获取 Rust 后端日志时，请用户复制日志内容
- **单一数据库**: 仅使用 SQLite，无内存数据库选项
- **WebSocket 优先**: 实时功能依赖 WebSocket，HTTP API 仅作补充
- **单体架构**: 新功能在 `main.rs` 实现，不拆分多模块

## ⚠️ **重要约束**

### 绝对禁止
- ❌ 不允许使用 Node.js 任何形式的运行时或依赖
- ❌ 不允许使用多个cargo binary配置
- ❌ 不允许使用Vue.js、React等前端框架
- ❌ 不允许使用npm/yarn构建工具
- ❌ 不允许修改为微服务架构

### 必须遵循
- ✅ 使用单一 `cargo run` 命令启动
- ✅ 保持纯Rust + 静态文件架构
- ✅ 维护与旧版前端的兼容性
- ✅ 所有功能在单个main.rs文件实现

## 🧪 测试验证

### 功能测试
```bash
# 启动服务器
cd backend && cargo run

# 验证API
curl http://localhost:3030/api/health
curl http://localhost:3030/api/conversations

# 验证前端
# 访问 http://localhost:3030/admin
```

### 数据库验证
```bash
cd backend
sqlite3 quicktalk.sqlite "SELECT COUNT(*) FROM messages"  # 应返回248
sqlite3 quicktalk.sqlite "SELECT COUNT(*) FROM conversations" # 应返回75
```

## 📞 支持信息

- **项目类型**: 纯Rust客服系统
- **技术栈**: Rust + Axum + SQLite + 静态HTML
- **启动方式**: `cargo run` (唯一方式)
- **端口**: 3030
- **数据迁移**: 从b7c4b19完成
- **前端**: 静态文件，无构建步骤

---
*最后更新: 2025年9月21日 - 强化纯Rust架构约束，完全禁止Node.js*