use axum::{extract::Query, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;

use crate::bootstrap::app_state::AppState;
use crate::db::workbench_read_model_sqlx::WorkbenchReadModelSqlx;

#[derive(Debug, Deserialize)]
pub struct SummaryParams {
    pub shop_id: Option<String>,
    pub days: Option<i64>,
}

pub async fn get_workbench_summary(
    state: axum::extract::State<std::sync::Arc<AppState>>,
    Query(params): Query<SummaryParams>,
) -> impl IntoResponse {
    let reader = WorkbenchReadModelSqlx { pool: state.db.clone() };
    let days = params.days.unwrap_or(7);
    match reader.summary(params.shop_id.as_deref(), days).await {
        Ok(summary) => (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "data": summary
        }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "success": false,
            "error": format!("failed to load summary: {}", e)
        }))).into_response(),
    }
}
