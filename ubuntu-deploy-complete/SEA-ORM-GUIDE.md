# 🦀 Sea-ORM重构方案（完全现代化）

## 🎯 Sea-ORM：Code-First 数据库管理

如果你想要**完全现代化的ORM体验**，Sea-ORM是Rust生态系统中最先进的选择。

### ✨ 为什么选择Sea-ORM？

- 🔥 **Code-First**: 从Rust结构体自动生成SQL
- 🚀 **异步原生**: 完美配合你的Tokio+Axum架构
- 🛡️ **类型安全**: 编译时检查所有数据库操作
- 📦 **功能完整**: 查询构建器、关系、迁移一应俱全
- 🔄 **自动生成**: 从数据库生成实体，或从实体生成数据库

### 🔧 重构步骤

#### 第1步：添加依赖

```toml
# backend/Cargo.toml
[dependencies]
# 移除或保留sqlx作为底层驱动
sea-orm = { version = "0.12", features = ["sqlx-sqlite", "runtime-tokio-rustls", "macros"] }
sea-orm-migration = "0.12"

[dev-dependencies]
sea-orm-cli = "0.12"
```

#### 第2步：定义实体（替代手工SQL）

```rust
// backend/src/entities/users.rs
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    
    #[sea_orm(unique)]
    pub username: String,
    
    pub password_hash: String,
    
    #[sea_orm(unique)]
    pub email: Option<String>,
    
    pub display_name: Option<String>,
    
    #[sea_orm(column_type = "String(Some(20))", default_value = "staff")]
    pub role: String,
    
    pub avatar_url: Option<String>,
    
    #[sea_orm(default_value = true)]
    pub is_active: bool,
    
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::shops::Entity")]
    Shops,
    
    #[sea_orm(has_many = "super::shop_staffs::Entity")]
    ShopStaffs,
}

impl Related<super::shops::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Shops.def()
    }
}

impl Related<super::shop_staffs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ShopStaffs.def()
    }
}

impl ActiveModelBehavior for ActiveModel {
    fn new() -> Self {
        Self {
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(chrono::Utc::now().naive_utc()),
            ..ActiveModelTrait::default()
        }
    }
    
    fn before_save<C>(mut self, _db: &C, insert: bool) -> Result<Self, DbErr>
    where
        C: ConnectionTrait,
    {
        if !insert {
            self.updated_at = Set(chrono::Utc::now().naive_utc());
        }
        Ok(self)
    }
}
```

```rust
// backend/src/entities/shops.rs
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "shops")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub name: String,
    
    #[sea_orm(unique)]
    pub slug: String,
    
    pub description: Option<String>,
    pub owner_id: Option<i32>,
    
    #[sea_orm(default_value = true)]
    pub is_active: bool,
    
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::OwnerId",
        to = "super::users::Column::Id"
    )]
    Owner,
    
    #[sea_orm(has_many = "super::shop_staffs::Entity")]
    ShopStaffs,
    
    #[sea_orm(has_many = "super::customers::Entity")]
    Customers,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Owner.def()
    }
}
```

```rust
// backend/src/entities/shop_staffs.rs - 重要！之前缺失的表
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "shop_staffs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub shop_id: i32,
    pub user_id: i32,
    
    #[sea_orm(column_type = "String(Some(20))", default_value = "staff")]
    pub role: String,
    
    pub permissions: Option<Json>,
    
    #[sea_orm(default_value = true)]
    pub is_active: bool,
    
    pub joined_at: DateTime,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::shops::Entity",
        from = "Column::ShopId",
        to = "super::shops::Column::Id"
    )]
    Shop,
    
    #[sea_orm(
        belongs_to = "super::users::Entity", 
        from = "Column::UserId",
        to = "super::users::Column::Id"
    )]
    User,
}

// 复合唯一键
impl Entity {
    pub fn find_by_shop_and_user(shop_id: i32, user_id: i32) -> Select<Self> {
        Self::find()
            .filter(Column::ShopId.eq(shop_id))
            .filter(Column::UserId.eq(user_id))
    }
}
```

#### 第3步：创建迁移（自动生成）

```rust
// migration/src/lib.rs
pub use sea_orm_migration::prelude::*;

mod m20241014_000001_create_users_table;
mod m20241014_000002_create_shops_table;
mod m20241014_000003_create_shop_staffs_table;
// ... 其他迁移

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20241014_000001_create_users_table::Migration),
            Box::new(m20241014_000002_create_shops_table::Migration),
            Box::new(m20241014_000003_create_shop_staffs_table::Migration),
            // ...
        ]
    }
}
```

```rust
// migration/src/m20241014_000001_create_users_table.rs
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Users::Id).integer().not_null().auto_increment().primary_key())
                    .col(ColumnDef::new(Users::Username).string_len(50).not_null().unique_key())
                    .col(ColumnDef::new(Users::PasswordHash).string_len(255).not_null())
                    .col(ColumnDef::new(Users::Email).string_len(100).unique_key())
                    .col(ColumnDef::new(Users::DisplayName).string_len(100))
                    .col(ColumnDef::new(Users::Role).string_len(20).not_null().default("staff"))
                    .col(ColumnDef::new(Users::AvatarUrl).text())
                    .col(ColumnDef::new(Users::IsActive).boolean().not_null().default(true))
                    .col(ColumnDef::new(Users::CreatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .col(ColumnDef::new(Users::UpdatedAt).timestamp().not_null().default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;
            
        // 创建索引
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_users_username")
                    .table(Users::Table)
                    .col(Users::Username)
                    .to_owned(),
            )
            .await?;
            
        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Users::Table).to_owned())
            .await
    }
}

#[derive(Iden)]
enum Users {
    Table,
    Id,
    Username,
    PasswordHash,
    Email,
    DisplayName,
    Role,
    AvatarUrl,
    IsActive,
    CreatedAt,
    UpdatedAt,
}
```

