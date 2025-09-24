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


#### ✅ **唯一允许的技术栈**
- **后端**: 100% 纯 Rust + Axum 框架
- **数据库**: SQLite + SQLx (Rust 异步库)
- **前端**: 纯静态 HTML/CSS/JavaScript 文件
- **WebSocket**: Rust 原生 WebSocket 实现
- **启动方式**: 仅允许 `cargo run` 命令

### 🏗️ 当前架构 (纯 Rust)
### 后端架构（100% 纯 Rust，单入口 + 模块化）
```
backend/
├── Cargo.toml              # 单一包配置（仅一个 binary）
├── src/
│   ├── main.rs            # 唯一入口点（启动与路由装配）
│   ├── api/               # HTTP/WebSocket 处理模块
│   │   ├── mod.rs
│   │   ├── health.rs
│   │   ├── shops.rs
│   │   ├── conversations.rs
│   │   ├── messages.rs
│   │   ├── uploads.rs
│   │   └── ws.rs
│   ├── db/                # 数据库/仓库/模型
│   │   ├── mod.rs
│   │   ├── models.rs
│   │   ├── migrations.rs
│   │   └── repos.rs
│   ├── domain/            # 业务领域与服务
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   └── message_service.rs
│   ├── web/               # 静态文件服务与页面
│   │   ├── mod.rs
│   │   └── static_serving.rs
│   └── telemetry.rs       # 日志/追踪/错误处理
└── quicktalk.sqlite        # SQLite 数据库文件
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





### 模块化初始化顺序（推荐）

1. 数据库层（db::migrations 自动建表/迁移，SQLx/SQLite）
2. 仓库层（db::repos 定义仓库接口与 SQL 查询）
3. 领域服务（domain::* 封装业务逻辑）
4. API 路由装配（api::* 将路由与处理器注册到 Axum）
5. 静态文件服务与页面路由（web::static_serving）

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

### Rust 开发约定
- **单入口 + 模块化**: 仅一个 binary（`main.rs` 作为入口），其余代码按领域拆分在 `src/` 子模块中
- **Axum 框架**: 使用 Axum 处理 HTTP 和 WebSocket
- **SQLx 数据库**: 使用 SQLx + SQLite，支持异步操作
- **错误处理**: 使用 Result 类型，统一错误响应格式

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

## 🧭 DDD 架构规范（Domain-Driven Design）
（新增于 2025-09-24，采用增量方式：新代码遵循，旧逻辑逐步迁移）

#### 分层语义对照
| 层 | 目录 | 职责 | 关键约束 |
|----|------|------|----------|
| 接口层 Interface | `api/`, `web/` | 适配 HTTP/WS、DTO、输入校验、序列化 | 不含业务规则，不直接 SQL |
| 应用层 Application | `application/` 或 `domain/usecases/` | 用例编排、事务/授权、聚合加载与保存、事件触发 | 不写核心领域规则，不含 SQL |
| 领域层 Domain | `domain/` | 实体/值对象/聚合/领域服务/事件/不变式 | 无 Axum/SQLx 依赖，纯业务 |
| 基础设施层 Infrastructure | `db/` | Repository 实现、SQLx 查询、外部适配 | 不放业务规则，只实现接口 |
| 防腐层 ACL | `integration/` (按需) | 旧系统/第三方数据结构与领域模型转换 | 不污染领域命名 |

#### 战术建模元素
Entity / Value Object / Aggregate / Repository / Domain Service / Application Service / Domain Event / ACL。

#### 目录建议 (示例)
```
src/
  domain/
    conversation/{conversation.rs,message.rs,events.rs}
    shared/{ids.rs,errors.rs}
    services/agent_assignment.rs
  application/send_message.rs
  db/repos.rs
```

#### ID 强类型
使用 newtype: `pub struct ConversationId(pub i64);` 禁止裸 `i64` / `String` 代表业务标识。

#### 聚合不变式示例
```rust
impl Conversation {
    pub fn append_message(&mut self, msg: Message) -> Result<(), DomainError> {
        if msg.content.is_empty() { return Err(DomainError::EmptyMessage); }
        self.messages.push(msg);
        Ok(())
    }
}
```

#### Repository 接口
```rust
pub trait ConversationRepository {
    async fn find(&self, id: ConversationId) -> Result<Option<Conversation>, RepoError>;
    async fn save(&self, agg: &Conversation) -> Result<(), RepoError>;
}
```

#### 应用用例模式
```rust
pub struct SendMessageUseCase<R: ConversationRepository> { repo: R }
impl<R: ConversationRepository> SendMessageUseCase<R> {
    pub async fn exec(&self, input: SendMessageInput) -> Result<SendMessageOutput, UseCaseError> {
        let mut conv = self.repo.find(input.conversation_id).await?\
            .ok_or(UseCaseError::NotFound)?;
        conv.append_message(Message::new(input.sender, input.content))?;
        self.repo.save(&conv).await?;
        Ok(SendMessageOutput { /* ... */ })
    }
}
```

#### 领域事件策略
短期：聚合收集事件 -> 用例收尾派发 (内存)。未来可抽象 EventBus（仍单体，不引入 MQ）。

#### 错误分层
| 层 | 类型 | 映射 |
|----|------|------|
| 领域 | DomainError | 400 |
| 仓库 | RepoError(NotFound) | 404 |
| 用例 | UseCaseError | 400/404/500 |
| 接口 | ApiError | 统一 HTTP |

#### 防腐层 (ACL)
旧 Node.js 结构转换集中 `integration/legacy_mapping.rs`；领域模型禁止出现 `legacy_*` 字段。

#### 测试金字塔
1. 领域（纯内存） 2. 用例（InMemoryRepo） 3. 仓库（最小 SQLx 集成） 4. API（关键路径） 5. 事件（顺序与触发）。

#### 迁移阶段
1. 新建 `Conversation` 聚合 + ID newtype。 2. 抽 Repository 接口。 3. 建首个 UseCase。 4. 加事件收集机制。 5. 迁移 handler 逻辑。 6. 补测试。

#### 审核清单 (PR)
- [ ] ID 使用 newtype
- [ ] 不变式位于聚合方法内部
- [ ] Handler 仅调用 use case
- [ ] 领域层无 SQL/Axum 依赖
- [ ] 测试覆盖新增逻辑
- [ ] 未引入被禁止技术

#### 重构对比
Before：Handler = SQL + 规则 + 推送。
After：Handler -> UseCase -> 聚合方法 -> Repository.save -> 事件派发。

#### 后续可选增强
读模型投影、内存 EventBus 抽象、跨聚合 Saga（仍单体）。

---
DDD 规范版本 v1 (2025-09-24)

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
- **单体架构**: 仅一个 binary；代码组织采用模块化（`src/` 多文件/子文件夹），禁止拆分为多 binary 或多进程

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
- ✅ 仅 `main.rs` 作为入口；业务与路由等实现应分布在 `src/` 模块中

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