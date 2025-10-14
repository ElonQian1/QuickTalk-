# 🚀 Services 业务逻辑层使用指南

## 📖 快速开始

所有 Services 已经完全实现，包含完整的业务逻辑和权限控制！

### 导入方式

```rust
use crate::services::{
    UserService,
    ShopService,
    CustomerService,
    SessionService,
    MessageService,
};
```

---

## 💡 使用示例

### 1. UserService - 用户管理

#### 用户注册
```rust
// 完整的注册流程（自动检查重复、密码加密）
let user = UserService::register(
    &db,
    "john_doe".to_string(),
    "secure_password123".to_string(),
    Some("john@example.com".to_string()),
    Some("John Doe".to_string()),
).await?;

// 自动处理的业务逻辑：
// ✅ 检查用户名是否已存在
// ✅ 检查邮箱是否已存在
// ✅ 密码 bcrypt 加密
// ✅ 创建用户记录
```

#### 用户登录验证
```rust
// 完整的登录验证
match UserService::authenticate(&db, "john_doe", "password123").await {
    Ok(user) => {
        // 登录成功，自动更新最后登录时间
        println!("欢迎 {}", user.username);
    }
    Err(e) => match e.to_string().as_str() {
        "invalid_credentials" => println!("用户名或密码错误"),
        "user_inactive" => println!("账户已被禁用"),
        _ => println!("登录失败"),
    }
}
```

#### 修改密码
```rust
// 安全的密码修改（验证旧密码）
UserService::change_password(
    &db,
    user_id,
    "old_password",
    "new_secure_password",
).await?;
```

#### 更新个人资料
```rust
// 智能的资料更新（邮箱冲突检查）
let updated_user = UserService::update_profile(
    &db,
    user_id,
    Some("newemail@example.com".to_string()),
    Some("+1234567890".to_string()),
    Some("https://avatar.example.com/user.jpg".to_string()),
).await?;
```

#### 输入验证
```rust
// 统一的验证规则
UserService::validate_username("john_doe")?; // 长度、字符检查
UserService::validate_password("123456")?;   // 强度检查
UserService::validate_email("user@example.com")?; // 格式检查
```

---

### 2. ShopService - 店铺管理

#### 创建店铺
```rust
// 完整的店铺创建流程
let shop = ShopService::create_shop(
    &db,
    owner_id,
    "My Awesome Shop".to_string(),
    "my-awesome-shop".to_string(),
    Some("最好的客服店铺".to_string()),
).await?;

// 自动处理：
// ✅ 验证用户是否存在
// ✅ 检查 slug 唯一性  
// ✅ 生成 API Key
// ✅ 创建店铺记录
```

#### 权限检查
```rust
// 检查用户是否可以访问店铺
if ShopService::can_access_shop(&db, user_id, shop_id).await? {
    println!("用户有权限访问此店铺");
}

// 检查用户是否是店主
if ShopService::is_shop_owner(&db, user_id, shop_id).await? {
    println!("用户是店铺所有者");
}
```

#### 员工管理
```rust
// 添加员工（自动权限验证）
ShopService::add_staff(
    &db,
    shop_id,
    operator_user_id, // 操作者（必须是店主）
    "alice",          // 要添加的用户名
    Some("manager"),  // 角色
).await?;

// 列出所有成员
let members = ShopService::list_shop_members(&db, shop_id, requester_user_id).await?;
for (user, role) in members {
    println!("{}: {} ({})", user.id, user.username, role);
}

// 移除员工
ShopService::remove_staff(&db, shop_id, operator_id, target_user_id).await?;
```

#### API Key 管理
```rust
// 重新生成 API Key（仅店主可操作）
let new_api_key = ShopService::regenerate_api_key(
    &db,
    shop_id,
    operator_user_id,
).await?;
println!("新的 API Key: {}", new_api_key);
```

---

### 3. CustomerService - 客户管理

#### 客户信息管理
```rust
// 创建或更新客户（智能 Upsert）
let customer = CustomerService::upsert_customer(
    &db,
    shop_id,
    "customer_123".to_string(),
    Some("张三".to_string()),
    Some("zhangsan@example.com".to_string()),
    Some("https://avatar.example.com/zhang.jpg".to_string()),
    Some(operator_user_id), // 可选：如果是后台操作需要权限验证
).await?;
```

#### 客户概览（含会话和消息）
```rust
// 获取丰富的客户概览数据
let overview = CustomerService::get_customers_overview(&db, shop_id, staff_id).await?;

for (customer, session, last_message, unread_count) in overview {
    println!("客户: {}", customer.name.unwrap_or_default());
    
    if let Some(session) = session {
        println!("  会话ID: {}", session.id);
        if let Some(msg) = last_message {
            println!("  最后消息: {}", msg.content);
        }
    }
    
    println!("  未读消息: {}", unread_count);
}
```

