# Handler Migration 使用指南 (Phase 3)

本指南展示了如何使用已迁移到 Services 架构的 HTTP Handlers。

## 🏗️ 新架构概述

### 请求处理流程
```
HTTP Request → Handler (路由处理) → Service (业务逻辑) → Repository (数据访问) → Sea-ORM → Database
```

### AppState 结构
```rust
pub struct AppState {
    pub db: Database,                     // Legacy - Phase 4 清理
    pub db_orm: database_orm::Database,   // Sea-ORM 连接
    pub connections: Arc<Mutex<ConnectionManager>>, // WebSocket 管理
    // 新 Services 层
    pub user_service: services::UserService,
    pub shop_service: services::ShopService,
    pub customer_service: services::CustomerService,
    pub session_service: services::SessionService,
    pub message_service: services::MessageService,
}
```

## 📚 Handler 使用示例

### 1. 用户认证 (Auth Handler)

#### 登录
```rust
// 之前 (Legacy)
let user = state.db.get_user_by_username(&username).await?;
if !verify(&password, &user.password_hash)? { /* error */ }

// 现在 (Services)
let user = state.user_service.authenticate(&username, &password).await?;
```

**API 调用**:
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "password123"
}
```

#### 注册
```rust
// 之前 (Legacy)
// 检查用户名存在
// 手动密码哈希
// 手动创建用户

// 现在 (Services)
let user = state.user_service.register(
    &username, 
    &password, 
    email.as_deref(), 
    phone.as_deref()
).await?;
```

**API 调用**:
```bash
POST /api/auth/register
{
  "username": "newuser",
  "password": "securepass",
  "email": "user@example.com"
}
```

### 2. 店铺管理 (Shop Handler)

#### 获取店铺列表
```rust
// 之前 (Legacy)
metrics::fetch_shops_with_unread_by_owner(&state.db, user_id).await?

// 现在 (Services)
state.shop_service.get_shops_by_owner(user_id).await?
```

**API 调用**:
```bash
GET /api/shops
Authorization: Bearer <JWT_TOKEN>
```

#### 创建店铺
```rust
// 之前 (Legacy)
state.db.create_shop(user_id, &shop_name, shop_url).await?

// 现在 (Services)
state.shop_service.create_shop(user_id, &shop_name, shop_url).await?
```

**API 调用**:
```bash
POST /api/shops
Authorization: Bearer <JWT_TOKEN>
{
  "shop_name": "My Store",
  "shop_url": "https://mystore.com"
}
```

### 3. 客户管理 (Customer Handler)

#### 获取客户列表
```rust
// 之前 (Legacy)
// 手动权限检查
permissions::ensure_member_or_owner(&state.db, user_id, shop_id).await?;
state.db.get_customers_overview_by_shop(shop_id).await?

// 现在 (Services)
state.customer_service.get_customers_with_sessions(user_id, shop_id).await?
```

**API 调用**:
```bash
GET /api/shops/123/customers
Authorization: Bearer <JWT_TOKEN>
```

#### 重置未读消息
```rust
// 之前 (Legacy)
// 手动权限检查
// 手动重置数据库

// 现在 (Services)
state.session_service.reset_unread_count(user_id, shop_id, customer_id).await?
```

**API 调用**:
```bash
POST /api/shops/123/customers/456/reset-unread
Authorization: Bearer <JWT_TOKEN>
```

### 4. 消息处理 (Message Handler)

#### 获取消息历史
```rust
// 之前 (Legacy)
// 解析会话获取权限
// 手动权限检查
// 手动数据库查询

// 现在 (Services)
state.message_service.get_messages_by_session(user_id, session_id, limit, offset).await?
```

**API 调用**:
```bash
GET /api/sessions/789/messages?limit=50&offset=0
Authorization: Bearer <JWT_TOKEN>
```

#### 发送消息
```rust
// 之前 (Legacy)
// 复杂的权限检查
// ChatService 解析
// 手动消息持久化
// WebSocket 广播

