use axum::{extract::State, Json};

use crate::{auth::AuthUser, error::AppError, services::dashboard, AppState};

pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<dashboard::DashboardStats>, AppError> {
    // 临时错误处理：如果查询失败，返回默认值而不是报错
    match dashboard::get_dashboard_stats_orm(&state.db_connection, user_id).await {
        Ok(stats) => {
            tracing::info!("✅ 仪表盘统计查询成功");
            Ok(Json(stats))
        },
        Err(e) => {
            tracing::error!("❌ 仪表盘统计查询失败，返回默认值: {}", e);
            // 返回默认的空统计数据，避免500错误
            let default_stats = dashboard::DashboardStats {
                total_shops: 0,
                active_customers: 0,
                unread_messages: 0,
                pending_chats: 0,
                today_messages: 0,
                week_messages: 0,
                month_messages: 0,
                today_customers: 0,
            };
            Ok(Json(default_stats))
        }
    }
}
