// Purpose: 仪表盘聚合统计服务，避免前端 N+1
// Input: user_id（既可能是店主，也可能是员工）
// Output: total_shops, active_customers, unread_messages, pending_chats
// Errors: 数据库查询失败

use anyhow::Result;
use serde::Serialize;

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
    // 统一的“可访问店铺集合”：本人拥有的店铺 ∪ 作为员工加入的店铺
    // 之后所有统计都基于该集合，确保员工账号能看到员工店铺的数据。

    // 店铺总数（去重）
    let total_shops: i64 = sqlx::query_scalar(
        r#"
        WITH accessible_shops AS (
            SELECT id AS shop_id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        SELECT COUNT(*) FROM accessible_shops
        "#,
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 活跃客户：近7天在可访问店铺内活跃
    let active_customers: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 未读消息总数（可访问店铺）
    // 使用子查询代替CTE避免某些SQLite版本的别名问题
    let unread_messages: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(unread_count), 0)
        FROM unread_counts
        WHERE shop_id IN (
            SELECT id FROM shops WHERE owner_id = ?
            UNION
            SELECT shop_id FROM shop_staffs WHERE user_id = ?
        )
        "#,
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 待处理会话：有未读的客户数（可访问店铺内按客户聚合）
    // 使用子查询代替CTE避免某些SQLite版本的别名问题
    let pending_chats: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 今日消息数（可访问店铺）
    // 使用子查询代替CTE
    let today_messages: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 本周消息数（可访问店铺）
    // 使用子查询代替CTE
    let week_messages: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 本月消息数（可访问店铺）
    // 使用子查询代替CTE
    let month_messages: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

    // 今日活跃客户数（可访问店铺）
    // 使用子查询代替CTE
    let today_customers: i64 = sqlx::query_scalar(
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
    )
    .bind(user_id)
    .bind(user_id)
    .fetch_one(db.pool())
    .await?;

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
