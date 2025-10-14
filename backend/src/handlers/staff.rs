use axum::{extract::{Path, State}, Json};

use crate::{auth::AuthUser, error::AppError, services, AppState};
use axum::http::StatusCode;


#[derive(serde::Deserialize)]
pub struct AddStaffPayload {
    pub username: String,
}

pub async fn list_staff(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<Vec<services::staff::StaffItem>>, AppError> {
    // 暂时保持兼容性，直到完全迁移
    let items = services::staff::list_staff(&state.db_connection, user_id, shop_id).await?;
    Ok(Json(items))
}

pub async fn add_staff(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
    Json(payload): Json<AddStaffPayload>,
) -> Result<Json<serde_json::Value>, AppError> {
    services::staff::add_staff(&state.db_connection, user_id, shop_id, &payload.username).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

pub async fn remove_staff(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path((shop_id, target_user_id)): Path<(i64, i64)>,
) -> Result<StatusCode, AppError> {
    services::staff::remove_staff(&state.db_connection, user_id, shop_id, target_user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
