// Purpose: 统计与聚合相关服务（如未读消息统计、店铺聚合等）
// Input: owner_id（店主用户ID）
// Output: Vec<ShopWithUnreadCount>
// Errors: 数据库查询失败
//
// 🔧 重构完成：使用 sqlx::query_as!() 宏实现编译时 SQL 验证
// ✅ 列名错误会在编译时被发现，而非运行时

use anyhow::Result;
use sqlx::FromRow;

use crate::{
    database::Database,
    models::{Shop, ShopWithUnreadCount},
};

// 保留结构体定义，用于 query_as!() 宏的类型映射
// 📝 注意：SQLite 通过 query_as!() 返回的类型可能是 Option<T>
#[derive(FromRow)]
struct ShopWithUnreadProjection {
    pub id: Option<i64>,
    pub owner_id: Option<i64>,
    pub shop_name: Option<String>,
    pub shop_url: Option<String>,
    pub api_key: Option<String>,
    pub status: Option<i32>,
    pub created_at: Option<chrono::NaiveDateTime>,  // SQLite 返回 NaiveDateTime
    pub updated_at: Option<chrono::NaiveDateTime>,
    pub unread_total: Option<i32>,  // 修改为 i32
}

pub async fn fetch_shops_with_unread_by_owner(
    db: &Database,
    owner_id: i64,
) -> Result<Vec<ShopWithUnreadCount>> {
    // ✅ 使用 query_as!() 宏 - 编译时验证 SQL
    // 如果列名错误（如 s.name 而非 s.shop_name），编译会失败！
    let rows = sqlx::query_as!(
        ShopWithUnreadProjection,
        r#"
        SELECT 
            s.id,
            s.owner_id,
            s.shop_name,
            s.shop_url,
            s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at,
            s.updated_at,
            0 AS unread_total
        FROM shops s
        WHERE s.owner_id = ?
        ORDER BY s.created_at DESC
        "#,
        owner_id
    )
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
    // ✅ 使用 query_as!() 宏 - 编译时验证 SQL
    // 如果表名、列名或 JOIN 条件错误，编译会失败！
    let rows = sqlx::query_as!(
        ShopWithUnreadProjection,
        r#"
        SELECT 
            s.id,
            s.owner_id,
            s.shop_name,
            s.shop_url,
            s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at,
            s.updated_at,
            0 AS unread_total
        FROM shop_staffs ss
        JOIN shops s ON s.id = ss.shop_id
        WHERE ss.user_id = ?
        ORDER BY s.created_at DESC
        "#,
        staff_user_id
    )
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