#### 客户搜索与管理
```rust
// 搜索客户
let results = CustomerService::search_customers(
    &db,
    shop_id,
    staff_id,
    "张", // 关键词
).await?;

// 阻止客户
CustomerService::block_customer(&db, shop_id, customer_id, operator_id).await?;

// 解除阻止
CustomerService::unblock_customer(&db, shop_id, customer_id, operator_id).await?;

// 统计活跃客户（最近7天）
let active_count = CustomerService::count_active_customers(&db, shop_id, staff_id, 7).await?;
println!("最近7天活跃客户: {}", active_count);
```

---

### 4. SessionService - 会话管理

#### 智能会话获取
```rust
// 智能获取或创建会话
let session = SessionService::get_or_create_session(&db, shop_id, customer_id).await?;
// 如果客户已有活跃会话则返回现有的，否则创建新的
```

#### 客服分配
```rust
// 手动分配客服
SessionService::assign_staff_to_session(
    &db,
    session_id,
    staff_id,
    operator_user_id, // 操作者
).await?;

// 自动分配客服（智能算法）
SessionService::auto_assign_staff(&db, session_id).await?;
// 自动选择最合适的客服（可扩展算法）
```

#### 会话管理
```rust
// 获取客服的所有活跃会话
let my_sessions = SessionService::get_staff_active_sessions(&db, staff_id, None).await?;

// 获取未分配的会话
let unassigned = SessionService::get_unassigned_sessions(&db, shop_id, staff_id).await?;

// 设置会话优先级
SessionService::set_session_priority(&db, session_id, 5, operator_id).await?;

// 转移会话给其他客服
SessionService::transfer_session(&db, session_id, new_staff_id, operator_id).await?;

// 关闭会话
SessionService::close_session(&db, session_id, operator_id).await?;
```

---

### 5. MessageService - 消息管理

#### 发送消息
```rust
// 发送文本消息
let message = MessageService::send_message(
    &db,
    session_id,
    "staff",              // 发送者类型
    Some(staff_id),       // 发送者ID
    "你好，我是客服小王", // 消息内容
    "text",               // 消息类型
    None,                 // 文件URL
).await?;

// 发送文件消息
let file_message = MessageService::send_message(
    &db,
    session_id,
    "customer",
    Some(customer_id),
    "这是我的问题截图",
    "image",
    Some("https://files.example.com/screenshot.png"),
).await?;
```

#### 消息查询
```rust
// 获取会话消息历史
let messages = MessageService::get_session_messages(
    &db,
    session_id,
    requester_user_id,
    Some(50), // 限制数量
).await?;

// 分页获取消息
let (messages, total) = MessageService::get_session_messages_paginated(
    &db,
    session_id,
    requester_user_id,
    0,  // 页码
    20, // 每页数量
).await?;

// 获取最后一条消息
let last_msg = MessageService::get_last_message(&db, session_id, staff_id).await?;
```

#### 已读状态管理
```rust
// 批量标记消息为已读
MessageService::mark_messages_as_read(
    &db,
    vec![msg_id1, msg_id2, msg_id3],
    staff_id,
).await?;

// 获取未读消息数量
let unread_count = MessageService::count_unread_messages(
    &db,
    session_id,
    "staff", // 统计对客服而言的未读数（即客户发的消息）
    staff_id,
).await?;
```

#### 消息搜索与删除
```rust
// 搜索消息
let results = MessageService::search_messages(
    &db,
    shop_id,
    staff_id,
    "退款", // 关键词
    Some(20),
).await?;

// 删除单条消息（发送者或店主可删除）
MessageService::delete_message(&db, message_id, operator_id).await?;

// 批量删除消息（仅店主）
MessageService::delete_messages_batch(
    &db,
    vec![msg_id1, msg_id2],
    shop_owner_id,
).await?;
```

---

## 🔧 在 Handler 中的完整使用

### 示例：用户注册 API

```rust
use crate::services::UserService;

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    
    // 1. 输入验证（Service层统一验证）
    UserService::validate_username(&payload.username)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    UserService::validate_password(&payload.password)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    if let Some(ref email) = payload.email {
        UserService::validate_email(email)
            .map_err(|_| StatusCode::BAD_REQUEST)?;
    }
    
    // 2. 业务逻辑（Service层处理）
    let user = UserService::register(
        state.db_orm.get_connection(),
        payload.username,
        payload.password,
        payload.email,
        payload.display_name,
    ).await.map_err(|e| {
        match e.to_string().as_str() {
            "username_already_exists" => StatusCode::CONFLICT,
            "email_already_exists" => StatusCode::CONFLICT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    })?;
    
    // 3. 生成 JWT token（认证逻辑）
    let claims = Claims {
        sub: user.id.to_string(),
        exp: (Utc::now() + Duration::hours(24)).timestamp() as usize,
    };
    
    let token = encode_token(&claims, &jwt_secret_from_env())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // 4. 返回响应
    Ok(Json(AuthResponse {
        token,
        user: user.into(), // 转换为 API 响应格式
    }))
}
```

