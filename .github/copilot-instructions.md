# GitHub Copilot 项目指令

## 项目概述
这是一个多店铺客服系统，采用 Rust 后端 + React 前端 + WebSocket SDK 的架构。

## 核心架构要求

### ⚠️ 重要限制
**严格禁止使用 Node.js 替代 Rust 后端服务器**

- 本项目的后端必须使用 **Rust** 编写
- 不允许使用任何 Node.js 服务器作为后端替代方案
- 数据库连接必须通过 Rust 后端实现
- 所有 API 端点必须由 Rust 服务器提供

### 技术栈

#### 后端 (必须使用)
- **语言**: Rust
- **框架**: Axum + Tokio
- **数据库**: SQLite (通过 sqlx)
- **认证**: JWT + bcrypt
- **WebSocket**: 原生 WebSocket 支持
- **位置**: `backend/src/main.rs`

#### 前端
- **框架**: React 18 + TypeScript
- **状态管理**: Zustand
- **样式**: Styled Components
- **构建工具**: Create React App
- **位置**: `frontend/`

#### WebSocket SDK
- **语言**: TypeScript
- **用途**: 为第三方网站提供客服集成
- **位置**: `websocket-sdk/`

## 开发命令

### 启动开发环境
```bash
npm run dev
```
此命令应该启动：
1. Rust 后端服务器 (端口 8080)
2. React 前端开发服务器 (端口 3000)
3. WebSocket SDK 开发构建

### 单独启动组件
```bash
# 仅启动 Rust 后端
npm run backend:dev

# 仅启动前端
npm run frontend:dev

# 仅构建 SDK
npm run sdk:dev
```

## 数据库

### 配置
- **类型**: SQLite
- **文件**: `backend/customer_service.db`
- **架构**: `database_schema.sql`
- **迁移**: 自动执行 (在 Rust 后端启动时)

### ⚠️ 数据使用规范
**严格要求使用真实数据库数据**

- **禁止使用模拟数据**: 在开发和测试过程中，必须使用真实的数据库连接和数据
- **禁止使用测试数据**: 不允许使用任何硬编码的测试数据或模拟API响应
- **真实数据源**: 所有数据必须来自SQLite数据库中的真实表和记录
- **API响应**: 所有API端点必须返回从数据库查询的真实数据
- **统计数据**: 所有统计信息（消息数量、客户数量、待处理任务等）必须通过数据库查询计算得出

### 重要提醒
- 数据库连接仅通过 Rust 后端
- 不允许直接从 Node.js 连接数据库
- 所有数据操作必须通过 Rust API
- **禁止mock后端**: 不允许使用Node.js mock服务器替代Rust后端

## API 端点

所有 API 端点由 Rust 后端提供：

```
POST /api/auth/login       - 用户登录
POST /api/auth/register    - 用户注册
GET  /api/shops           - 获取店铺列表
POST /api/shops           - 创建店铺
GET  /api/shops/:id/customers - 获取客户列表
GET  /api/sessions/:id/messages - 获取消息历史
POST /api/sessions/:id/messages - 发送消息
```

## WebSocket 端点

```
/ws/staff/:user_id                    - 客服人员连接
/ws/customer/:shop_id/:customer_id    - 客户连接
```

## 开发规则

### 对于后端开发
1. **只能修改 Rust 代码** (`backend/src/`)
2. **使用单一main.rs文件** - 不创建多个版本的main.rs (如main_test.rs, main_backup.rs等)
3. 使用 Axum 框架处理 HTTP 请求
4. 使用 sqlx 进行数据库操作
5. 使用 tokio 处理异步操作
6. 遵循 Rust 最佳实践和错误处理
7. **代码变更直接在main.rs中进行** - 避免创建备份或测试版本文件

### 模块化与代码结构规范

本章节在“不创建多个 main.rs 版本”前提下，明确允许并鼓励通过 `mod` / 子模块文件进行结构化拆分，以达到可维护、低耦合、可测试与可演进的目的。

#### 目标
1. 控制单文件长度，降低认知负担
2. 明确领域边界 (auth / websocket / services / handlers / models / database)
3. 促进代码复用，减少重复实现
4. 为性能、安全与审计提供清晰入口

#### Rust 后端结构约定
保持唯一入口文件 `backend/src/main.rs`，其职责仅限：
- 启动初始化（日志、配置、数据库连接、路由、WebSocket 设置）
- 高层依赖注入与组件装配
- 顶层错误 / 关停处理

