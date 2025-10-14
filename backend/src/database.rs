// 简化的 Database 结构 - 仅保留连接管理和迁移功能
// 所有业务逻辑已迁移到 Services/Repositories 层

use anyhow::Result;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tracing::info;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        Ok(Database { pool })
    }

    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn migrate(&self) -> Result<()> {
        info!("Running legacy database migrations...");

        // 读取并执行 schema - 临时禁用
        // let schema = include_str!("schema.sql");
        let schema = "-- Temporarily disabled";

        // 先创建所有表，然后创建索引
        let statements: Vec<&str> = schema.split(';').collect();
        
        // 第一轮：只执行 CREATE TABLE 语句
        for statement in &statements {
            let statement = statement.trim();
            if !statement.is_empty() && !statement.starts_with("--") && statement.to_uppercase().contains("CREATE TABLE") {
                tracing::info!("Creating table: {}", statement.lines().nth(0).unwrap_or(""));
                match sqlx::query(statement).execute(&self.pool).await {
                    Ok(_) => {
                        tracing::debug!("Table created successfully");
                    }
                    Err(e) => {
                        let error_msg = e.to_string().to_lowercase();
                        if error_msg.contains("already exists") {
                            tracing::debug!("Table already exists, skipping");
                        } else {
                            tracing::error!("Failed to create table: {} for statement: {}", e, statement);
                            return Err(e.into());
                        }
                    }
                }
            }
        }

        // 第二轮：执行 CREATE INDEX 语句
        for statement in &statements {
            let statement = statement.trim();
            if !statement.is_empty() && !statement.starts_with("--") && statement.to_uppercase().contains("CREATE INDEX") {
                tracing::info!("Creating index: {}", statement.lines().nth(0).unwrap_or(""));
                match sqlx::query(statement).execute(&self.pool).await {
                    Ok(_) => {
                        tracing::debug!("Index created successfully");
                    }
                    Err(e) => {
                        let error_msg = e.to_string().to_lowercase();
                        if error_msg.contains("already exists") {
                            tracing::debug!("Index already exists, skipping");
                        } else {
                            tracing::warn!("Failed to create index: {} (继续执行)", e);
                            // 索引创建失败不阻塞启动
                        }
                    }
                }
            }
        }

        info!("✅ Legacy database migrations completed successfully");
        Ok(())
    }
}

// =====================================================
// 注意：以下所有业务逻辑方法已迁移到 Services/Repositories 层
// 
// 迁移映射：
// - 用户相关 -> UserService + UserRepository
// - 店铺相关 -> ShopService + ShopRepository  
// - 客户相关 -> CustomerService + CustomerRepository
// - 会话相关 -> SessionService + SessionRepository
// - 消息相关 -> MessageService + MessageRepository
// - 权限检查 -> Services 层统一处理
//
// 新架构：Handler -> Service -> Repository -> Sea-ORM -> Database
// =====================================================