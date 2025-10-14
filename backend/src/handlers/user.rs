use axum::{extract::State, http::StatusCode, Json};

use crate::{auth::AuthUser, models::{UpdateProfileRequest, ChangePasswordRequest, UserPublic}, AppState};

pub async fn update_profile(
    AuthUser { user_id }: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserPublic>, StatusCode> {
    match state.user_service.update_profile(
        user_id.try_into().unwrap(), 
        req.email.clone(),
        req.phone.clone(), 
        req.avatar_url.clone()
    ).await {
        Ok(user_model) => {
            // 转换为UserPublic
            let user_public = UserPublic {
                id: user_model.id as i64,
                username: user_model.username,
                email: user_model.email,
                phone: user_model.phone,
                avatar_url: user_model.avatar_url,
            };
            Ok(Json(user_public))
        },
        Err(e) => {
            let msg = e.to_string().to_lowercase();
            if msg.contains("unique") || msg.contains("constraint") {
                Err(StatusCode::CONFLICT)
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}

pub async fn change_password(
    AuthUser { user_id }: AuthUser,
    State(state): State<AppState>,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<StatusCode, StatusCode> {
    match state.user_service.change_password(user_id.try_into().unwrap(), &req.current_password, &req.new_password).await {
        Ok(()) => Ok(StatusCode::NO_CONTENT),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("密码错误") || msg.contains("用户不存在") {
                Err(StatusCode::UNAUTHORIZED)
            } else {
                Err(StatusCode::INTERNAL_SERVER_ERROR)
            }
        }
    }
}
