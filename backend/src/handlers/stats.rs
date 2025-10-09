use axum::{extract::State, Json};

use crate::{auth::AuthUser, error::AppError, services::dashboard, AppState};

pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<dashboard::DashboardStats>, AppError> {
    match dashboard::get_dashboard_stats(&state.db, user_id).await {
        Ok(stats) => Ok(Json(stats)),
        Err(_) => Err(AppError::Internal("获取仪表盘统计失败")),
    }
}
