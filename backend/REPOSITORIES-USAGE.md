# 🚀 Repositories 使用指南

## 📖 快速开始

所有 Repository 已经完全补全，可以立即使用！

### 导入方式

```rust
use crate::repositories::{
    UserRepository,
    ShopRepository,
    SessionRepository,
    MessageRepository,
    ShopStaffRepository,
    CustomerRepository,
};
```

---

## 💡 使用示例

### 1. UserRepository

```rust
// 查找用户
let user = UserRepository::find_by_username(&db, "admin").await?;

// 创建用户
let new_user = UserRepository::create(
    &db,
    "john".to_string(),
    password_hash,
    Some("john@example.com".to_string()),
    Some("John Doe".to_string()),
    None, // 默认 "staff"
).await?;

// 更新个人资料
UserRepository::update_profile(
    &db,
    user_id,
    Some("newemail@example.com".to_string()),
    Some("+1234567890".to_string()),
    None,
).await?;

// 修改密码
UserRepository::change_password(
    &db,
    user_id,
    new_password_hash,
).await?;

// 检查用户名是否存在
if UserRepository::username_exists(&db, "admin").await? {
    // 用户名已存在
}
```

---

### 2. ShopRepository

```rust
// 创建店铺
let shop = ShopRepository::create(
    &db,
    "My Shop".to_string(),
    "my-shop".to_string(),
    Some("店铺描述".to_string()),
    Some(owner_id),
).await?;

// 根据 API Key 查找店铺
let shop = ShopRepository::find_by_api_key(&db, "xxx-xxx-xxx").await?;

// 获取用户可访问的所有店铺（所有者 + 员工）
let accessible_shops = ShopRepository::find_accessible_by_user(&db, user_id).await?;

// 检查用户是否是店主
if ShopRepository::is_owner(&db, shop_id, user_id).await? {
    // 用户是店主
}

// 重新生成 API Key
let new_api_key = ShopRepository::regenerate_api_key(&db, shop_id).await?;
```

---

### 3. SessionRepository

```rust
// 创建会话
let session = SessionRepository::create_simple(&db, shop_id, customer_id).await?;

// 根据店铺和客户查找活跃会话
let session = SessionRepository::find_by_shop_and_customer(
    &db,
    shop_id,
    customer_id,
).await?;

// 分配客服
SessionRepository::assign_staff(&db, session_id, staff_id).await?;

// 更新最后消息时间
SessionRepository::update_last_message_time(&db, session_id).await?;

// 关闭会话
SessionRepository::close(&db, session_id).await?;

// 获取客服的活跃会话
let my_sessions = SessionRepository::find_by_staff(&db, staff_id).await?;

// 获取未分配的会话
let unassigned = SessionRepository::find_unassigned_by_shop(&db, shop_id).await?;
```

---

### 4. MessageRepository

```rust
// 创建消息（完整版）
let message = MessageRepository::create_full(
    &db,
    session_id,
    "customer",
    Some(customer_id),
    "你好，我需要帮助",
    "text",
    None, // file_url
).await?;

// 创建带文件的消息
let message_with_file = MessageRepository::create_full(
    &db,
    session_id,
    "staff",
    Some(staff_id),
    "这是您要的文件",
    "file",
    Some("https://example.com/file.pdf"),
).await?;

// 获取会话的所有消息
let messages = MessageRepository::find_by_session(&db, session_id, Some(100)).await?;

// 获取会话的最后一条消息
let last_msg = MessageRepository::find_last_by_session(&db, session_id).await?;

// 标记消息为已读
MessageRepository::mark_as_read(&db, vec![msg_id1, msg_id2]).await?;

// 获取未读消息数量
let unread_count = MessageRepository::count_unread(&db, session_id, "staff").await?;

// 搜索消息
let results = MessageRepository::search(&db, shop_id, "关键词", Some(20)).await?;

// 分页获取消息
let (messages, total) = MessageRepository::find_by_session_paginated(
    &db,
    session_id,
    0, // page
    50, // page_size
).await?;
```

---

### 5. ShopStaffRepository

```rust
// 列出店铺的所有员工（包括店主）
let staff_list = ShopStaffRepository::list_shop_staff(&db, shop_id).await?;
for (user, role) in staff_list {
    println!("{}: {} ({})", user.id, user.username, role);
}

// 根据用户名添加员工
match ShopStaffRepository::add_staff_by_username(
    &db,
    shop_id,
    "alice",
    Some("manager"),
).await {
    Ok(_) => println!("员工添加成功"),
    Err(e) if e.to_string().contains("user_not_found") => {
        println!("用户不存在");
    }
    Err(e) if e.to_string().contains("already_member") => {
        println!("用户已是店铺成员");
    }
    Err(e) => return Err(e),
}

// 检查用户是否是店铺成员（所有者或员工）
if ShopStaffRepository::is_shop_member(&db, shop_id, user_id).await? {
    // 用户有权限访问此店铺
}

// 检查用户是否是店主
if ShopStaffRepository::is_shop_owner(&db, shop_id, user_id).await? {
    // 用户是店主
}

// 更新员工角色
ShopStaffRepository::update_role(&db, shop_id, user_id, "admin".to_string()).await?;

// 移除员工（软删除）
ShopStaffRepository::remove_staff(&db, shop_id, user_id).await?;

// 获取用户作为员工的所有店铺
let my_shops = ShopStaffRepository::find_shops_by_user(&db, user_id).await?;
```

