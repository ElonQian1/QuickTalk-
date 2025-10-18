// Purpose: 统计与聚合相关服务（如未读消息统计、店铺聚合等）
// Input: owner_id（店主用户ID）
// Output: Vec<ShopWithUnreadCount>
// Errors: 数据库查询失败

use anyhow::Result;
use sqlx::FromRow;

use crate::{
    database::Database,
    models::{Shop, ShopWithUnreadCount, ShopWithOverview, MessageSummary},
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

#[derive(FromRow)]
struct ShopOverviewProjection {
    pub id: i64,
    pub owner_id: i64,
    pub shop_name: String,
    pub shop_url: Option<String>,
    pub api_key: String,
    pub status: i32,
    // 放宽为可选，兼容历史数据中可能为 NULL 的情况
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
    pub unread_total: Option<i64>,
    pub last_activity: Option<chrono::DateTime<chrono::Utc>>,
    pub last_msg_content: Option<String>,
    pub last_msg_type: Option<String>,
    pub last_msg_sender: Option<String>,
    pub last_msg_created_at: Option<chrono::DateTime<chrono::Utc>>,
    pub customer_count: Option<i64>,
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

// 新增：返回带 last_activity 与 last_message 的店铺概览
pub async fn fetch_shops_overview_by_owner_paged(
    db: &Database,
    owner_id: i64,
    only_active: bool,
    limit: i64,
    offset: i64,
    sort: Option<&str>,
) -> Result<Vec<ShopWithOverview>> {
    let sort_key = sort.unwrap_or("unread_desc").to_ascii_lowercase();
    let (active_filter, order_tail) = match sort_key.as_str() {
        "created_at_desc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.created_at DESC"),
        "name_asc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.shop_name ASC"),
        "name_desc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.shop_name DESC"),
        _ => (if only_active { "AND s.is_active = 1" } else { "" },
              "ORDER BY unread_total DESC, COALESCE(last_msg_created_at, s.created_at) DESC"),
    };

    let sql = format!(
        r#"
        WITH per_shop_unread AS (
            SELECT uc.shop_id, COALESCE(SUM(uc.unread_count), 0) AS unread_total
            FROM unread_counts uc
            GROUP BY uc.shop_id
        ),
        per_shop_last AS (
            SELECT s.id AS shop_id,
                   MAX(COALESCE(m.created_at, sess.last_message_at, c.last_active_at)) AS last_activity,
                   MAX(m.created_at) AS last_msg_created_at
            FROM shops s
            LEFT JOIN sessions sess ON sess.shop_id = s.id
            LEFT JOIN customers c ON c.shop_id = s.id
            LEFT JOIN messages m ON m.session_id = sess.id
            GROUP BY s.id
        ),
        per_shop_last_msg AS (
            SELECT m1.session_id, m1.content AS last_msg_content, m1.message_type AS last_msg_type,
                   m1.sender_type AS last_msg_sender, m1.created_at AS last_msg_created_at
            FROM messages m1
            JOIN (
                SELECT m.session_id, MAX(m.created_at) AS max_created
                FROM messages m
                GROUP BY m.session_id
            ) mm ON mm.session_id = m1.session_id AND mm.max_created = m1.created_at
        )
        SELECT 
            s.id, s.owner_id, s.shop_name, s.shop_url, s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at, s.updated_at,
            COALESCE(u.unread_total, 0) AS unread_total,
            l.last_activity,
            lm.last_msg_content,
            lm.last_msg_type,
            lm.last_msg_sender,
            l.last_msg_created_at,
            (SELECT COUNT(*) FROM customers c WHERE c.shop_id = s.id) AS customer_count
        FROM shops s
        LEFT JOIN per_shop_unread u ON u.shop_id = s.id
        LEFT JOIN per_shop_last l ON l.shop_id = s.id
        LEFT JOIN per_shop_last_msg lm ON lm.last_msg_created_at = l.last_msg_created_at
        WHERE s.owner_id = ? {active_filter}
        {order_tail}
        LIMIT ? OFFSET ?
        "#
    );

    let rows: Vec<ShopOverviewProjection> = sqlx::query_as(&sql)
        .bind(owner_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(db.pool())
        .await?;

    let result = rows
        .into_iter()
        .map(|row| ShopWithOverview {
            shop: Shop {
                id: row.id,
                owner_id: row.owner_id,
                shop_name: row.shop_name,
                shop_url: row.shop_url,
                api_key: row.api_key,
                status: row.status,
                created_at: row.created_at.unwrap_or_else(|| chrono::Utc::now()),
                updated_at: row.updated_at.unwrap_or_else(|| chrono::Utc::now()),
            },
            unread_count: (row.unread_total.unwrap_or(0)) as i32,
            last_activity: row.last_activity,
            last_message: row.last_msg_created_at.map(|ts| MessageSummary {
                content: row.last_msg_content.unwrap_or_default(),
                message_type: row.last_msg_type.unwrap_or_else(|| "text".to_string()),
                sender_type: row.last_msg_sender.unwrap_or_else(|| "customer".to_string()),
                created_at: ts,
            }),
            customer_count: row.customer_count.unwrap_or(0),
        })
        .collect();

    Ok(result)
}

