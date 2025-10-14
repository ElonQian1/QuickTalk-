# 🚀 Sea-ORM 重构实施指南

## ✅ 已完成步骤

### 1. 依赖配置
- ✅ 已添加 `sea-orm = "0.12"` 到 `backend/Cargo.toml`
- ✅ 已创建 `backend/migration/` 工作空间

### 2. 数据库迁移
- ✅ 已创建 8 个迁移文件：
  - `m20241014_000001_create_users_table.rs`
  - `m20241014_000002_create_shops_table.rs`
  - `m20241014_000003_create_customers_table.rs`
  - `m20241014_000004_create_sessions_table.rs`
  - `m20241014_000005_create_messages_table.rs`
  - `m20241014_000006_create_shop_staffs_table.rs`
  - `m20241014_000007_create_unread_counts_table.rs`
  - `m20241014_000008_create_online_status_table.rs`

## 📝 后续步骤

### 步骤 3: 生成 Sea-ORM 实体

有两种方式生成实体：

#### 方式 A: 使用 sea-orm-cli（推荐）

```powershell
# 1. 安装 sea-orm-cli
cargo install sea-orm-cli

# 2. 创建临时数据库并应用迁移
cd backend
New-Item -ItemType File -Path temp.db -Force

# 3. 运行迁移（需要先更新 backend/src/main.rs 添加迁移支持）
# 或者手动运行：
sqlite3 temp.db < migration/generated_schema.sql

# 4. 从数据库生成实体
sea-orm-cli generate entity \
  --database-url sqlite://temp.db \
  --output-dir src/entities \
  --with-serde both

# 5. 清理
Remove-Item temp.db
```

#### 方式 B: 手动创建实体（完全控制）

我可以为你创建所有实体文件。这需要创建 8 个文件：
- `src/entities/users.rs`
- `src/entities/shops.rs`
- `src/entities/customers.rs`
- `src/entities/sessions.rs`
- `src/entities/messages.rs`
- `src/entities/shop_staffs.rs`
- `src/entities/unread_counts.rs`
- `src/entities/online_status.rs`
- `src/entities/mod.rs`（模块入口）

### 步骤 4: 更新 backend/src/main.rs

```rust
// 添加模块声明
mod entities;
mod migration;

use migration::{Migrator, MigratorTrait};
use sea_orm::{Database as SeaDatabase, DatabaseConnection};

// 在 main 函数中使用 Sea-ORM
#[tokio::main]
async fn main() -> Result<()> {
    // ...

    // 使用 Sea-ORM 连接
    let db: DatabaseConnection = SeaDatabase::connect(&database_url).await?;
    
    // 运行迁移
    Migrator::up(&db, None).await?;
    
    // 创建 AppState
    let state = AppState {
        db: db.clone(),
        connections: Arc::new(Mutex::new(ConnectionManager::new())),
    };
    
    // ...
}
```

### 步骤 5: 更新 database.rs

将当前的 sqlx 查询逐步替换为 Sea-ORM 查询。

### 步骤 6: 生成完整 SQL Schema

```powershell
# 从迁移生成完整 SQL
cd backend
cargo run --bin generate_schema > ../ubuntu-deploy-complete/database_schema_generated.sql
```

## 🎯 你想选择哪种方式？

1. **自动生成（快速）**: 我帮你安装 sea-orm-cli 并生成实体
2. **手动创建（完全控制）**: 我为你创建所有实体文件，包含完整的关联关系定义

请告诉我你的选择，我会继续实施！
