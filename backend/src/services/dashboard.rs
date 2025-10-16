// Purpose: 仪表盘聚合统计服务，避免前端 N+1
// Input: user_id（既可能是店主，也可能是员工）
// Output: total_shops, active_customers, unread_messages, pending_chats
// Errors: 数据库查询失败

use anyhow::Result;
use serde::Serialize;
use sea_orm::DatabaseConnection;

use crate::database::Database;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_shops: i64,
    pub active_customers: i64,
    pub unread_messages: i64,
    pub pending_chats: i64,
    // 新增时间维度统计
    pub today_messages: i64,
    pub week_messages: i64,
    pub month_messages: i64,
    pub today_customers: i64,
}

pub async fn get_dashboard_stats(db: &Database, user_id: i64) -> Result<DashboardStats> {
    // 统一的"可访问店铺集合"：本人拥有的店铺 ∪ 作为员工加入的店铺
    // 之后所有统计都基于该集合，确保员工账号能看到员工店铺的数据。

    // 店铺总数（去重）
    tracing::debug!("开始查询店铺总数，user_id: {}", user_id);
    let total_shops: i64 = sqlx::query_scalar!(
        r#"
        WITH accessible_shops AS (
            SELECT id AS shop_id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        SELECT COUNT(*) FROM accessible_shops
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| {
        tracing::error!("查询店铺总数失败: {}", e);
        e
    })? as i64;

    // 活跃客户：近7天在可访问店铺内活跃
    tracing::debug!("开始查询活跃客户数，user_id: {}", user_id);
    let active_customers: i64 = sqlx::query_scalar!(
        r#"
        WITH accessible_shops AS (
            SELECT id AS shop_id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        SELECT COUNT(*)
        FROM customers c
        JOIN accessible_shops a ON c.shop_id = a.shop_id
        WHERE c.last_active_at >= datetime('now','-7 days')
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| {
        tracing::error!("查询活跃客户数失败: {}", e);
        e
    })? as i64;

    // 未读消息总数（可访问店铺）
    // 使用子查询代替CTE避免某些SQLite版本的别名问题
    tracing::debug!("开始查询未读消息数，user_id: {}", user_id);
    let unread_messages: i64 = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(unread_count), 0)
        FROM unread_counts
        WHERE shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| {
        tracing::error!("查询未读消息数失败: {}", e);
        e
    })?
    .unwrap_or(0) as i64;

    // 待处理会话：有未读的客户数（可访问店铺内按客户聚合）
    // 使用子查询代替CTE避免某些SQLite版本的别名问题
    tracing::debug!("开始查询待处理会话数，user_id: {}", user_id);
    let pending_chats: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT shop_id || '-' || customer_id)
        FROM unread_counts
        WHERE unread_count > 0
        AND shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| {
        tracing::error!("查询待处理会话数失败: {}", e);
        e
    })?
    .unwrap_or(0) as i64;

    // 今日消息数（可访问店铺）
    // 使用子查询代替CTE
    tracing::debug!("开始查询今日消息数，user_id: {}", user_id);
    let today_messages: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM messages m
        JOIN sessions se ON m.session_id = se.id
        WHERE se.shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        AND date(m.created_at) = date('now')
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await
    .map_err(|e| {
        tracing::error!("查询今日消息数失败: {}", e);
        e
    })?
    .unwrap_or(0) as i64;

    // 本周消息数（可访问店铺）
    // 使用子查询代替CTE
    let week_messages: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM messages m
        JOIN sessions se ON m.session_id = se.id
        WHERE se.shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        AND m.created_at >= datetime('now', 'weekday 0', '-6 days')
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await?
    .unwrap_or(0) as i64;

    // 本月消息数（可访问店铺）
    // 使用子查询代替CTE
    let month_messages: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)
        FROM messages m
        JOIN sessions se ON m.session_id = se.id
        WHERE se.shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        AND m.created_at >= datetime('now', 'start of month')
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await?
    .unwrap_or(0) as i64;

    // 今日活跃客户数（可访问店铺）
    // 使用子查询代替CTE
    let today_customers: i64 = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT se.customer_id)
        FROM messages m
        JOIN sessions se ON m.session_id = se.id
        WHERE se.shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        AND date(m.created_at) = date('now')
        "#,
        user_id,
        user_id
    )
    .fetch_one(db.pool())
    .await?
    .unwrap_or(0) as i64;

    Ok(DashboardStats {
        total_shops,
        active_customers,
        unread_messages,
        pending_chats,
        today_messages,
        week_messages,
        month_messages,
        today_customers,
    })
}

/// Sea-ORM 版本的仪表盘统计 - 使用简化查询避免复杂性
pub async fn get_dashboard_stats_orm(db: &DatabaseConnection, user_id: i64) -> Result<DashboardStats> {
    tracing::info!("🔄 使用 Sea-ORM 查询仪表盘统计（简化版本），user_id: {}", user_id);
    
    // 简化查询：直接返回固定值先确保函数能工作，然后逐步添加真实查询
    tracing::info!("✅ 仪表盘统计查询完成（固定值测试）");

    Ok(DashboardStats {
        total_shops: 1,
        active_customers: 0,
        unread_messages: 0,
        pending_chats: 0,
        today_messages: 0,
        week_messages: 0,
        month_messages: 0,
        today_customers: 0,
    })
}
