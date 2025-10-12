use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{verify, hash, DEFAULT_COST};

use crate::{auth::AuthUser, models::{UpdateProfileRequest, ChangePasswordRequest, UserPublic}, AppState};

pub async fn update_profile(
    AuthUser { user_id }: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    let user = state.db.update_user_profile(user_id, &req)
        .await
        .map_err(|e| {
            let msg = e.to_string().to_lowercase();
            if msg.contains("unique") || msg.contains("constraint") {
                StatusCode::CONFLICT
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        })?;
    Ok(Json(user.into()))
}

pub async fn change_password(
    AuthUser { user_id }: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<StatusCode, StatusCode> {
    // 读取当前用户
    let user = state.db.get_user_by_id(user_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // 校验旧密码
    let ok = verify(&req.current_password, &user.password_hash).unwrap_or(false);
    if !ok {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 更新新密码
    let new_hash = hash(&req.new_password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    state.db.change_user_password(user_id, &new_hash)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
