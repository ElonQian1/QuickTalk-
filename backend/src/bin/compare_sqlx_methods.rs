/// SQLx 编译时检查 vs 运行时检查对比示例
/// 
/// 这个文件展示了为什么你的代码没有在编译时检查出 `s.name` 错误

use sqlx::{SqlitePool, FromRow};
use serde::{Deserialize, Serialize};

// 手动定义的结构体（用于 query_as）
#[derive(Debug, FromRow, Serialize, Deserialize)]
struct ShopManual {
    pub id: i64,
    pub shop_name: String,
    pub shop_url: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../服务器数据库/customer_service.db".to_string());
    
    println!("📊 连接数据库: {}\n", database_url);
    let pool = SqlitePool::connect(&database_url).await?;
    
    println!("=== 方式 1: query_as() - 运行时检查 ===\n");
    
    // ❌ 这是你当前的代码方式
    // 如果 SQL 有错误，只会在运行时报错
    let result_manual = sqlx::query_as::<_, ShopManual>(
        r#"
        SELECT 
            id,
            shop_name,
            shop_url
        FROM shops
        LIMIT 3
        "#
    )
    .fetch_all(&pool)
    .await;
    
    match result_manual {
        Ok(shops) => {
            println!("✅ query_as() 查询成功，获取到 {} 个店铺", shops.len());
            for shop in shops {
                println!("  - {}: {}", shop.id, shop.shop_name);
            }
        }
        Err(e) => {
            println!("❌ query_as() 运行时错误: {}", e);
            println!("   这个错误只有在运行时才能发现！");
        }
    }
    
    println!("\n=== 方式 2: query!() - 编译时检查 ===\n");
    
    // ✅ 推荐的方式：使用 query!() 宏
    // 如果 SQL 有错误，编译时就会报错
    let shops_safe = sqlx::query!(
        r#"
        SELECT 
            id,
            shop_name,
            shop_url
        FROM shops
        LIMIT 3
        "#
    )
    .fetch_all(&pool)
    .await?;
    
    println!("✅ query!() 编译时已验证，获取到 {} 个店铺", shops_safe.len());
    for shop in &shops_safe {
        let url = shop.shop_url.as_deref().unwrap_or("无");
        println!("  - {:?}: {} ({})", shop.id, shop.shop_name, url);
    }
    
    println!("\n=== 对比说明 ===\n");
    println!("query_as():");
    println!("  ✅ 灵活，可以动态拼接 SQL");
    println!("  ✅ 不需要数据库连接就能编译");
    println!("  ❌ 列名错误只在运行时发现");
    println!("  ❌ 需要手动定义结构体");
    
    println!("\nquery!():");
    println!("  ✅ 编译时就检查 SQL 正确性");
    println!("  ✅ 自动生成类型安全的结构体");
    println!("  ✅ IDE 有完整的类型提示");
    println!("  ⚠️  需要设置 DATABASE_URL");
    println!("  ⚠️  SQL 必须是静态字符串");
    
    println!("\n💡 建议：");
    println!("  - 关键查询（认证、支付、权限）使用 query!()");
    println!("  - 统计、日志等非关键查询可以继续用 query_as()");
    println!("  - 逐步迁移，不需要一次性全部改完");
    
    pool.close().await;
    Ok(())
}

/*
🧪 测试步骤：

1. 正常编译和运行：
   $env:DATABASE_URL="sqlite:../服务器数据库/customer_service.db"
   $env:SQLX_OFFLINE="false"
   cargo run --bin compare_sqlx_methods

2. 故意制造错误来测试 query!() 的编译时检查：
   - 把上面的 shop_name 改成 name
   - 运行 cargo build --bin compare_sqlx_methods
   - 会看到编译时错误：error: no such column: name
   
3. 故意制造错误来测试 query_as() 的运行时检查：
   - 把 query_as 的 SQL 中 shop_name 改成 name
   - 编译会成功！❌
   - 但运行时会报错：no such column: name ⚠️

结论：这就是为什么你的 s.name 错误没有在编译时被发现！
*/
