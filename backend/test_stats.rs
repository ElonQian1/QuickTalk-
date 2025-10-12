// 临时测试统计功能的简单脚本
use customer_service_backend::database::Database;
use customer_service_backend::services::dashboard;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 连接数据库
    let db = Database::new("customer_service.db").await?;
    
    // 假设用户ID为1（admin用户）
    let user_id = 1i64;
    
    // 调用统计函数
    match dashboard::get_dashboard_stats(&db, user_id).await {
        Ok(stats) => {
            println!("✅ 统计数据获取成功:");
            println!("  📊 店铺总数: {}", stats.total_shops);
            println!("  👥 活跃客户: {}", stats.active_customers);
            println!("  💬 未读消息: {}", stats.unread_messages);
            println!("  ⏳ 待处理: {}", stats.pending_chats);
            println!("  📅 今日消息: {}", stats.today_messages);
            println!("  📊 本周消息: {}", stats.week_messages);
            println!("  📈 本月消息: {}", stats.month_messages);
            println!("  🆕 今日客户: {}", stats.today_customers);
        }
        Err(e) => {
            println!("❌ 统计数据获取失败: {:?}", e);
        }
    }
    
    Ok(())
}