除入口外业务逻辑需拆分到模块：
- `auth.rs` / `auth/`：认证、授权、JWT 逻辑
- `database.rs`：数据库连接池与迁移
- `models.rs`：结构体 / DTO / 持久化实体（禁止复杂业务逻辑）
- `handlers/`：HTTP 处理器（解析输入 -> 调用 service -> 构建响应），单文件建议 < 300 行
- `services/`：核心业务逻辑（纯函数优先），单文件建议 < 400 行
- `websocket.rs` / `websocket/`：会话管理、消息路由
- `jwt.rs`：JWT 编解码

可按复杂度进一步细分，例如：
```
backend/src/services/
	mod.rs
	chat.rs
	metrics.rs
	notification.rs
```
禁止创建平行重复/历史副本（如 `chat_copy.rs`, `old_chat.rs`, `chat_final.rs`）。

#### 文件长度与复杂度限制（软性约束）
- `main.rs`：≤ 400 行（超出需拆出路由装配或初始化模块）
- 普通模块：建议 ≤ 400 行，绝不超过 800 行
- Handler 文件：建议 ≤ 300 行
- 单函数：≤ 80 行；若接近上限需拆分私有辅助函数
- 出现 ≥3 次相似代码片段 => 必须抽取公共函数/模块

#### 命名与布局原则
- 模块文件一律 snake_case
- 公共 API 由 `mod.rs` 统一导出；内部实现最小可见性 (`pub(crate)` / 私有)
- Service 公共函数返回统一 `Result<T, AppError>`

#### 依赖方向
`handlers` -> `services` -> (`models` + `database`)
`websocket` -> `services`
禁止反向依赖（例如 service 调用 handler）。

#### 前端结构细化
- `components/`：纯展示 & 可复用 UI（无业务副作用）
- `components/shops/`：店铺相关组件
- `pages/`：页面容器（数据抓取 + 状态协调）
- `stores/`：Zustand 模块（单文件 ≤ 300 行，超出拆 slice）
- `config/api.ts`：Axios 实例与拦截器（禁止组件内自建实例）
- `config/ws.ts`：WebSocket 连接配置与重连策略
- `styles/`：全局样式与主题
禁止在组件中硬编码基础配置（如基础 API URL / WebSocket 路径）。

#### WebSocket SDK 结构约定
- 入口：`src/index.ts`（稳定最小 API）
- 高级功能：`advanced-sdk.ts`
- 职责分层：连接逻辑 / 消息类型定义 / 事件回调注册
- 协议常量集中（路径、事件名、消息类型枚举）

#### 重构触发条件（满足其一必须发起重构而非继续堆叠）
1. 任意非入口文件 > 400 行
2. 单函数 > 80 行
3. 相似片段（≥6 行）出现 ≥3 次
4. 循环依赖或需要异常 `pub use` 绕行
5. Handler 内业务条件分支 > 6 条

#### 设计前置简述（PR 或文件头部注释）
```
// Purpose: 模块职责
// Input: 主要输入结构 / 来源
// Output: 返回结构 / 副作用
// Errors: 典型错误场景
```

### 重复与冗余检查流程

每次 Commit / PR 必须执行以下自检：

#### Checklist
- [ ] 无临时/备份文件 (`*_bak.rs`, `old_*.ts`, `.orig`, `.copy` 等)
- [ ] 无多余 `main_backup.rs` / `main_old.rs` 等入口副本
- [ ] 文件/函数行数未越界，超出已拆分
- [ ] 重复逻辑已抽取公共模块/函数
- [ ] 无死代码：未使用函数/变量/import 已删除
- [ ] 未保留 >15 行的成段注释旧实现（依赖 git 历史即可）
- [ ] Handler 轻量（无复杂业务分支）
- [ ] 重复字符串/常量（≥3 次）已抽取

#### 建议工具
- `cargo clippy`：检测未使用代码 / 复杂度提示
- `cargo fmt --check`：格式一致便于 diff
- `rg "_bak|backup|old|copy" backend/src`：搜索潜在备份
- ESLint：前端 `eslint --max-warnings=0`
- 行数统计（可脚本化）：
	- Rust：`find backend/src -name "*.rs" | xargs wc -l`
	- TS/TSX：`find frontend/src -name "*.ts*" | xargs wc -l`

