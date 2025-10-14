# 🎯 Sea-ORM 模块化重构计划

## 📊 当前状态分析

### 🔴 问题诊断

#### 1. **双重数据库实现（严重冗余）**
```
❌ database.rs (693行) - 使用 sqlx + 手写 SQL
❌ repositories/* (7个文件) - 使用 Sea-ORM
✅ entities/* (9个文件) - Sea-ORM 实体定义完整
✅ migration/* (8个迁移文件) - Sea-ORM 迁移完整
```

**冗余内容：**
- `database.rs` 和 `repositories/*` 实现了相同的功能
- `main.rs` 中同时初始化 `db` (sqlx) 和 `db_orm` (sea-orm)
- **Handlers 仍在使用 `state.db` (sqlx)，未使用 repositories**

#### 2. **文件行数问题**
```
database.rs: 693行 ❌ (超过400行限制)
```

#### 3. **依赖方向混乱**
```
当前: handlers -> Database (sqlx) ❌
目标: handlers -> services -> repositories (sea-orm) ✅
```

---

## 🚀 重构方案

### 第一阶段：补全 Repositories（确保功能完整）

#### 目标：让 repositories 覆盖所有 database.rs 的功能

**需要补充的方法：**

1. **UserRepository** (已有基础，需补充)
   - ✅ `find_by_username`
   - ✅ `find_by_id`
   - ✅ `create`
   - ❌ `update_profile` (需要添加)
   - ❌ `change_password` (需要添加)

2. **ShopRepository** (已有，需补充)
   - ✅ `find_by_id`
   - ✅ `create`
   - ✅ `find_by_owner`
   - ✅ `find_accessible_by_user`
   - ❌ `find_by_api_key` (需要添加)
   - ✅ `update`

3. **CustomerRepository** (已有，需补充)
   - ✅ `find_by_id`
   - ✅ `create_or_update`
   - ✅ `find_by_shop`
   - ❌ `get_customers_overview_by_shop` (聚合查询，需要添加)

4. **SessionRepository** (需要检查)
   - 需要添加：`create`, `find_by_shop_customer`, `update_last_message_at`

5. **MessageRepository** (需要检查)
   - 需要添加：`create`, `find_by_session`

6. **ShopStaffRepository** (需要补充)
   - ❌ `list_shop_staff` (需要添加)
   - ❌ `add_staff_by_username` (需要添加)
   - ❌ `remove_staff` (需要添加)
   - ❌ `is_shop_owner` (需要添加)
   - ❌ `is_shop_member` (需要添加)

---

### 第二阶段：创建 Services 层（业务逻辑）

#### 目标：将复杂业务逻辑从 handlers 移到 services

**新建文件：**
```
backend/src/services/
├── mod.rs (已有，需更新)
├── user_service.rs (新建)
├── shop_service.rs (新建)
├── customer_service.rs (新建)
├── session_service.rs (新建)
├── message_service.rs (新建)
└── staff_service.rs (新建)
```

**职责划分：**
- **Handlers**: 请求解析、响应格式化、错误处理
- **Services**: 业务逻辑、事务协调、跨实体操作
- **Repositories**: 单实体CRUD、数据访问

---

### 第三阶段：迁移 Handlers

#### 目标：让 handlers 使用 repositories/services 而不是直接用 database.rs

**迁移顺序：**
1. ✅ `handlers/auth.rs` → 使用 `UserRepository`
2. ✅ `handlers/shop.rs` → 使用 `ShopRepository` + `ShopService`
3. ✅ `handlers/customer.rs` → 使用 `CustomerRepository`
4. ✅ `handlers/session.rs` → 使用 `SessionRepository`
5. ✅ `handlers/message.rs` → 使用 `MessageRepository`
6. ✅ `handlers/staff.rs` → 使用 `ShopStaffRepository` + `StaffService`

---

### 第四阶段：清理冗余代码

#### 目标：移除 database.rs 中已被替代的方法

**保留部分：**
```rust
// database.rs (最终简化版)
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(url: &str) -> Result<Self> { ... }
    pub fn pool(&self) -> &SqlitePool { ... }
    pub async fn migrate(&self) -> Result<()> { ... } // 只用于回退
}
```

**移除部分：**
- ❌ 所有 `create_*`, `get_*`, `update_*` 方法
- ❌ 所有业务逻辑

---

### 第五阶段：统一数据库连接

#### 目标：只使用一个数据库连接（Sea-ORM）