---

### 6. CustomerRepository

```rust
// 创建或更新客户
let customer = CustomerRepository::create_or_update(
    &db,
    shop_id,
    "customer_123".to_string(),
    Some("张三".to_string()),
    Some("zhangsan@example.com".to_string()),
    Some("https://example.com/avatar.jpg".to_string()),
).await?;

// 查找客户
let customer = CustomerRepository::find_by_shop_and_customer_id(
    &db,
    shop_id,
    "customer_123",
).await?;

// 获取店铺的所有客户
let customers = CustomerRepository::find_by_shop(&db, shop_id).await?;

// 获取客户概览（包含会话和最后消息）
let overview = CustomerRepository::find_with_overview_by_shop(&db, shop_id).await?;
for (customer, session, last_msg, unread_count) in overview {
    println!("客户: {}", customer.name.unwrap_or_default());
    if let Some(msg) = last_msg {
        println!("  最后消息: {}", msg.content);
    }
    println!("  未读: {}", unread_count);
}

// 阻止客户
CustomerRepository::block(&db, customer_id).await?;

// 解除阻止
CustomerRepository::unblock(&db, customer_id).await?;

// 统计活跃客户数（最近7天）
let active_count = CustomerRepository::count_active_by_shop(&db, shop_id, 7).await?;

// 搜索客户
let results = CustomerRepository::search(&db, shop_id, "张").await?;

// 更新最后活跃时间
CustomerRepository::update_last_active(&db, customer_id).await?;
```

---

## 🎯 在 Handler 中使用

### 旧方式（使用 database.rs）❌

```rust
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    // ❌ 直接使用 database.rs 的方法
    let user = match state.db.get_user_by_username(&payload.username).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    // ...
}
```

### 新方式（使用 Repository）✅

```rust
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    // ✅ 使用 Repository（类型安全）
    let user = match UserRepository::find_by_username(
        state.db_orm.get_connection(),
        &payload.username
    ).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    // ...
}
```

---

## 🔧 获取数据库连接

在 Handler 或 Service 中获取 Sea-ORM 连接：

```rust
// 从 AppState 获取
let db = state.db_orm.get_connection();

// 然后传递给 Repository
let user = UserRepository::find_by_id(db, user_id).await?;
```

---

## 📊 对比优势

| 特性 | database.rs (sqlx) | Repositories (Sea-ORM) |
|------|-------------------|------------------------|
| **类型安全** | ❌ 运行时检查 | ✅ 编译时检查 |
| **SQL注入防护** | ⚠️ 需要手动参数化 | ✅ 自动防护 |
| **代码提示** | ❌ 无 | ✅ 完整提示 |
| **重构友好** | ❌ 难 | ✅ 易 |
| **错误提示** | ⚠️ 运行时才知道 | ✅ 编译时发现 |
| **查询构建** | ❌ 手写SQL | ✅ 类型安全的查询构建器 |

---

## ⚠️ 注意事项

### 1. file_url 字段处理

由于 `messages` 实体没有单独的 `file_url` 字段，文件 URL 存储在 `metadata` 中：

```rust
// 创建带文件的消息
let message = MessageRepository::create_full(
    &db,
    session_id,
    "staff",
    Some(staff_id),
    "文件描述",
    "file",
    Some("https://example.com/file.pdf"), // 自动存储到 metadata
).await?;

// 读取时从 metadata 获取
if let Some(metadata) = &message.metadata {
    if let Some(file_url) = metadata.get("file_url") {
        println!("文件URL: {}", file_url);
    }
}
```

### 2. API Key 字段

确保 `shops` 实体包含 `api_key` 字段，如果没有需要添加 migration：

```rust
// 在 entities/shops.rs 中确认
pub struct Model {
    // ...
    pub api_key: Option<String>, // 需要此字段
    // ...
}
```

### 3. 错误处理

Repository 方法返回 `anyhow::Result`，在 Handler 中需要适当转换：

```rust
// 方式1: 使用 map_err
let user = UserRepository::find_by_id(db, id)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

// 方式2: 使用 match
match UserRepository::find_by_id(db, id).await {
    Ok(Some(user)) => { /* ... */ }
    Ok(None) => return Err(StatusCode::NOT_FOUND),
    Err(e) => {
        error!("Database error: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
}
```

---

## 🎊 下一步

现在 Repositories 已经完全可用！接下来可以：

1. **Phase 2**: 创建 Services 层（业务逻辑）
2. **Phase 3**: 迁移 Handlers 使用 Repositories
3. **Phase 4**: 清理 `database.rs` 中的冗余代码

**准备好继续了吗？** 🚀
