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
