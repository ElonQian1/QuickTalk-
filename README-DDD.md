# QuickTalk 客服系统 - DDD 架构

## 🏗️ 域驱动设计 (Domain-Driven Design) 架构

本项目采用 DDD 架构模式，将业务逻辑与技术实现清晰分离，确保代码的可维护性和可扩展性。

### 📁 项目结构

```
QuickTalk-/
├── 🏗️ domain/                     # 领域层 - 业务核心
│   ├── customer/                   # 客户领域
│   │   ├── entity.rs              # 客户实体
│   │   ├── repository.rs          # 客户仓储接口
│   │   └── mod.rs                 # 模块定义
│   ├── conversation/              # 对话领域
│   ├── message/                   # 消息领域
│   ├── shop/                      # 商店领域
│   └── mod.rs                     # 领域层模块
├── 🎯 application/                # 应用服务层
│   ├── commands/                  # 命令处理
│   ├── queries/                   # 查询处理
│   └── handlers/                  # 事件处理
├── 🔧 infrastructure/             # 基础设施层
│   ├── database/                  # 数据库实现
│   ├── websocket/                 # WebSocket实现
│   └── external/                  # 外部服务
├── 🌐 presentation/               # 表现层
│   ├── api/                       # REST API
│   ├── websocket/                 # WebSocket API
│   └── static/                    # 静态文件 (HTML/CSS/JS)
├── 🦀 backend/                    # Rust后端实现
│   ├── src/main.rs               # 主程序入口
│   └── Cargo.toml                # 依赖配置
├── 🟢 services/                   # Node.js服务 (遗留)
├── 🗄️ data/                      # 数据存储
├── 📚 docs/                       # 文档
└── 🛠️ devops/                    # 部署配置
```

### 🎯 设计原则

#### 1. 单一职责原则 (Single Responsibility Principle)
- **Domain Layer**: 仅包含业务规则和领域逻辑
- **Application Layer**: 协调领域对象完成业务用例
- **Infrastructure Layer**: 提供技术实现（数据库、外部服务）
- **Presentation Layer**: 处理用户界面和API

#### 2. 依赖倒置原则 (Dependency Inversion Principle)
- 高层模块不依赖低层模块，都依赖抽象
- Repository 接口定义在 Domain Layer
- 具体实现在 Infrastructure Layer

#### 3. 领域驱动 (Domain-Driven)
- 以业务领域为中心组织代码
- 使用领域专家的语言（Ubiquitous Language）
- 领域模型独立于技术实现

### 📋 技术约束

- **纯 Rust + 静态 HTML**: 禁止使用 Vue.js、React 等前端框架
- **单一二进制**: 使用 `cargo run` 启动，无多个 `--bin` 参数
- **SQLite 数据库**: 轻量级、嵌入式数据库
- **WebSocket 通信**: 实时消息推送

### 🚀 启动方式

```bash
# 唯一启动方式
cd backend && cargo run
```

### 🌐 访问地址

- **主界面**: http://localhost:3030/
- **管理后台**: http://localhost:3030/admin
- **移动端管理**: http://localhost:3030/mobile/admin
- **WebSocket**: ws://localhost:3030/ws
- **API文档**: http://localhost:3030/api/health

### 📊 数据库迁移状态

- ✅ 248条消息完全迁移
- ✅ 75个对话会话自动创建  
- ✅ 75个客户档案建立
- ✅ 3个商店配置保留
- ✅ 管理员账户迁移

### 🔧 开发工具

推荐使用 VS Code 配合以下插件：
- `rust-analyzer`: Rust 语言支持
- `Better TOML`: TOML 文件支持
- `SQLite Viewer`: 数据库查看

### 📝 贡献指南

1. 遵循 DDD 架构原则
2. 新功能优先在 Domain Layer 定义接口
3. Infrastructure Layer 提供具体实现
4. 保持领域语言的一致性
5. 编写单元测试覆盖领域逻辑

---
*最后更新: 2025年9月19日 - DDD架构重构完成，Frontend目录已移除*