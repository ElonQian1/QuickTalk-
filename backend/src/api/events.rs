use std::collections::HashMap;
use std::sync::Arc;
use axum::{extract::{State, Query}, response::Json};
use serde::Serialize;
use crate::bootstrap::app_state::AppState;
use crate::db::event_log_repository_sqlx::EventLogRepositorySqlx;
use crate::api::errors::{ApiError, ApiResult, success};

#[derive(Serialize)]
pub struct ReplayEventDto {
    pub event_id: String,
    pub r#type: String,
    pub emitted_at: String,
    pub envelope: serde_json::Value,
}

// GET /api/events/replay?since_event_id=<eid>&limit=100
pub async fn replay_events(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Vec<ReplayEventDto>> {
    let since = params.get("since_event_id").map(|s| s.as_str());
    let limit: i64 = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(100).min(500);
    let repo = EventLogRepositorySqlx::new(state.db.clone());
    match repo.replay_since(since, limit).await {
        Ok(list) => {
            let mut dtos = Vec::with_capacity(list.len());
            for ev in list { if let Ok(val) = serde_json::from_str::<serde_json::Value>(&ev.payload_json) {
                dtos.push(ReplayEventDto { event_id: ev.event_id, r#type: ev.event_type, emitted_at: ev.emitted_at, envelope: val });
            }}
            success(dtos, "Events replayed")
        }
        Err(e) => { tracing::error!(?e, "replay query failed"); Err(ApiError::internal("Failed to replay events")) }
    }
}
