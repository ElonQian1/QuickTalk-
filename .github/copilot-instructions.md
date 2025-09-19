# QuickTalk 客服系统 - GitHub Copilot 指导文件# QuickTalk 客服系统 - AI 编码指南



## 📋 项目状态总览## 🏗️ 架构概览



### 🔄 项目移植历史这是一个模块化的实时客服系统，采用 Node.js + WebSocket + SQLite/内存数据库的架构。

- **原始版本**: Node.js + Express + WebSocket (Git提交: b7c4b19c678a723342223fc002503441b6859ed9)

- **当前版本**: 纯Rust + Axum + WebSocket实现### 核心组件

- **迁移时间**: 2025年9月19日- **`server.js`**: 主服务器，集成模块化系统和传统组件

- **迁移数据**: 从旧版数据库成功迁移248条消息、75个会话、3个商店、75个客户- **`src/modules/ModularApp.js`**: 新模块化架构的入口点

- **`src/websocket/WebSocketRouter.js`**: WebSocket 路由和管理

### 🎯 项目约束和规则- **`src/database/`**: 数据库抽象层（ShopRepository, MessageAdapter）

- **严格约束**: 只能使用 Rust + 静态HTML文件，禁止使用Vue.js/React等前端框架- **`static/`**: 前端静态文件（用户界面和管理后台）

- **单一入口点**: 使用 `cargo run` 启动，不允许多个 `--bin` 参数

- **纯Rust后端**: 完全摒弃Node.js依赖，所有API用Rust实现## 🔄 开发工作流

- **静态前端**: 使用从 b7c4b19 版本恢复的静态HTML/CSS/JS文件

### 多终端运行模式 (重要!)

## 🏗️ 当前架构**始终使用独立终端运行不同服务，避免阻塞:**



### 后端架构 (Rust)```bash

```# 终端 1: 启动后端服务器（开发模式，支持热加载）

backend/npm run dev  # 使用 nodemon，自动重载

├── Cargo.toml          # 单一包配置，无多binary

├── src/# 终端 2: 运行测试脚本

│   └── main.rs         # 唯一入口点，包含所有功能node test-*.js

└── quicktalk.sqlite    # 迁移后的SQLite数据库

```# 终端 3: 数据库相关操作

node debug-database.js

### 前端架构 (静态文件)node setup-test-data.js

``````

static/

├── admin-mobile.html   # 管理后台界面### ⚠️ 开发模式重要原则

├── index.html          # 客户服务界面  - **不要重启服务器**: 使用 `npm run dev` 开发模式，支持热加载

├── js/                 # JavaScript SDK和组件- **不要检测服务器状态**: AI代理开发时不需要检查服务器是否启动

│   ├── mobile-message-manager.js- **不要自动重启服务**: 代码修改时让 nodemon 自动处理重载

│   ├── secure-customer-service-sdk.js- **日志获取**: 如果无法获取后端/前台日志，请用户复制日志内容提供给AI代理

│   └── simple-customer-service-sdk.js

├── css/               # 样式文件### 数据库切换

└── assets/           # 静态资源```bash

```# 切换到内存数据库（开发/测试）

npm run db:memory

### 数据库Schema (SQLite)

- **shops**: 商店信息# 切换到 SQLite 数据库（生产）

- **customers**: 客户信息npm run db:sqlite

- **conversations**: 对话会话```

- **messages**: 消息记录  

- **admins**: 管理员账户## 🔧 项目特定模式



## 🚀 开发规范### 双数据库系统

- **`database-sqlite.js`**: 持久化 SQLite 数据库

### 启动命令- **`database-memory.js`**: 内存数据库（测试用）

```bash- 通过 npm scripts 动态切换，修改 `server.js` 中的 require 路径

# 正确启动方式 (唯一方式)

cd backend && cargo run### WebSocket 通信模式

```javascript

# 错误方式 (禁止使用)// 客户端连接模式

cargo run --bin quicktalk-rust     # ❌ 不允许ws://localhost:3030/ws

cargo run --bin quicktalk-standalone # ❌ 不允许

```// 消息格式标准

{

### 服务器URL  type: 'message|join|leave|typing',

- **主界面**: http://localhost:3030/  content: 'text',

- **管理后台**: http://localhost:3030/admin    userId: 'uuid',

- **移动端管理**: http://localhost:3030/mobile/admin  timestamp: Date.now()

- **WebSocket**: ws://localhost:3030/ws}

- **API健康检查**: http://localhost:3030/api/health```



