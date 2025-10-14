# 🏗️ 数据库架构生成方式完全指南

## 🤔 你的核心问题

**"像这种项目是要如何生成完整的数据库架构的？"**

这是一个非常好的问题！当前项目的做法确实不够专业，让我展示标准的解决方案。

## 📊 当前项目的问题分析

### 现状：手工维护（不可靠）

```
开发流程：
1. 开发者手写 backend/src/schema.sql
2. Rust编译时嵌入：include_str!("schema.sql")
3. 部署时手动维护另一份：ubuntu-deploy-complete/database_schema.sql
4. 😈 两个文件不同步 → 生产事故
```

**问题**：
- ❌ 人工维护容易出错
- ❌ 文件分离导致不一致
- ❌ 无法保证schema与代码同步
- ❌ 难以版本管理

## 🎯 标准解决方案

### 方案1: ORM自动生成（推荐⭐）

**原理**: 从代码结构体自动生成SQL

#### 1.1 使用 Sea-ORM (现代推荐)

```rust
// Cargo.toml
[dependencies]
sea-orm = { version = "0.12", features = ["sqlx-sqlite", "runtime-tokio-rustls", "macros"] }
sea-orm-migration = "0.12"

// entities/mod.rs - 定义实体
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    #[sea_orm(column_type = "Timestamp")]
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::shops::Entity")]
    Shops,
}

// migration/mod.rs - 自动生成迁移
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl Migration for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(Users::Username).string().not_null().unique_key())
                    .col(ColumnDef::new(Users::PasswordHash).string().not_null())
                    .col(ColumnDef::new(Users::Email).string())
                    .col(ColumnDef::new(Users::CreatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await
    }
}

// 生成命令
// sea-orm-cli generate schema -o entities
// sea-orm-cli migrate generate create_users_table
```

**自动生成**：
```bash
# 从数据库生成实体
sea-orm-cli generate entity -o entities --database-url sqlite://./db.sqlite

# 生成迁移文件
sea-orm-cli migrate generate create_users_table

# 应用迁移
sea-orm-cli migrate up
```

#### 1.2 使用 Diesel (成熟方案)

```rust
// Cargo.toml
[dependencies] 
diesel = { version = "2.1.0", features = ["sqlite", "chrono"] }

// schema.rs - 自动生成
diesel::table! {
    users (id) {
        id -> Integer,
        username -> Text,
        password_hash -> Text,
        email -> Nullable<Text>,
        created_at -> Timestamp,
    }
}

// models.rs
use diesel::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Queryable, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
    pub username: &'a str,
    pub password_hash: &'a str,
    pub email: Option<&'a str>,
}
```

**自动生成**：
```bash
# 创建迁移
diesel migration generate create_users

# 应用迁移（自动更新schema.rs）
diesel migration run

# 导出schema
diesel print-schema > complete_schema.sql
```

### 方案2: 代码生成（Code Generation）

#### 2.1 使用 build.rs 编译时生成

```rust
// build.rs
use std::fs;
use std::env;

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    
    // 从模型定义生成SQL
    let schema_sql = generate_schema_from_models();
    
    fs::write(
        format!("{}/schema.sql", out_dir),
        schema_sql
    ).unwrap();
    
    // 告诉cargo重新编译的条件
    println!("cargo:rerun-if-changed=src/models.rs");
}

fn generate_schema_from_models() -> String {
    // 解析src/models.rs中的结构体
    // 生成对应的CREATE TABLE语句
    // 这里可以使用syn crate解析Rust代码
    todo!("解析模型并生成SQL")
}
```

```rust
// src/database.rs
const SCHEMA_SQL: &str = include_str!(concat!(env!("OUT_DIR"), "/schema.sql"));

pub async fn migrate(&self) -> Result<()> {
    sqlx::query(SCHEMA_SQL).execute(&self.pool).await?;
    Ok(())
}
```

#### 2.2 使用宏自动生成

```rust
// src/schema_macro.rs
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(DatabaseTable)]
pub fn database_table_derive(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = input.ident;
    let table_name = name.to_string().to_lowercase();
    
    // 分析字段并生成CREATE TABLE SQL
    let sql = generate_create_table_sql(&input);
    
    let expanded = quote! {
        impl #name {
            pub const CREATE_TABLE_SQL: &'static str = #sql;
        }
    };
    
    TokenStream::from(expanded)
}

// 使用
#[derive(DatabaseTable, Serialize, Deserialize)]
pub struct User {
    #[primary_key]
    pub id: i32,
    #[unique]
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    #[default = "CURRENT_TIMESTAMP"]
    pub created_at: DateTime<Utc>,
}

// 自动生成：User::CREATE_TABLE_SQL
```

