# QuickTalk 纯Rust客服系统

> 🦀 **完全使用Rust开发的高性能客服系统，无Node.js依赖，符合纯Rust部署环境要求**

<!-- 新增: 2025-09-24 清理说明开始 -->
> ℹ️ **2025-09-24 结构更新**: 已彻底移除残留的 Node.js 旧版代码 (`services/nodejs/`)、归档旧数据库文件 `data/database/database.sqlite` → `data/archive/database-LEGACY.sqlite`，并将根目录零散报告文档迁移至 `docs/reports/`。当前仓库已实现 100% 纯 Rust + 静态资源结构。若在历史分支或缓存中仍看到 Node.js 相关文件，请进行一次 `git pull --prune` 并清理本地未跟踪目录。
<!-- 新增: 2025-09-24 清理说明结束 -->

## 🎯 项目特点

- **🦀 纯Rust架构** - 零Node.js依赖，单一可执行文件部署
- **⚡ 高性能** - 基于Tokio异步运行时，内存安全保证
- **🔌 实时通信** - 原生WebSocket支持，低延迟双向通信
- **💾 轻量数据库** - 内置SQLite，无需额外数据库服务
- **📱 响应式界面** - 现代化Web界面，支持移动端
- **🛡️ 安全可靠** - Rust语言级别的内存安全和并发安全

## 🏗️ 技术栈

### 后端 (Rust)
- **Web框架**: Axum + Tokio
- **数据库**: SQLx + SQLite
- **WebSocket**: 原生Axum WebSocket
- **文件处理**: Tower-HTTP
- **日志**: Tracing + tracing-subscriber
- **序列化**: Serde + serde_json

### 前端
- **界面**: 纯HTML/CSS/JavaScript
- **样式**: 现代CSS Grid + Flexbox
- **交互**: 原生JavaScript + WebSocket API
- **设计**: 响应式设计，支持移动端

## 🚀 快速开始

### 环境要求
- Rust 1.70+ 
- Cargo (Rust包管理器)

### 编译和运行

```bash
# 克隆仓库
git clone <repository-url>
cd QuickTalk-

# 进入后端目录
cd backend

# 编译Release版本
cargo build --release

# 运行服务器
cargo run --release

# 或直接运行编译后的可执行文件
./target/release/quicktalk-pure-rust
```

### 访问应用

服务器启动后，访问以下地址：

- **主页**: http://localhost:3030/
- **管理后台**: http://localhost:3030/admin
- **API健康检查**: http://localhost:3030/api/health
- **WebSocket**: ws://localhost:3030/ws

## 📂 项目结构 (已清理)

```
QuickTalk-/
├── backend/                     # Rust后端核心 (Axum + SQLx)
│   ├── src/                     # 模块化源代码（DDD 渐进迁移中）
│   ├── quicktalk.sqlite         # 运行时主数据库文件 (唯一生产数据源)
│   └── Cargo.toml
├── static/                      # 纯静态前端资源 (HTML/CSS/JS/资产)
├── data/
│   ├── archive/                 # 归档的历史/迁移数据
│   │   └── database-LEGACY.sqlite
│   └── (其余数据脚本/补充数据)
├── uploads/                     # 用户上传文件目录
├── docs/
│   ├── reports/                 # 历史修复与交付报告 (已整理)
│   └── *.md                     # 设计/部署/架构文档
├── devops/                      # 部署脚本 (systemd / docker / shell)
├── scripts/                     # 仅与纯 Rust 流程兼容的维护脚本
├── logs/                        # 运行日志（可忽略/日志轮转策略待定）
└── README-RUST-PURE.md          # 当前文件
```

### ✅ 已移除/禁止的内容
- ❌ 旧版 Node.js 服务目录 (`services/nodejs/`) —— 已删除
- ❌ 根级 `package.json` / `server.js`（历史遗留） —— 已移除（若仍存在请检查分支或本地缓存）
- ❌ 任何构建型前端工具链（Webpack、Vite、Babel 等）

### 🗃️ 数据库文件说明
| 角色 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 主运行数据库 | `backend/quicktalk.sqlite` | 使用中 | 系统唯一权威数据源 |
| 旧迁移归档 | `data/archive/database-LEGACY.sqlite` | 只读保留 | 历史参考，不再写入 |

