//! 数据库迁移管理
//! 
//! 职责：运行 Sea-ORM 迁移，确保数据库架构正确

use anyhow::Result;
use sea_orm::{DatabaseConnection, Statement, DbBackend, ConnectionTrait};
use tracing::{info, error, warn};

/// 运行所有数据库迁移
/// 
/// # Arguments
/// * `db` - DatabaseConnection 引用
/// 
/// # Returns
/// * `Result<()>` - 成功返回 Ok(())
pub async fn run_migrations(db: &DatabaseConnection) -> Result<()> {
    // 检查是否强制跳过迁移
    let skip_migration = std::env::var("FORCE_SKIP_MIGRATION")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    if skip_migration {
        warn!("⚠️  强制跳过 Sea-ORM migration (FORCE_SKIP_MIGRATION=true)");
        return verify_tables(db).await;
    }

    info!("🔄 启用智能数据库迁移 (兼容性修复版本)...");
    
    // 尝试通过手动 SQL 创建表（避免 IF NOT EXISTS 兼容性问题）
    match create_tables_manually(db).await {
        Ok(_) => {
            info!("✅ 手动数据库迁移完成");
            verify_tables(db).await
        }
        Err(e) => {
            error!("❌ 手动迁移失败: {}", e);
            // 继续验证表是否已存在
            verify_tables(db).await
        }
    }
}

/// 手动创建数据库表 (避免 IF NOT EXISTS 兼容性问题)
async fn create_tables_manually(db: &DatabaseConnection) -> Result<()> {
    info!("📝 手动创建数据库表 (兼容性版本)...");

    // 先检查表是否存在，避免重复创建
    if table_exists(db, "users").await? {
        info!("✅ 数据库表已存在，跳过创建");
        return Ok(());
    }

    // 创建 users 表 - 使用标准 CREATE TABLE 语法
    let create_users = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            role VARCHAR(20) NOT NULL DEFAULT 'staff',
            avatar_url TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            last_login TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        "#.to_string()
    );
    
    match db.execute(create_users).await {
        Ok(_) => info!("✅ users 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ users 表已存在");
        }
        Err(e) => {
            error!("❌ users 表创建失败: {}", e);
            return Err(anyhow::anyhow!("Failed to create users table: {}", e));
        }
    }

    // 创建 shops 表
    let create_shops = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE shops (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            logo_url TEXT,
            website_url TEXT,
            contact_email VARCHAR(100),
            phone VARCHAR(20),
            address TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            owner_id INTEGER NOT NULL,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            webhook_url TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_shops).await {
        Ok(_) => info!("✅ shops 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ shops 表已存在");
        }
        Err(e) => {
            error!("❌ shops 表创建失败: {}", e);
            return Err(anyhow::anyhow!("Failed to create shops table: {}", e));
        }
    }

    // 创建 customers 表
    let create_customers = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            customer_id VARCHAR(255) NOT NULL,
            name VARCHAR(100),
            email VARCHAR(100),
            phone VARCHAR(20),
            avatar_url TEXT,
            metadata TEXT,
            is_online BOOLEAN NOT NULL DEFAULT 0,
            last_seen TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shop_id, customer_id),
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_customers).await {
        Ok(_) => info!("✅ customers 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ customers 表已存在");
        }
        Err(e) => {
            error!("❌ customers 表创建失败: {}", e);
        }
    }

    // 创建 sessions 表
    let create_sessions = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            session_id VARCHAR(255) UNIQUE NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            assigned_staff_id INTEGER,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            closed_at TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (assigned_staff_id) REFERENCES users(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_sessions).await {
        Ok(_) => info!("✅ sessions 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ sessions 表已存在");
        }
        Err(e) => {
            error!("❌ sessions 表创建失败: {}", e);
        }
    }

    // 创建 messages 表
    let create_messages = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            sender_type VARCHAR(20) NOT NULL,
            sender_id VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            message_type VARCHAR(20) NOT NULL DEFAULT 'text',
            metadata TEXT,
            is_read BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_messages).await {
        Ok(_) => info!("✅ messages 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ messages 表已存在");
        }
        Err(e) => {
            error!("❌ messages 表创建失败: {}", e);
        }
    }

    // 创建 shop_staffs 表
    let create_shop_staffs = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE shop_staffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shop_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'staff',
            permissions TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            invited_by INTEGER,
            invited_at TIMESTAMP,
            joined_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(shop_id, user_id),
            FOREIGN KEY (shop_id) REFERENCES shops(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (invited_by) REFERENCES users(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_shop_staffs).await {
        Ok(_) => info!("✅ shop_staffs 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ shop_staffs 表已存在");
        }
        Err(e) => {
            error!("❌ shop_staffs 表创建失败: {}", e);
        }
    }

    // 创建 unread_counts 表
    let create_unread_counts = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE unread_counts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            staff_id INTEGER NOT NULL,
            unread_count INTEGER NOT NULL DEFAULT 0,
            last_read_message_id INTEGER,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(session_id, staff_id),
            FOREIGN KEY (session_id) REFERENCES sessions(id),
            FOREIGN KEY (staff_id) REFERENCES users(id),
            FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_unread_counts).await {
        Ok(_) => info!("✅ unread_counts 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ unread_counts 表已存在");
        }
        Err(e) => {
            error!("❌ unread_counts 表创建失败: {}", e);
        }
    }

    // 创建 online_status 表
    let create_online_status = Statement::from_string(
        DbBackend::Sqlite,
        r#"
        CREATE TABLE online_status (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            user_type VARCHAR(20) NOT NULL,
            shop_id INTEGER,
            is_online BOOLEAN NOT NULL DEFAULT 0,
            last_seen TIMESTAMP,
            socket_id VARCHAR(255),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, user_type, shop_id),
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        );
        "#.to_string()
    );
    
    match db.execute(create_online_status).await {
        Ok(_) => info!("✅ online_status 表创建成功"),
        Err(e) if e.to_string().contains("already exists") => {
            info!("ℹ️ online_status 表已存在");
        }
        Err(e) => {
            error!("❌ online_status 表创建失败: {}", e);
        }
    }

    info!("✅ 所有数据库表创建完成");
    Ok(())
}

/// 检查表是否存在
async fn table_exists(db: &DatabaseConnection, table_name: &str) -> Result<bool> {
    let query = Statement::from_string(
        DbBackend::Sqlite,
        format!(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='{}';",
            table_name
        )
    );
    
    match db.query_one(query).await {
        Ok(Some(_)) => Ok(true),
        Ok(None) => Ok(false),
        Err(e) => {
            warn!("检查表存在性失败: {}", e);
            Ok(false) // 保守处理，假设表不存在
        }
    }
}

/// 验证关键表是否存在
async fn verify_tables(db: &DatabaseConnection) -> Result<()> {
    info!("🔍 验证数据库表结构...");
    
    let required_tables = vec![
        "users", "shops", "customers", "sessions", "messages", 
        "shop_staffs", "unread_counts", "online_status"
    ];
    let mut missing_tables = Vec::new();
    
    for table in &required_tables {
        if !table_exists(db, table).await? {
            missing_tables.push(*table);
        }
    }
    
    if missing_tables.is_empty() {
        info!("✅ 所有必需的表都存在");
        Ok(())
    } else {
        error!("❌ 缺少数据库表: {:?}", missing_tables);
        Err(anyhow::anyhow!("Missing required tables: {:?}", missing_tables))
    }
}

/// 回滚所有迁移（用于开发/测试）
pub async fn rollback_migrations(_db: &DatabaseConnection) -> Result<()> {
    warn!("⚠️  迁移回滚功能尚未实现");
    Ok(())
}