pub async fn fetch_shops_overview_by_staff_paged(
    db: &Database,
    staff_user_id: i64,
    only_active: bool,
    limit: i64,
    offset: i64,
    sort: Option<&str>,
) -> Result<Vec<ShopWithOverview>> {
    let sort_key = sort.unwrap_or("unread_desc").to_ascii_lowercase();
    let (active_filter, order_tail) = match sort_key.as_str() {
        "created_at_desc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.created_at DESC"),
        "name_asc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.shop_name ASC"),
        "name_desc" => (if only_active { "AND s.is_active = 1" } else { "" }, "ORDER BY s.shop_name DESC"),
        _ => (if only_active { "AND s.is_active = 1" } else { "" },
              "ORDER BY unread_total DESC, COALESCE(last_msg_created_at, s.created_at) DESC"),
    };

    let sql = format!(
        r#"
        WITH per_shop_unread AS (
            SELECT uc.shop_id, COALESCE(SUM(uc.unread_count), 0) AS unread_total
            FROM unread_counts uc
            GROUP BY uc.shop_id
        ),
        per_shop_last AS (
            SELECT s.id AS shop_id,
                   MAX(COALESCE(m.created_at, sess.last_message_at, c.last_active_at)) AS last_activity,
                   MAX(m.created_at) AS last_msg_created_at
            FROM shops s
            LEFT JOIN shop_staffs ss ON ss.shop_id = s.id
            LEFT JOIN sessions sess ON sess.shop_id = s.id
            LEFT JOIN customers c ON c.shop_id = s.id
            LEFT JOIN messages m ON m.session_id = sess.id
            WHERE ss.user_id = ?
            GROUP BY s.id
        ),
        per_shop_last_msg AS (
            SELECT m1.session_id, m1.content AS last_msg_content, m1.message_type AS last_msg_type,
                   m1.sender_type AS last_msg_sender, m1.created_at AS last_msg_created_at
            FROM messages m1
            JOIN (
                SELECT m.session_id, MAX(m.created_at) AS max_created
                FROM messages m
                GROUP BY m.session_id
            ) mm ON mm.session_id = m1.session_id AND mm.max_created = m1.created_at
        )
        SELECT 
            s.id, s.owner_id, s.shop_name, s.shop_url, s.api_key,
            CASE WHEN s.is_active THEN 1 ELSE 0 END AS status,
            s.created_at, s.updated_at,
            COALESCE(u.unread_total, 0) AS unread_total,
            l.last_activity,
            lm.last_msg_content,
            lm.last_msg_type,
            lm.last_msg_sender,
            l.last_msg_created_at,
            (SELECT COUNT(*) FROM customers c WHERE c.shop_id = s.id) AS customer_count
        FROM shops s
        JOIN shop_staffs ss ON ss.shop_id = s.id
        LEFT JOIN per_shop_unread u ON u.shop_id = s.id
        LEFT JOIN per_shop_last l ON l.shop_id = s.id
        LEFT JOIN per_shop_last_msg lm ON lm.last_msg_created_at = l.last_msg_created_at
        WHERE ss.user_id = ? {active_filter}
        {order_tail}
        LIMIT ? OFFSET ?
        "#
    );

    let rows: Vec<ShopOverviewProjection> = sqlx::query_as(&sql)
        .bind(staff_user_id)
        .bind(staff_user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(db.pool())
        .await?;

    let result = rows
        .into_iter()
        .map(|row| ShopWithOverview {
            shop: Shop {
                id: row.id,
                owner_id: row.owner_id,
                shop_name: row.shop_name,
                shop_url: row.shop_url,
                api_key: row.api_key,
                status: row.status,
                created_at: row.created_at.unwrap_or_else(|| chrono::Utc::now()),
                updated_at: row.updated_at.unwrap_or_else(|| chrono::Utc::now()),
            },
            unread_count: (row.unread_total.unwrap_or(0)) as i32,
            last_activity: row.last_activity,
            last_message: row.last_msg_created_at.map(|ts| MessageSummary {
                content: row.last_msg_content.unwrap_or_default(),
                message_type: row.last_msg_type.unwrap_or_else(|| "text".to_string()),
                sender_type: row.last_msg_sender.unwrap_or_else(|| "customer".to_string()),
                created_at: ts,
            }),
            customer_count: row.customer_count.unwrap_or(0),
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
