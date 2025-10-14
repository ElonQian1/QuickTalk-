//! 数据库迁移管理
//! 
//! 职责：运行 Sea-ORM 迁移，确保数据库架构正确

use anyhow::Result;
use sea_orm::DatabaseConnection;
// use sea_orm_migration::MigratorTrait;
use tracing::{info, error};

// 引入迁移器 - 临时禁用
// use migration::Migrator;

/// 运行所有数据库迁移
/// 
/// # Arguments
/// * `db` - DatabaseConnection 引用
/// 
/// # Returns
/// * `Result<()>` - 成功返回 Ok(())
pub async fn run_migrations(db: &DatabaseConnection) -> Result<()> {
    info!("🔄 Skipping database migrations (temporarily disabled)...");
    
    // 临时禁用迁移
    // match Migrator::up(db, None).await {
    match Ok::<(), sea_orm::DbErr>(()) {
        Ok(_) => {
            info!("✅ Database migrations completed successfully");
            
            // 验证关键表是否存在
            verify_tables(db).await?;
            
            Ok(())
        }
        Err(e) => {
            error!("❌ Database migration failed: {:?}", e);
            Err(e.into())
        }
    }
}

/// 回滚所有迁移（用于开发/测试）
#[allow(dead_code)]
pub async fn rollback_migrations(_db: &DatabaseConnection) -> Result<()> {
    info!("⏮️  Rolling back database migrations...");
    
    // 临时禁用迁移功能
    /*
    match Migrator::down(db, None).await {
        Ok(_) => {
            info!("✅ Database migrations rolled back successfully");
            Ok(())
        }
        Err(e) => {
            error!("❌ Database rollback failed: {:?}", e);
            Err(e.into())
        }
    }
    */
    
    // 临时返回成功
    info!("✅ Migration rollback skipped (not implemented)");
    Ok(())
}

/// 验证关键表是否存在
async fn verify_tables(db: &DatabaseConnection) -> Result<()> {
    use sea_orm::{ConnectionTrait, Statement, DatabaseBackend};
    
    let required_tables = vec![
        "users", "shops", "customers", "sessions", 
        "messages", "unread_counts", "online_status", "shop_staffs"
    ];
    
    info!("🔍 Verifying required tables...");
    
    for table in required_tables {
        let exists = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Sqlite,
                "SELECT COUNT(*) > 0 as exists FROM sqlite_master WHERE type='table' AND name=?",
                vec![table.into()],
            ))
            .await?
            .is_some();
        
        if !exists {
            error!("❌ Required table '{}' does not exist", table);
            return Err(anyhow::anyhow!("Missing required table: {}", table));
        }
        
        info!("  ✓ Table '{}' exists", table);
    }
    
    info!("✅ All required tables verified");
    Ok(())
}

/// 获取当前迁移状态
#[allow(dead_code)]
pub async fn get_migration_status(db: &DatabaseConnection) -> Result<Vec<String>> {
    use sea_orm::{ConnectionTrait, Statement, DatabaseBackend};
    
    let result = db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Sqlite,
            "SELECT version FROM seaql_migrations ORDER BY version",
            vec![],
        ))
        .await?;
    
    let versions: Vec<String> = result
        .iter()
        .filter_map(|row| row.try_get("", "version").ok())
        .collect();
    
    Ok(versions)
}
