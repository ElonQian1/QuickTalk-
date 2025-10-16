/// SQLx 编译时检查测试
/// 这个文件演示了如何使用 query!() 宏进行编译时 SQL 验证
use sqlx::SqlitePool;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 从环境变量读取数据库 URL
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    
    println!("📊 连接数据库: {}", database_url);
    let pool = SqlitePool::connect(&database_url).await?;
    
    // ✅ 使用 query!() 宏 - 这会在编译时验证 SQL
    // 如果列名错误（比如使用 name 而不是 shop_name），编译会失败！
    let shops = sqlx::query!(
        r#"
        SELECT 
            id,
            owner_id,
            shop_name,
            shop_url,
            api_key,
            is_active,
            created_at
        FROM shops
        WHERE owner_id = ?
        LIMIT 5
        "#,
        1 // 测试用的 owner_id
    )
    .fetch_all(&pool)
    .await?;
    
    println!("\n✅ 编译时检查通过！查询到 {} 个店铺", shops.len());
    
    for shop in shops {
        let url = shop.shop_url.as_deref().unwrap_or("无");
        println!("  - 店铺: {} (ID: {:?}, URL: {})", shop.shop_name, shop.id, url);
    }
    
    // 🔴 如果你把上面的 shop_name 改成 name，编译会失败并报错：
    // error: no such column: name
    
    pool.close().await;
    Ok(())
}