// 现在 (Services)
let (message, session, customer) = state.message_service.send_staff_message(
    user_id, session_id, &content, &message_type, file_url
).await?;
// WebSocket 广播逻辑保持不变
```

**API 调用**:
```bash
POST /api/sessions/789/messages
Authorization: Bearer <JWT_TOKEN>
{
  "content": "Hello customer!",
  "message_type": "text"
}
```

## 🔧 错误处理

### 统一错误类型
所有 Services 现在返回标准化的错误:

```rust
// Services 返回
Result<T, anyhow::Error>

// Handlers 转换为
Result<Json<T>, AppError>
```

### 常见错误映射
```rust
// 权限错误
"权限不足" -> AppError::Forbidden

// 资源未找到
"用户不存在" | "店铺不存在" -> AppError::NotFound

// 业务逻辑错误
"用户名已存在" -> AppError::Conflict

// 系统错误
其他错误 -> AppError::Internal
```

## 🎯 Services 层优势

### 1. 权限控制统一化
```rust
// 之前: 在每个 handler 中重复
if let Err(e) = permissions::ensure_member_or_owner(&state.db, user_id, shop_id).await {
    return Err(match e { AppError::Unauthorized => AppError::Forbidden, other => other });
}

// 现在: 在 Service 中自动处理
state.customer_service.get_customers_with_sessions(user_id, shop_id).await?
```

### 2. 业务逻辑封装
```rust
// UserService::register() 自动处理:
// - 用户名重复检查
// - 密码哈希 (bcrypt)
// - 数据验证
// - 数据库事务

// ShopService::create_shop() 自动处理:
// - 权限验证
// - 名称验证
// - API Key 生成
// - 数据库事务
```

### 3. 类型安全
```rust
// Sea-ORM 实体确保编译时类型安全
pub async fn get_user_by_id(&self, user_id: i64) -> anyhow::Result<Option<users::Model>>

// 不再可能出现 SQL 注入或类型错误
```

## 🚀 WebSocket 集成

WebSocket 连接管理保持不变，但消息处理现在使用 Services:

```rust
// WebSocket 消息持久化
let (message, session, customer) = state.message_service
    .send_staff_message(user_id, session_id, content, message_type, file_url)
    .await?;

// 广播逻辑保持原样
{
    let mut manager = state.connections.lock().unwrap();
    manager.send_to_customer(session.shop_id, &customer.customer_id, &ws_message);
    manager.broadcast_to_staff(session.shop_id, &ws_message);
}
```

## 📊 性能考虑

### 连接池复用
```rust
// Repository 复用 Sea-ORM 连接池
let user_repo = repositories::UserRepository::new(db_orm.clone());
let shop_repo = repositories::ShopRepository::new(db_orm.clone());
```

### 事务管理
```rust
// Services 内部自动管理事务
pub async fn register(&self, username: &str, password: &str, email: Option<&str>, phone: Option<&str>) -> anyhow::Result<users::Model> {
    // 自动事务管理 - 失败时回滚
}
```

## ⚠️ 注意事项

### 1. 向后兼容性
- 所有 API 端点 URL 保持不变
- HTTP 响应格式保持一致
- JWT 认证机制不变

### 2. Legacy 数据库
- `AppState.db` (Legacy Database) 仍然存在
- Phase 4 将完全移除 legacy 代码
- 当前阶段两套系统并存

### 3. WebSocket 依赖
- WebSocket 管理仍使用 legacy ConnectionManager
- 未来版本可能迁移到 Services 架构

## 🔍 调试技巧

### 启用详细日志
```bash
RUST_LOG=debug cargo run
```

### 错误追踪
```rust
// Services 使用 anyhow 提供详细错误链
match state.user_service.authenticate(&username, &password).await {
    Err(e) => {
        tracing::error!("认证失败: {:#}", e); // 显示完整错误链
        Err(AppError::Unauthorized)
    }
}
```

### 数据库查询日志
```bash
RUST_LOG=sqlx::query=debug cargo run
# 显示所有 SQL 查询语句
```

---

**下一步**: 完成 Phase 4 (Database Cleanup) 或开始全面测试  
**文档版本**: Phase 3 Complete  
**更新时间**: 2025年10月14日