**修改 `main.rs`：**
```rust
// 旧代码（双重初始化）❌
let db = Database::new(&db_url).await?;
let db_orm = database_orm::Database::new(&db_url).await?;
let state = AppState { db, db_orm, ... };

// 新代码（单一连接）✅
let db_orm = database_orm::Database::new(&db_url).await?;
database_orm::run_migrations(db_orm.get_connection()).await?;
let state = AppState { db_orm, ... };
```

**修改 `AppState`：**
```rust
// 旧代码 ❌
pub struct AppState {
    pub db: Database,
    pub db_orm: database_orm::Database,
    pub connections: Arc<Mutex<ConnectionManager>>,
}

// 新代码 ✅
pub struct AppState {
    pub db: database_orm::Database, // 统一命名
    pub connections: Arc<Mutex<ConnectionManager>>,
}
```

---

## 📁 模块化架构（最终目标）

```
backend/src/
├── main.rs (简化，只负责启动)
├── auth.rs (认证/授权)
├── jwt.rs (JWT工具)
├── error.rs (错误类型)
├── models.rs (API DTO)
├── constants.rs (常量)
│
├── database_orm/ (Sea-ORM 连接层) ✅
│   ├── mod.rs
│   ├── connection.rs
│   └── migration.rs
│
├── entities/ (ORM 实体) ✅ 完整
│   ├── mod.rs
│   ├── users.rs
│   ├── shops.rs
│   ├── customers.rs
│   ├── sessions.rs
│   ├── messages.rs
│   ├── shop_staffs.rs
│   ├── unread_counts.rs
│   └── online_status.rs
│
├── repositories/ (数据访问层) 🔄 需补全
│   ├── mod.rs
│   ├── user.rs
│   ├── shop.rs
│   ├── customer.rs
│   ├── session.rs
│   ├── message.rs
│   └── shop_staff.rs
│
├── services/ (业务逻辑层) 🆕 需创建
│   ├── mod.rs
│   ├── user_service.rs (新)
│   ├── shop_service.rs (新)
│   ├── customer_service.rs (新)
│   ├── session_service.rs (新)
│   ├── message_service.rs (新)
│   └── staff_service.rs (新)
│
├── handlers/ (HTTP处理器) 🔄 需迁移
│   ├── mod.rs
│   ├── auth.rs → 改用 UserRepository
│   ├── shop.rs → 改用 ShopRepository/Service
│   ├── customer.rs → 改用 CustomerRepository
│   ├── session.rs → 改用 SessionRepository
│   ├── message.rs → 改用 MessageRepository
│   ├── staff.rs → 改用 ShopStaffRepository
│   └── ...
│
└── websocket/ (WebSocket) ✅ 保持不变
```

---

## ✅ 验收标准

### 功能完整性
- [ ] 所有 API 端点正常工作
- [ ] 所有 WebSocket 功能正常
- [ ] 数据库查询结果一致

### 代码质量
- [ ] 无文件超过 400 行
- [ ] 无重复代码（≥3次）
- [ ] 依赖方向清晰：handlers → services → repositories
- [ ] 无死代码/未使用函数

### 性能
- [ ] API 响应时间 < 100ms
- [ ] 数据库连接池配置合理
- [ ] 无 N+1 查询问题

### 文档
- [ ] 每个模块有清晰的职责说明
- [ ] 关键函数有注释
- [ ] README 更新

---

## 📝 实施步骤

### Phase 1: 补全 Repositories (今天)
1. ✅ 补充 UserRepository 缺失方法
2. ✅ 补充 ShopRepository 缺失方法
3. ✅ 补充 CustomerRepository 聚合查询
4. ✅ 补充 SessionRepository 完整实现
5. ✅ 补充 MessageRepository 完整实现
6. ✅ 补充 ShopStaffRepository 完整实现

### Phase 2: 创建 Services (今天)
1. ✅ 创建 UserService
2. ✅ 创建 ShopService
3. ✅ 创建 CustomerService
4. ✅ 创建 SessionService
5. ✅ 创建 MessageService
6. ✅ 创建 StaffService

### Phase 3: 迁移 Handlers (明天)
1. 迁移 auth.rs
2. 迁移 shop.rs
3. 迁移 customer.rs
4. 迁移 session.rs
5. 迁移 message.rs
6. 迁移 staff.rs

### Phase 4: 清理 & 测试 (明天)
1. 清理 database.rs
2. 统一 AppState
3. 更新 main.rs
4. 全面测试

---

## 🎯 下一步行动

**立即开始：Phase 1 - 补全 Repositories**

准备好了吗？我们从补充 repositories 开始！
