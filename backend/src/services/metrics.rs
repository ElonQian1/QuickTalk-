// Purpose: 统计与聚合相关服务（如未读消息统计、店铺聚合等）
// Input: owner_id（店主用户ID）
// Output: Vec<ShopWithUnreadCount>
// Errors: 数据库查询失败

use anyhow::Result;
use sqlx::FromRow;

use crate::{
    database::Database,
    models::{Shop, ShopWithUnreadCount},
};

#[derive(FromRow)]
struct ShopWithUnreadProjection {
    pub id: i64,
    pub owner_id: i64,
    pub shop_name: String,
    pub shop_url: Option<String>,
    pub api_key: String,
    pub status: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub unread_total: Option<i64>,
}

pub async fn fetch_shops_with_unread_by_owner(
    db: &Database,
    owner_id: i64,
) -> Result<Vec<ShopWithUnreadCount>> {
    let sql = r#"
        SELECT 
            s.id,
            s.owner_id,
            s.shop_name AS shop_name,
            s.shop_url AS shop_url,
            s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at,
            s.updated_at,
            0 AS unread_total
        FROM shops s
        WHERE s.owner_id = ?
        ORDER BY s.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, ShopWithUnreadProjection>(sql)
        .bind(owner_id)
        .fetch_all(db.pool())
        .await?;

    let result = rows
        .into_iter()
        .map(|row| ShopWithUnreadCount {
            shop: Shop {
                id: row.id,
                owner_id: row.owner_id,
                shop_name: row.shop_name,
                shop_url: row.shop_url,
                api_key: row.api_key,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            unread_count: (row.unread_total.unwrap_or(0)) as i32,
        })
        .collect();

    Ok(result)
}

// Purpose: 获取“作为员工加入的店铺”列表（含未读汇总）
// Input: staff_user_id
// Output: Vec<ShopWithUnreadCount>
// Errors: 数据库查询失败
pub async fn fetch_shops_with_unread_by_staff(
    db: &Database,
    staff_user_id: i64,
) -> Result<Vec<ShopWithUnreadCount>> {
    let sql = r#"
        SELECT 
            s.id,
            s.owner_id,
            s.shop_name AS shop_name,
            s.shop_url AS shop_url,
            s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at,
            s.updated_at,
            0 AS unread_total
        FROM shop_staffs ss
        JOIN shops s ON s.id = ss.shop_id
        WHERE ss.user_id = ?
        ORDER BY s.created_at DESC
    "#;

    let rows = sqlx::query_as::<_, ShopWithUnreadProjection>(sql)
        .bind(staff_user_id)
        .fetch_all(db.pool())
        .await?;

    let result = rows
        .into_iter()
        .map(|row| ShopWithUnreadCount {
            shop: Shop {
                id: row.id,
                owner_id: row.owner_id,
                shop_name: row.shop_name,
                shop_url: row.shop_url,
                api_key: row.api_key,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            unread_count: (row.unread_total.unwrap_or(0)) as i32,
        })
        .collect();

    Ok(result)
}