#### 公共代码抽取步骤
1. 标记重复片段
2. 识别变动点 -> 参数化 / 策略函数
3. 创建公共函数或模块（最小可见性）
4. 替换原实现并测试
5. 添加注释（用途 / 输入 / 输出 / 错误）

#### 严禁
❌ 保留大块注释旧代码
❌ 复制粘贴创建微调版本文件 (`*_v2.rs`, `_final.ts`)
❌ 用命名后缀规避重构 (`_new`, `_latest`)
❌ 持续膨胀“上帝函数”或“上帝模块”

#### 实验代码例外
确需临时实验：
- 放置 `experiments/`（默认不创建）
- 不得被生产构建 / 主路由引用
- 保留期 ≤ 2 周；到期删除或正规化

### 对于前端开发
1. 使用 TypeScript 严格模式
2. 遵循 React Hooks 最佳实践
3. 使用 Zustand 管理全局状态
4. API 调用通过 axios 连接到 Rust 后端

### 对于数据库
1. **严禁直接操作数据库文件**
2. 所有数据操作必须通过 Rust 后端 API
3. 架构变更需要更新 `database_schema.sql`
4. **必须使用真实数据**: 禁止在开发过程中使用任何硬编码或模拟数据
5. **数据完整性**: 所有显示的数据必须来自真实的数据库查询结果
6. **统计计算**: 仪表板统计、计数等必须通过SQL查询实时计算

## 部署要求

### 生产环境
1. 编译 Rust 后端为可执行文件
2. 构建 React 前端静态文件
3. 配置环境变量 (`.env`)
4. 确保 SQLite 数据库文件权限正确

### 环境变量
```env
DATABASE_URL=sqlite:customer_service.db
JWT_SECRET=your-super-secret-jwt-key
SERVER_HOST=0.0.0.0
SERVER_PORT=8080
```

## 故障排除

### 常见问题
1. **端口冲突**: 确保 8080 和 3000 端口可用
2. **数据库锁定**: 确保只有一个 Rust 进程访问数据库
3. **编译错误**: 检查 Rust 工具链和依赖版本
4. **CORS 错误**: 确保 Rust 后端正确配置 CORS

### 禁止的解决方案
❌ 使用 Node.js Express 服务器
❌ 直接从前端连接 SQLite
❌ 绕过 Rust 后端的任何方案
❌ 使用其他语言重写后端
❌ 创建多个版本的main.rs文件 (如main_test.rs, main_backup.rs, main_original.rs等)
❌ 创建备份或测试版本的主文件
❌ 使用硬编码的模拟数据或测试数据
❌ 使用mock API服务器替代真实数据库查询
❌ 在前端组件中硬编码任何业务数据

## 代码审查标准

### 必须通过的检查
- [ ] 后端代码使用 Rust
- [ ] 数据库连接仅通过 Rust
- [ ] API 响应格式一致
- [ ] 错误处理完整
- [ ] 安全认证实现正确
- [ ] WebSocket 连接稳定
- [ ] 只维护单一版本的main.rs文件
- [ ] 不存在多余的测试或备份版本文件
- [ ] 所有数据来源于真实数据库查询
- [ ] 无硬编码的模拟数据或测试数据
- [ ] 统计数据通过SQL实时计算
- [ ] 只维护单一版本的main.rs文件
- [ ] 不存在多余的测试或备份版本文件
 - [ ] 模块化合规：入口最小 + 依赖方向正确
 - [ ] 文件/函数长度在规定范围（超出附说明或拆分）
 - [ ] 无重复代码（≥3 次相似片段已抽取）
 - [ ] 无死代码 / 未使用符号
 - [ ] 无临时/备份/版本后缀文件
 - [ ] 常量集中管理，无散落 magic numbers / strings
 - [ ] Handler 瘦 + 业务下沉 service
 - [ ] WebSocket 事件 & 消息类型集中定义
 - [ ] PR 说明包含模块职责与设计摘要

### 性能要求
- 后端响应时间 < 100ms
- WebSocket 连接延迟 < 50ms
- 数据库查询优化
- 内存使用合理

## 许可和约束

此项目架构设计为 Rust 后端驱动的系统。任何偏离此架构的建议或实现都将被拒绝。

---

**最后更新**: 2025年10月9日
**架构版本**: v1.1
**维护者**: 项目团队