use axum::{extract::{Path, State}, Json};

use crate::{auth::AuthUser, error::AppError, services, AppState};
use crate::services::permissions as perms;
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
    // SQLx 权限校验（店主或成员）
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, shop_id).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
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
    // 仅店主可操作
    let is_owner = perms::is_shop_owner_sqlx(&state.db, shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".into()))?;
    if !is_owner { return Err(AppError::Forbidden); }
    services::staff::add_staff(&state.db_connection, user_id, shop_id, &payload.username).await?;
    Ok(Json(serde_json::json!({"ok": true})))
}

pub async fn remove_staff(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path((shop_id, target_user_id)): Path<(i64, i64)>,
) -> Result<StatusCode, AppError> {
    // 仅店主可操作
    let is_owner = perms::is_shop_owner_sqlx(&state.db, shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".into()))?;
    if !is_owner { return Err(AppError::Forbidden); }
    services::staff::remove_staff(&state.db_connection, user_id, shop_id, target_user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}