> 如果你正在编写脚本或部署配置，请统一指向: `sqlite:backend/quicktalk.sqlite`

---

## 🔧 配置

### 环境变量 (.env)

```bash
# 数据库配置
DATABASE_URL=sqlite:../data/database.sqlite

# 服务器配置  
PORT=3030
HOST=0.0.0.0

# 日志级别
RUST_LOG=info
```

### 编译配置

```toml
# Cargo.toml 主要依赖
[dependencies]
axum = { version = "0.7", features = ["ws", "multipart", "macros"] }
tokio = { version = "1.0", features = ["full"] }
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "sqlite", "chrono", "uuid"] }
serde = { version = "1.0", features = ["derive"] }
tower-http = { version = "0.5", features = ["cors", "fs", "trace"] }
```

## 📡 API 接口

### RESTful API

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/shops` | 获取商店列表 |
| POST | `/api/shops` | 创建新商店 |
| GET | `/api/conversations` | 获取对话列表 |
| POST | `/api/conversations` | 创建新对话 |
| GET | `/api/conversations/:id/messages` | 获取对话消息 |
| POST | `/api/messages` | 发送新消息 |
| POST | `/api/upload` | 文件上传 |
| GET | `/api/files` | 文件列表 |

### WebSocket API

连接地址: `ws://localhost:3030/ws`

#### 消息格式
```json
{
  "msg_type": "message|join|leave|typing",
  "conversation_id": "uuid",
  "sender_id": "uuid", 
  "content": "消息内容",
  "timestamp": "2023-09-18T10:00:00Z"
}
```

#### 示例消息
```json
// 发送消息
{
  "msg_type": "message",
  "conversation_id": "conv-123",
  "sender_id": "user-456",
  "content": "Hello from Rust!",
  "timestamp": "2023-09-18T10:00:00Z"
}

// 加入对话
{
  "msg_type": "join", 
  "conversation_id": "conv-123",
  "sender_id": "user-456",
  "timestamp": "2023-09-18T10:00:00Z"
}
```

## 🗄️ 数据库

### 自动初始化

服务器启动时会自动创建以下表：
- `shops` - 商店信息
- `customers` - 客户信息  
- `conversations` - 对话记录
- `messages` - 消息记录
- `admins` - 管理员账户

### 数据库文件

默认位置: `data/database.sqlite`

## 🎨 功能特性

### 实时客服
- ✅ WebSocket双向实时通信
- ✅ 多对话并发支持
- ✅ 消息持久化存储
- ✅ 在线状态显示
- ✅ 打字状态提示

### 多商店支持
- ✅ 独立商店管理
- ✅ API密钥认证
- ✅ 域名绑定验证
- ✅ 商店级别统计

### 文件管理
- ✅ 多文件上传支持
- ✅ 文件类型验证
- ✅ 安全文件存储
- ✅ 文件下载链接

### 管理后台
- ✅ 现代化响应式界面
- ✅ 实时数据统计
- ✅ 对话管理
- ✅ 文件管理
- ✅ 系统监控

## 🔐 安全特性

- **内存安全**: Rust语言保证
- **并发安全**: 无数据竞争
- **SQL注入防护**: SQLx参数化查询
- **文件上传安全**: 类型验证和路径限制
- **CORS配置**: 跨域访问控制

## 📦 部署

### 单文件部署

```bash
# 编译Release版本
cargo build --release

# 复制可执行文件到服务器
scp target/release/quicktalk-pure-rust user@server:/opt/quicktalk/

# 在服务器上运行
./quicktalk-pure-rust
```

### 服务器要求

- **✅ 仅需Rust程序** - 符合纯Rust环境要求
- **❌ 无需Node.js** - 完全移除Node.js依赖
- **❌ 无需Nginx** - 内置HTTP服务器
- **❌ 无需外部数据库** - 使用SQLite

### 系统服务配置

```ini
# /etc/systemd/system/quicktalk.service
[Unit]
Description=QuickTalk Pure Rust Customer Service
After=network.target

[Service]
Type=simple
User=quicktalk
WorkingDirectory=/opt/quicktalk
ExecStart=/opt/quicktalk/quicktalk-pure-rust
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 🛠️ 开发

### 本地开发

```bash
# 启动开发服务器（支持热重载）
cd backend
cargo watch -x run

