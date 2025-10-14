//! 数据库迁移管理
//! 职责：验证数据库架构，确保与 Sea-ORM 实体一致

use anyhow::Result;
use sea_orm::{DatabaseConnection, Statement, DbBackend, ConnectionTrait};
use tracing::{info, warn};
use std::collections::{HashMap, HashSet};

/// 运行 Sea-ORM 迁移
pub async fn run_migrations(db: &DatabaseConnection) -> Result<()> {
    info!("开始运行数据库迁移...");
    
    // 手动执行 messages 表的扩展列迁移
    let alter_sqls = vec![
        "ALTER TABLE messages ADD COLUMN sender_name TEXT",
        "ALTER TABLE messages ADD COLUMN rich_content TEXT",
        "ALTER TABLE messages ADD COLUMN metadata TEXT", 
        "ALTER TABLE messages ADD COLUMN reply_to INTEGER",
        "ALTER TABLE messages ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE messages ADD COLUMN read_at TIMESTAMP",
        "ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP",
        "ALTER TABLE messages ADD COLUMN updated_at TIMESTAMP", // 移除 NOT NULL DEFAULT
    ];
    
    for sql in alter_sqls {
        if let Err(e) = db.execute(Statement::from_string(DbBackend::Sqlite, sql.to_string())).await {
            // 如果列已存在，忽略错误
            if e.to_string().contains("duplicate column name") {
                info!("列已存在，跳过: {}", sql);
                continue;
            }
            warn!("执行SQL失败: {} - 错误: {}", sql, e);
        } else {
            info!("✅ 执行成功: {}", sql);
        }
    }
    
    info!("✅ 数据库迁移执行完成");
    
    // 验证数据库架构
    let tables = get_existing_tables(db).await?;
    
    if tables.is_empty() {
        warn!("数据库中未找到任何表");
        return Ok(());
    }

    info!("找到 {} 个表", tables.len());
    for table in &tables {
        info!("  - 表: {}", table);
        let columns = get_table_columns(db, table).await?;
        info!("    列数: {}", columns.len());
        for column in &columns {
            info!("      - {}", column);
        }
    }

    check_schema_consistency(db, &tables).await?;
    info!("数据库架构验证完成");
    Ok(())
}

/// 获取现有表列表
async fn get_existing_tables(db: &DatabaseConnection) -> Result<Vec<String>> {
    let stmt = Statement::from_string(
        DbBackend::Sqlite,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            .to_string(),
    );
    
    let result = db.query_all(stmt).await?;
    let tables: Vec<String> = result
        .into_iter()
        .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
        .collect();
        
    Ok(tables)
}

/// 获取表的列信息
async fn get_table_columns(db: &DatabaseConnection, table_name: &str) -> Result<Vec<String>> {
    let stmt = Statement::from_string(
        DbBackend::Sqlite,
        format!("PRAGMA table_info({})", table_name),
    );
    
    let result = db.query_all(stmt).await?;
    let columns: Vec<String> = result
        .into_iter()
        .map(|row| row.try_get::<String>("", "name").unwrap_or_default())
        .collect();
        
    Ok(columns)
}

/// 检查架构一致性
async fn check_schema_consistency(db: &DatabaseConnection, existing_tables: &[String]) -> Result<()> {
    // 定义期望的表结构
    let expected_tables: HashMap<&str, Vec<&str>> = HashMap::from([
        ("users", vec!["id","username","password_hash","email","phone","avatar_url","status","created_at","updated_at"]),
        ("shops", vec!["id","owner_id","shop_name","shop_url","api_key","status","created_at","updated_at"]),
        ("customers", vec!["id","shop_id","customer_id","customer_name","customer_email","customer_avatar","ip_address","user_agent","first_visit_at","last_active_at","status"]),
        ("sessions", vec!["id","shop_id","customer_id","staff_id","session_status","created_at","closed_at","last_message_at"]),
        ("staff_assignments", vec!["id","session_id","staff_id","assigned_at","unassigned_at"]),
        ("messages", vec!["id","session_id","sender_type","sender_id","sender_name","message_type","content","rich_content","metadata","reply_to","is_read","read_at","is_deleted","deleted_at","created_at","updated_at"]),
        ("unread_counts", vec!["id","shop_id","customer_id","unread_count","last_read_message_id","updated_at"]),
        ("online_status", vec!["id","user_type","user_id","shop_id","websocket_id","last_ping_at","status"]),
        ("shop_staffs", vec!["id","shop_id","user_id","role","created_at"]),
    ]);

    // 检查每个期望的表
    for (table_name, expected_columns) in &expected_tables {
        if existing_tables.contains(&table_name.to_string()) {
            let actual_columns = get_table_columns(db, table_name).await?;
            compare_columns(table_name, expected_columns, &actual_columns);
        } else {
            warn!("表 '{}' 不存在", table_name);
        }
    }

    Ok(())
}

/// 比较列结构
fn compare_columns(table_name: &str, expected: &[&str], actual: &[String]) {
    let expected_set: HashSet<&str> = expected.iter().cloned().collect();
    let actual_set: HashSet<&str> = actual.iter().map(|s| s.as_str()).collect();

    let missing: Vec<&str> = expected_set.difference(&actual_set).cloned().collect();
    let extra: Vec<&str> = actual_set.difference(&expected_set).cloned().collect();

    if !missing.is_empty() {
        warn!("表 '{}' 缺少列: {:?}", table_name, missing);
    }

    if !extra.is_empty() {
        warn!("表 '{}' 额外列: {:?}", table_name, extra);
    }

    if missing.is_empty() && extra.is_empty() {
        info!("表 '{}' 架构一致", table_name);
    }
}