### 核心API端点### 模块化初始化顺序

```rust1. 数据库层 (`database-sqlite` 或 `database-memory`)

// 静态文件服务2. 仓库层 (`ShopRepository`, `MessageAdapter`)

GET  /static/*          # 静态资源3. 安全层 (`SecurityManager`)

GET  /assets/*          # 前端资源4. WebSocket 路由 (`WebSocketRouter`)

GET  /uploads/*         # 上传文件5. Express 路由集成



// 页面路由## 🧪 测试和调试

GET  /                  # 主页 (index.html)

GET  /admin             # 管理后台 (admin-mobile.html)### 重要测试文件

GET  /mobile/admin      # 移动端管理- **`test-complete-websocket.js`**: 完整 WebSocket 功能测试

- **`test-message-flow.js`**: 消息流测试

// API接口- **`debug-database.js`**: 数据库状态检查

GET  /api/health        # 健康检查- **`setup-test-data.js`**: 初始化测试数据

GET  /api/shops         # 商店列表

GET  /api/conversations # 对话列表### 调试工具

POST /api/messages      # 发送消息```bash

GET  /api/conversations/:id/messages # 获取消息# 检查数据库结构

POST /api/upload        # 文件上传node check-database-structure.js

```

# 调试用户-店铺关系

## 🛠️ 开发指导node debug-user-shops.js



### Rust开发约定# 测试客户端API

- **单文件架构**: 所有代码在 `main.rs` 中，不拆分模块node test-client-api.js

- **Axum框架**: 使用Axum处理HTTP和WebSocket```

- **SQLx数据库**: 使用SQLx + SQLite，支持异步操作

- **错误处理**: 使用Result类型，统一错误响应格式## 🔗 集成模式



### 前端开发约定  ### 嵌入式客服代码

- **纯静态**: 不使用构建工具，直接编写HTML/CSS/JS使用 `integration-code-*.html` 文件生成第三方网站嵌入代码:

- **兼容旧版**: 保持与 b7c4b19 版本的API兼容性- **Smart Polling**: `integration-code-smart-polling.html`

- **WebSocket通信**: 使用原有的WebSocket消息格式- **WebSocket**: `integration-code-websocket.html`

- **响应式设计**: 支持桌面端和移动端- **Final Fixed**: `integration-code-final-fixed.html`



### 数据库操作### API 端点

```rust```javascript

// 使用SQLx异步操作// 客户端 API

sqlx::query("SELECT * FROM messages WHERE conversation_id = ?")GET  /api/messages/:conversationId  // 获取消息历史

    .bind(conversation_id)POST /api/send                      // 发送消息

    .fetch_all(&state.db)POST /api/connect                   // 建立连接

    .await

```// 管理端 API

GET  /admin                         // 管理后台

## 📊 迁移详情POST /api/admin/login              // 管理员登录

```

### 数据迁移映射

```## 📱 移动端支持

旧版 (Node.js)           →   新版 (Rust)

================================项目包含专门的移动端模块 (`src/mobile/`), 使用响应式设计适配手机端访问。

messages.user_id        →   customers.id

messages.sender='user'   →   sender_type='customer'  ## ⚠️ 重要约定

messages.sender='admin'  →   sender_type='agent'

messages.message        →   content- **开发模式优先**: 使用 `npm run dev` 启动，支持热加载，无需手动重启

自动创建conversations表基于shop_id+user_id组合- **不要重启服务器**: AI代理开发过程中禁止检测或重启服务器

```- **日志处理**: 无法获取后端日志时，请用户复制日志内容提供

- **数据库选择**: 开发用内存库，生产用 SQLite

### 迁移统计- **WebSocket 优先**: 实时功能依赖 WebSocket，HTTP API 仅作补充

- ✅ 248条消息完全迁移- **模块化开发**: 新功能添加到 `src/modules/` 而非主 `server.js`
- ✅ 75个对话会话自动创建
- ✅ 75个客户档案建立
- ✅ 3个商店配置保留
- ✅ 2个管理员账户迁移

## ⚠️ 重要约束

### 绝对禁止
- ❌ 不允许使用多个cargo binary配置
- ❌ 不允许使用Vue.js、React等前端框架
- ❌ 不允许使用Node.js或npm构建工具
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
*最后更新: 2025年9月19日 - 数据库迁移完成，单binary配置生效*