#### 第4步：更新数据库操作

```rust
// backend/src/database.rs - 全新的ORM版本
use sea_orm::*;
use migration::{Migrator, MigratorTrait};

pub struct Database {
    connection: DatabaseConnection,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let connection = sea_orm::Database::connect(database_url).await?;
        
        Ok(Database { connection })
    }
    
    pub fn get_connection(&self) -> &DatabaseConnection {
        &self.connection
    }
    
    pub async fn migrate(&self) -> Result<()> {
        Migrator::up(&self.connection, None).await?;
        Ok(())
    }
}

// 现代化的数据操作
impl Database {
    pub async fn create_user(&self, username: &str, password_hash: &str, email: Option<&str>) -> Result<users::Model> {
        let user = users::ActiveModel {
            username: Set(username.to_owned()),
            password_hash: Set(password_hash.to_owned()),
            email: Set(email.map(|s| s.to_owned())),
            ..Default::default()
        };
        
        let user = user.insert(&self.connection).await?;
        Ok(user)
    }
    
    pub async fn find_user_by_username(&self, username: &str) -> Result<Option<users::Model>> {
        let user = users::Entity::find()
            .filter(users::Column::Username.eq(username))
            .one(&self.connection)
            .await?;
        Ok(user)
    }
    
    // 关联查询 - ORM的强大之处
    pub async fn get_user_with_shops(&self, user_id: i32) -> Result<Option<(users::Model, Vec<shops::Model>)>> {
        let user_with_shops = users::Entity::find_by_id(user_id)
            .find_with_related(shops::Entity)
            .all(&self.connection)
            .await?;
            
        Ok(user_with_shops.into_iter().next())
    }
    
    // 复杂查询 - 现在变得简单
    pub async fn get_shop_stats(&self, user_id: i32) -> Result<DashboardStats> {
        // 获取可访问的店铺（所有者 + 员工）
        let accessible_shops = shops::Entity::find()
            .filter(
                Condition::any()
                    .add(shops::Column::OwnerId.eq(user_id))
                    .add(
                        shops::Column::Id.in_subquery(
                            Query::select()
                                .column(shop_staffs::Column::ShopId)
                                .from(shop_staffs::Entity)
                                .and_where(shop_staffs::Column::UserId.eq(user_id))
                                .to_owned()
                        )
                    )
            )
            .all(&self.connection)
            .await?;
            
        let shop_ids: Vec<i32> = accessible_shops.iter().map(|s| s.id).collect();
        
        // 统计活跃客户
        let active_customers = customers::Entity::find()
            .filter(customers::Column::ShopId.is_in(&shop_ids))
            .filter(customers::Column::LastActiveAt.gte(chrono::Utc::now() - chrono::Duration::days(7)))
            .count(&self.connection)
            .await?;
            
        // 其他统计...
        
        Ok(DashboardStats {
            total_shops: accessible_shops.len() as i64,
            active_customers: active_customers as i64,
            // ...
        })
    }
}
```

### 🚀 Sea-ORM的强大功能

#### 1. 自动生成工具

```bash
# 从现有数据库生成实体
sea-orm-cli generate entity -o backend/src/entities --database-url sqlite://customer_service.db

# 生成新迁移
sea-orm-cli migrate generate create_new_table

# 应用迁移
sea-orm-cli migrate up

# 生成完整SQL schema
sea-orm-cli migrate generate-schema --database-url sqlite://temp.db > complete_schema.sql
```

#### 2. 类型安全的查询

```rust
// 编译时检查，运行时不会出错
let users = users::Entity::find()
    .filter(users::Column::IsActive.eq(true))
    .filter(users::Column::Role.eq("admin"))
    .order_by_asc(users::Column::Username)
    .limit(10)
    .all(&db)
    .await?;
```

#### 3. 关联查询

```rust
// 一次查询获取用户及其所有店铺
let users_with_shops = users::Entity::find()
    .find_with_related(shops::Entity)
    .all(&db)
    .await?;
    
// 预加载关联数据
let shops = shops::Entity::find()
    .find_with_related(shop_staffs::Entity)
    .filter(shop_staffs::Column::IsActive.eq(true))
    .all(&db)
    .await?;
```

## 📊 方案对比

| 特性 | 当前SQLx | SQLx Migration | Sea-ORM |
|------|----------|----------------|---------|
| **类型安全** | ⚠️ 运行时检查 | ⚠️ 运行时检查 | ✅ 编译时检查 |
| **代码生成** | ❌ 手工SQL | ⚠️ 手工SQL | ✅ 从实体生成 |
| **关联查询** | ❌ 手工JOIN | ⚠️ 手工JOIN | ✅ 自动处理 |
| **迁移管理** | ❌ 无 | ✅ 版本化 | ✅ 版本化+类型安全 |
| **学习曲线** | 低 | 中 | 中高 |
| **性能** | 高 | 高 | 高 |
| **维护成本** | 高 | 中 | 低 |

## 🎯 推荐选择

**对于你的项目，我推荐**：

### 短期：SQLx Migration
- ✅ **最小改动** - 快速解决当前问题
- ✅ **立即收益** - 消除schema不同步问题
- ✅ **渐进升级** - 为将来的ORM升级铺路

### 长期：Sea-ORM  
- 🚀 **现代化架构** - 完全配得上你的Rust后端水准
- 🛡️ **类型安全** - 编译时发现数据库相关bug
- 📈 **开发效率** - 复杂查询变得简单优雅

你可以**先实施SQLx Migration**解决眼前问题，然后逐步迁移到Sea-ORM！