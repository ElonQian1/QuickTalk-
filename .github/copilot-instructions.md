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

### 重要提醒
- 数据库连接仅通过 Rust 后端
- 不允许直接从 Node.js 连接数据库
- 所有数据操作必须通过 Rust API

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
2. 使用 Axum 框架处理 HTTP 请求
3. 使用 sqlx 进行数据库操作
4. 使用 tokio 处理异步操作
5. 遵循 Rust 最佳实践和错误处理

### 对于前端开发
1. 使用 TypeScript 严格模式
2. 遵循 React Hooks 最佳实践
3. 使用 Zustand 管理全局状态
4. API 调用通过 axios 连接到 Rust 后端

### 对于数据库
1. **严禁直接操作数据库文件**
2. 所有数据操作必须通过 Rust 后端 API
3. 架构变更需要更新 `database_schema.sql`
4. 测试数据只能通过 API 创建

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

## 代码审查标准

### 必须通过的检查
- [ ] 后端代码使用 Rust
- [ ] 数据库连接仅通过 Rust
- [ ] API 响应格式一致
- [ ] 错误处理完整
- [ ] 安全认证实现正确
- [ ] WebSocket 连接稳定

### 性能要求
- 后端响应时间 < 100ms
- WebSocket 连接延迟 < 50ms
- 数据库查询优化
- 内存使用合理

## 许可和约束

此项目架构设计为 Rust 后端驱动的系统。任何偏离此架构的建议或实现都将被拒绝。

---

**最后更新**: 2025年10月7日
**架构版本**: v1.0
**维护者**: 项目团队