### 方案3: 数据库优先（Database-First）

#### 3.1 从数据库导出

```bash
# SQLite
sqlite3 database.db ".schema" > complete_schema.sql
sqlite3 database.db ".dump" > complete_backup.sql

# PostgreSQL
pg_dump --schema-only dbname > schema.sql

# MySQL  
mysqldump --no-data dbname > schema.sql
```

#### 3.2 使用专业工具

**SQLite Expert / DB Browser**:
- 图形化设计数据库
- 导出完整schema
- 生成插入脚本

**DbSchema / DataGrip**:
- 专业数据库设计工具
- 版本控制集成
- 自动生成文档

### 方案4: 迁移驱动（Migration-Driven）

#### 4.1 Laravel风格迁移

```rust
// migrations/001_create_users_table.rs
use sqlx::migrate::Migrator;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    MIGRATOR.run(pool).await?;
    Ok(())
}
```

```sql
-- migrations/001_create_users_table.sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- migrations/002_add_email_to_users.sql  
ALTER TABLE users ADD COLUMN email VARCHAR(100);

-- migrations/003_create_shops_table.sql
CREATE TABLE shops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);
```

**生成完整schema**:
```bash
# 应用所有迁移到空数据库
sqlite3 temp.db < migrations/*.sql

# 导出完整schema
sqlite3 temp.db ".schema" > complete_schema.sql

# 清理
rm temp.db
```

## 🔧 推荐的重构方案

### 对于你的项目，我推荐这样重构：

#### 方案A: 最小改动 - 使用SQLx Migration

```rust
// Cargo.toml
[dependencies]
sqlx = { version = "0.7", features = ["migrate", "sqlite", "runtime-tokio-rustls"] }

// src/database.rs
use sqlx::migrate::Migrator;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

impl Database {
    pub async fn migrate(&self) -> Result<()> {
        info!("Running database migrations...");
        MIGRATOR.run(&self.pool).await?;
        info!("Database migrations completed");
        Ok(())
    }
}
```

```
项目结构：
migrations/
├── 001_create_users.sql
├── 002_create_shops.sql
├── 003_create_customers.sql
├── 004_create_sessions.sql
├── 005_create_messages.sql
├── 006_create_shop_staffs.sql
└── 007_create_unread_counts.sql
```

**生成完整schema**:
```rust
// src/bin/generate_schema.rs
use sqlx::SqlitePool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 创建临时数据库
    let pool = SqlitePool::connect("sqlite::memory:").await?;
    
    // 应用所有迁移
    sqlx::migrate!("./migrations").run(&pool).await?;
    
    // 导出schema
    let schema = sqlx::query_scalar::<_, String>(
        "SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetch_all(&pool).await?;
    
    println!("{}", schema.join(";\n\n"));
    Ok(())
}
```

```bash
# 生成完整schema
cargo run --bin generate_schema > ubuntu-deploy-complete/database_schema.sql
```

#### 方案B: 现代化 - 使用Sea-ORM

完全重构为Sea-ORM，从实体定义自动生成所有内容。

#### 方案C: 混合方案 - 保持当前+工具化

```rust
// src/bin/sync_schema.rs - 自动同步工具
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let source = "src/schema.sql";
    let target = "ubuntu-deploy-complete/database_schema.sql";
    
    let content = fs::read_to_string(source)?;
    fs::write(target, content)?;
    
    println!("✅ Schema synchronized: {} -> {}", source, target);
    Ok(())
}
```

```bash
# 自动同步
cargo run --bin sync_schema

# 或集成到构建过程
# build.rs
fn main() {
    // 编译时自动同步
    std::process::Command::new("cargo")
        .args(["run", "--bin", "sync_schema"])
        .output()
        .expect("Failed to sync schema");
}
```

## 🎯 最佳实践总结

### 小项目（当前适用）
1. **SQLx Migration** - 版本化迁移文件
2. **自动生成工具** - 从迁移生成完整schema  
3. **CI/CD验证** - 确保文件同步

### 中大型项目
1. **ORM Code-First** - Sea-ORM/Diesel
2. **专业迁移工具** - 结构化版本管理
3. **测试环境验证** - 自动化schema测试

### 关键原则
- **单一数据源** - 避免重复维护
- **版本控制** - 所有变更可追踪
- **自动化工具** - 减少人工错误
- **测试覆盖** - 验证schema正确性

---

现在明白了吗？关键不是"手写SQL"，而是**如何系统性地管理和生成**数据库架构！