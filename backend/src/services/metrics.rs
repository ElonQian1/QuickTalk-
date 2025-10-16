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
    // 兼容旧签名：默认仅活跃店铺 + 前50条
    fetch_shops_with_unread_by_owner_paged(db, owner_id, true, 50, 0, None).await
}

pub async fn fetch_shops_with_unread_by_owner_paged(
    db: &Database,
    owner_id: i64,
    only_active: bool,
    limit: i64,
    offset: i64,
    sort: Option<&str>,
) -> Result<Vec<ShopWithUnreadCount>> {
    let sort_key = sort.unwrap_or("unread_desc").to_ascii_lowercase();
    let rows = match (only_active, sort_key.as_str()) {
        // created_at_desc
        (true, "created_at_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ? AND s.is_active = 1
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "created_at_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // name_asc
        (true, "name_asc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ? AND s.is_active = 1
            ORDER BY s.shop_name ASC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "name_asc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ?
            ORDER BY s.shop_name ASC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // name_desc
        (true, "name_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ? AND s.is_active = 1
            ORDER BY s.shop_name DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "name_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ?
            ORDER BY s.shop_name DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // default: unread_desc
        (true, _) => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ? AND s.is_active = 1
            ORDER BY (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
            ) DESC, s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, _) => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shops s
            WHERE s.owner_id = ?
            ORDER BY (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
            ) DESC, s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                owner_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
    };

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
    // 兼容旧签名：默认仅活跃店铺 + 前50条
    fetch_shops_with_unread_by_staff_paged(db, staff_user_id, true, 50, 0, None).await
}

pub async fn fetch_shops_with_unread_by_staff_paged(
    db: &Database,
    staff_user_id: i64,
    only_active: bool,
    limit: i64,
    offset: i64,
    sort: Option<&str>,
) -> Result<Vec<ShopWithUnreadCount>> {
    let sort_key = sort.unwrap_or("unread_desc").to_ascii_lowercase();
    let rows = match (only_active, sort_key.as_str()) {
        // created_at_desc
        (true, "created_at_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ? AND s.is_active = 1
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "created_at_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // name_asc
        (true, "name_asc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ? AND s.is_active = 1
            ORDER BY s.shop_name ASC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "name_asc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ?
            ORDER BY s.shop_name ASC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // name_desc
        (true, "name_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ? AND s.is_active = 1
            ORDER BY s.shop_name DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, "name_desc") => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ?
            ORDER BY s.shop_name DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        // default: unread_desc
        (true, _) => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ? AND s.is_active = 1
            ORDER BY (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
            ) DESC, s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
        (false, _) => {
            sqlx::query_as!(
                ShopWithUnreadProjection,
                r#"
            SELECT 
                s.id                       AS "id!: i64",
                s.owner_id                 AS "owner_id!: i64",
                s.shop_name                AS "shop_name!: String",
                s.shop_url                 AS "shop_url?: String",
                s.api_key                  AS "api_key!: String",
                CASE WHEN s.is_active THEN 1 ELSE 0 END AS "status!: i32",
                s.created_at               AS "created_at!: chrono::DateTime<chrono::Utc>",
                s.updated_at               AS "updated_at!: chrono::DateTime<chrono::Utc>",
                (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
                )                          AS "unread_total!: i64"
            FROM shop_staffs ss
            JOIN shops s ON s.id = ss.shop_id
            WHERE ss.user_id = ?
            ORDER BY (
                  SELECT COALESCE(SUM(uc.unread_count), 0)
                  FROM unread_counts uc
                  WHERE uc.shop_id = s.id
            ) DESC, s.created_at DESC
            LIMIT ? OFFSET ?
            "#,
                staff_user_id,
                limit,
                offset
            )
            .fetch_all(db.pool())
            .await?
        }
    };

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

// Purpose: 获取店主店铺总数（可选仅活跃）
pub async fn count_shops_by_owner(
    db: &Database,
    owner_id: i64,
    only_active: bool,
) -> Result<i64> {
    let total = if only_active {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.owner_id = ? AND s.is_active = 1"#,
            owner_id
        )
        .fetch_one(db.pool())
        .await?
    } else {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.owner_id = ?"#,
            owner_id
        )
        .fetch_one(db.pool())
        .await?
    };
    Ok(total)
}

// Purpose: 获取员工加入的店铺总数（可选仅活跃）
pub async fn count_shops_by_staff(
    db: &Database,
    staff_user_id: i64,
    only_active: bool,
) -> Result<i64> {
    let total = if only_active {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) as "count!: i64" FROM shop_staffs ss JOIN shops s ON s.id = ss.shop_id WHERE ss.user_id = ? AND s.is_active = 1"#,
            staff_user_id
        )
        .fetch_one(db.pool())
        .await?
    } else {
        sqlx::query_scalar!(
            r#"SELECT COUNT(*) as "count!: i64" FROM shop_staffs ss JOIN shops s ON s.id = ss.shop_id WHERE ss.user_id = ?"#,
            staff_user_id
        )
        .fetch_one(db.pool())
        .await?
    };
    Ok(total)
}
