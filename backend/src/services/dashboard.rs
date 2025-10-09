// Purpose: 仪表盘聚合统计服务，避免前端 N+1
// Input: owner_id
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
}

pub async fn get_dashboard_stats(db: &Database, owner_id: i64) -> Result<DashboardStats> {
    // 店铺总数
    let total_shops: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM shops WHERE owner_id = ?")
        .bind(owner_id)
        .fetch_one(db.pool())
        .await?;

    // 活跃客户：近7天活跃
    let active_customers: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM customers c JOIN shops s ON c.shop_id = s.id \
         WHERE s.owner_id = ? AND c.last_active_at >= datetime('now','-7 days')",
    )
    .bind(owner_id)
    .fetch_one(db.pool())
    .await?;

    // 未读消息总数
    let unread_messages: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(uc.unread_count),0) FROM unread_counts uc \
         JOIN shops s ON uc.shop_id = s.id WHERE s.owner_id = ?",
    )
    .bind(owner_id)
    .fetch_one(db.pool())
    .await?;

    // 待处理会话：有未读的客户数
    let pending_chats: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM (
            SELECT uc.customer_id FROM unread_counts uc 
            JOIN shops s ON uc.shop_id = s.id 
            WHERE s.owner_id = ? AND uc.unread_count > 0
            GROUP BY uc.customer_id
        ) t",
    )
    .bind(owner_id)
    .fetch_one(db.pool())
    .await?;

    Ok(DashboardStats {
        total_shops,
        active_customers,
        unread_messages,
        pending_chats,
    })
}
