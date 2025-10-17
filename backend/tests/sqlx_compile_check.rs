//! SQLx 编译时检查测试
//! 
//! 这个测试套件验证关键 SQL 查询的正确性
//! 运行方式：
//! ```bash
//! $env:DATABASE_URL="sqlite:../服务器数据库/customer_service.db"
//! cargo test --test sqlx_compile_check
//! ```

use sqlx::SqlitePool;

#[tokio::test]
async fn test_shops_query_columns() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");
    
    // ✅ 测试 fetch_shops_with_unread_by_owner 的 SQL
    let result = sqlx::query!(
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
        1
    )
    .fetch_all(&pool)
    .await;
    
    assert!(result.is_ok(), "Shop query should execute without errors");
    
    pool.close().await;
}

#[tokio::test]
async fn test_staff_shops_query_columns() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");
    
    // ✅ 测试 fetch_shops_with_unread_by_staff 的 SQL
    let result = sqlx::query!(
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
        1
    )
    .fetch_all(&pool)
    .await;
    
    assert!(result.is_ok(), "Staff shops query should execute without errors");
    
    pool.close().await;
}

#[tokio::test]
async fn test_count_shops_by_owner_queries() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");

    // only_active = 1
    let _: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.owner_id = ? AND s.is_active = 1"#,
        1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("owner count active query failed");

    // only_active = 0
    let _: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.owner_id = ?"#,
        1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("owner count all query failed");

    pool.close().await;
}

#[tokio::test]
async fn test_count_shops_by_staff_queries() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");

    // only_active = 1
    let _: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shop_staffs ss JOIN shops s ON s.id = ss.shop_id WHERE ss.user_id = ? AND s.is_active = 1"#,
        1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("staff count active query failed");

    // only_active = 0
    let _: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shop_staffs ss JOIN shops s ON s.id = ss.shop_id WHERE ss.user_id = ?"#,
        1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("staff count all query failed");

    pool.close().await;
}

#[tokio::test]
async fn test_wrong_column_name_should_fail() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");
    
    // ❌ 这个测试故意使用错误的列名，应该在编译时失败
    // 如果你取消下面的注释，编译会报错：error: no such column: name
    /*
    let result = sqlx::query!(
        r#"
        SELECT 
            s.id,
            s.name  -- ❌ 错误！应该是 shop_name
        FROM shops s
        LIMIT 1
        "#
    )
    .fetch_all(&pool)
    .await;
    */
    
    pool.close().await;
}

#[tokio::test]
async fn test_shops_sort_created_at_desc_query() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");

    // 模拟 metrics.rs 中 created_at_desc 排序（店主视角 + 仅活跃）
        let _rows = sqlx::query!(
        r#"
        SELECT 
            s.id,
            (
              SELECT COALESCE(SUM(uc.unread_count), 0)
              FROM unread_counts uc
              WHERE uc.shop_id = s.id
                        ) AS "unread_total: i64"
        FROM shops s
        WHERE s.owner_id = ? AND s.is_active = 1
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
        "#,
        1_i64,
        10_i64,
        0_i64,
    )
    .fetch_all(&pool)
    .await
    .expect("created_at_desc query should compile and run");

    pool.close().await;
}

#[tokio::test]
async fn test_shops_sort_name_asc_query() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");

    // 模拟 metrics.rs 中 name_asc 排序（员工视角 + 全部）
        let _rows = sqlx::query!(
        r#"
        SELECT 
            s.id,
            (
              SELECT COALESCE(SUM(uc.unread_count), 0)
              FROM unread_counts uc
              WHERE uc.shop_id = s.id
                        ) AS "unread_total: i64"
        FROM shop_staffs ss
        JOIN shops s ON s.id = ss.shop_id
        WHERE ss.user_id = ?
        ORDER BY s.shop_name ASC
        LIMIT ? OFFSET ?
        "#,
        1_i64,
        10_i64,
        0_i64,
    )
    .fetch_all(&pool)
    .await
    .expect("name_asc query should compile and run");

    pool.close().await;
}

#[tokio::test]
async fn test_permissions_queries_compile() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    let pool = SqlitePool::connect(&database_url).await.expect("Failed to connect to database");

    // is_shop_owner_sqlx 对应的 COUNT 查询
    let _owner_count: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.id = ? AND s.owner_id = ?"#,
        1_i64,
        1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("owner count query should work");

    // is_shop_member_sqlx 对应的组合 COUNT 查询（不依赖 ss.is_active 列）
    let _member_total: i64 = sqlx::query_scalar!(
        r#"
        SELECT (
            (SELECT COUNT(*) FROM shops s WHERE s.id = ? AND s.owner_id = ?) +
            (SELECT COUNT(*) FROM shop_staffs ss WHERE ss.shop_id = ? AND ss.user_id = ?)
        ) as "count!: i64"
        "#,
        1_i64, 1_i64, 1_i64, 1_i64
    )
    .fetch_one(&pool)
    .await
    .expect("member combined count query should work");

    pool.close().await;
}