### 示例：发送消息 API

```rust
use crate::services::{SessionService, MessageService};

pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<i32>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<MessageResponse>, StatusCode> {
    
    let db = state.db_orm.get_connection();
    
    // 1. 获取会话详情（包含权限验证）
    let session = SessionService::get_session_detail(
        db,
        session_id,
        payload.sender_id,
    ).await.map_err(|e| {
        match e.to_string().as_str() {
            "session_not_found" => StatusCode::NOT_FOUND,
            "permission_denied" => StatusCode::FORBIDDEN,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    })?;
    
    // 2. 发送消息（Service层处理业务逻辑）
    let message = MessageService::send_message(
        db,
        session_id,
        &payload.sender_type,
        Some(payload.sender_id),
        &payload.content,
        &payload.message_type,
        payload.file_url.as_deref(),
    ).await.map_err(|e| {
        match e.to_string().as_str() {
            "permission_denied" => StatusCode::FORBIDDEN,
            "message_content_empty" => StatusCode::BAD_REQUEST,
            "message_content_too_long" => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    })?;
    
    // 3. 通过 WebSocket 推送消息给相关用户
    // WebSocket 推送逻辑...
    
    Ok(Json(MessageResponse {
        id: message.id,
        content: message.content,
        created_at: message.created_at,
        sender_type: message.sender_type,
    }))
}
```

---

## 📊 错误处理标准

### Service 层标准错误码

```rust
// 用户相关
"user_not_found"
"username_already_exists"
"email_already_exists"
"invalid_credentials"
"user_inactive"
"password_too_short"
"username_too_short"

// 权限相关
"permission_denied"
"shop_not_found"
"not_shop_owner"
"not_shop_member"

// 业务逻辑相关
"session_not_found"
"message_not_found"
"customer_not_found"
"invalid_message_type"
"message_content_empty"
```

### Handler 中的错误转换

```rust
.map_err(|e| {
    match e.to_string().as_str() {
        "permission_denied" => StatusCode::FORBIDDEN,
        "not_found" | "user_not_found" => StatusCode::NOT_FOUND,
        "already_exists" | "username_already_exists" => StatusCode::CONFLICT,
        "invalid_credentials" => StatusCode::UNAUTHORIZED,
        "validation_error" | "content_empty" => StatusCode::BAD_REQUEST,
        _ => {
            error!("Unexpected error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
})
```

---

## 🎯 最佳实践

### 1. 权限检查先行

```rust
// ✅ 好的做法：在业务逻辑前先检查权限
pub async fn update_shop(user_id: i32, shop_id: i32) -> Result<()> {
    if !ShopService::is_shop_owner(&db, user_id, shop_id).await? {
        anyhow::bail!("permission_denied");
    }
    // 业务逻辑...
}
```

### 2. 输入验证集中化

```rust
// ✅ 使用 Service 层的验证方法
UserService::validate_username(&input.username)?;
ShopService::validate_slug(&input.slug)?;
MessageService::validate_message_type(&input.message_type)?;
```

### 3. 事务边界明确

```rust
// Service 方法应该是完整的业务操作单元
pub async fn register() -> Result<User> {
    // 这里应该是原子操作
    // 要么全部成功，要么全部失败
}
```

### 4. 错误信息安全

```rust
// ✅ 不暴露敏感信息
anyhow::bail!("invalid_credentials"); // 而不是 "user not found"

// ✅ 使用统一的错误码
anyhow::bail!("permission_denied"); // 而不是具体的权限细节
```

---

## 🚀 性能优化建议

### 1. 批量操作

```rust
// ✅ 优先使用批量操作
MessageService::mark_messages_as_read(db, vec![id1, id2, id3]).await?;

// ❌ 避免循环单个操作
for id in message_ids {
    MessageService::mark_message_as_read(db, id).await?; // 低效
}
```

### 2. 权限缓存

```rust
// 未来可以在 Service 层添加权限缓存
// let is_member = cache.get_or_fetch(
//     format!("shop_member:{}:{}", shop_id, user_id),
//     || ShopStaffRepository::is_shop_member(db, shop_id, user_id)
// ).await?;
```

---

## 🎉 总结

Services 层已经完全可用！特点：

✅ **完整的业务逻辑封装**  
✅ **统一的权限控制**  
✅ **标准化的错误处理**  
✅ **丰富的输入验证**  
✅ **清晰的职责分离**  
✅ **易于测试和维护**  

现在可以开始 **Phase 3: 迁移 Handlers** 了！🚀