# 或直接运行
cargo run
```

### 调试模式

```bash
# 启用详细日志
RUST_LOG=debug cargo run

# 或设置特定模块日志
RUST_LOG=quicktalk_pure_rust=debug,axum=info cargo run
```

### 测试

```bash
# 运行测试
cargo test

# 运行特定测试
cargo test websocket

# 集成测试
cargo test --test integration
```

## 🧹 仓库清理

由于项目从混合架构转换为纯Rust，我们提供了清理脚本：

```bash
# 基础清理（推荐）
./scripts/cleanup-repo.ps1

# 深度清理Git历史（可选，会重写历史）
./scripts/deep-cleanup-git-history.ps1 -DryRun  # 预览
./scripts/deep-cleanup-git-history.ps1 -Force   # 执行
```

## 📊 性能

### 基准测试

- **内存占用**: ~10MB (运行时)
- **启动时间**: <1秒
- **并发连接**: 10,000+ WebSocket连接
- **响应时间**: <5ms (本地)
- **文件大小**: ~15MB (可执行文件)

### 优化建议

- 使用 `cargo build --release` 编译生产版本
- 启用 LTO: `lto = true` 在 Cargo.toml 中
- 设置合适的数据库连接池大小
- 配置适当的日志级别

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🆘 支持

如有问题，请通过以下方式获取支持：

- 🐛 [报告Bug](issues)
- 💡 [功能请求](issues)
- 📖 [查看文档](docs/)
- 💬 [讨论交流](discussions)

## 🎉 致谢

感谢所有为 QuickTalk 做出贡献的开发者！

---

**QuickTalk** - 为纯Rust环境打造的现代化客服解决方案 🦀

## 🧩 DDD 分层与当前迁移状态 (2025-09-24 新增)

> 本节说明当前领域驱动设计(DDD) 结构的迁移阶段。旧版领域代码已被移动到 `backend/src/domain_legacy/`，新结构逐步替换中。

### 分层说明
| 层 | 目录 | 角色 | 当前状态 |
|----|------|------|----------|
| 接口层 (Interface) | `src/api`, `src/ws`, `src/web.rs` | 解析HTTP/WS请求、DTO、路由装配 | 已存在（待逐步瘦身） |
| 应用层 (Application) | `src/application` | 用例编排、事务/授权、事件派发 | 初步成型（send_message等） |
| 领域层 (Domain) | `src/domain` | 聚合/实体/值对象/不变式/领域事件 | 新结构构建中 (conversation 首批) |
| 基础设施 (Infrastructure) | `src/db` | SQLx 查询、Repo实现 | 已存在（需适配新接口） |
| 兼容层 (Legacy / ACL) | `src/domain_legacy` | 旧模型与过渡层 | 临时保留，后续删除 |

### 新 `conversation` 聚合结构
```
backend/src/domain/
  shared/
    ids.rs        # 强类型ID: ConversationId / MessageId / ...
    errors.rs     # DomainError 定义
    events.rs     # DomainEvent & DomainEventKind
  conversation/
    model/
      aggregate.rs  # Conversation 聚合 + 不变式 + 事件收集
      message.rs    # Message 实体
    repository.rs   # ConversationRepository trait
    mod.rs          # 兼容旧路径的过渡接口 (后续精简)
```

### 事件策略
- 聚合内部行为(append_message) 直接收集事件 -> `pending_events`
- 用例从 `take_events()` 取出后统一派发（后续将接入轻量 EventBus）

### 不变式示例
- 仅 Active 会话允许追加消息
- 消息内容不能为空
- 会话关闭后不能追加新消息

### 当前 TODO 跟踪
- [x] Conversation 聚合重建
- [x] 事件收集机制雏形
- [ ] 将 repository SQL 实现适配新 trait
- [ ] 迁移 message 更新/删除逻辑到应用层 + 事件
- [ ] 移除 `domain_legacy` 中未再引用的模块
- [ ] 编写 InMemory Repo 更多测试 (状态迁移 + 异常路径)

### 过渡期注意事项
1. `domain_legacy` 仍被部分 API handler 间接引用，合并前避免直接删除
2. 新旧 ID 类型不兼容时，可在应用层增加 `From<String> for ConversationId` 等适配（已实现）
3. 接口返回 JSON 时，强类型 newtype 会通过 `#[serde(transparent)]` 保持原字符串输出