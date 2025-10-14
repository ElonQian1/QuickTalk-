use axum::{extract::State, http::StatusCode, Json};
use chrono::{Duration, Utc};

use crate::{
    auth::jwt_secret_from_env,
    jwt::{encode_token, Claims},
    models::*,
    error::AppError,
    AppState,
};

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    // 使用 UserService 进行身份验证
    let user = match state
        .user_service
        .authenticate(&payload.username, &payload.password)
        .await
    {
        Ok(user) => user,
        Err(e) => {
            match e.to_string().as_str() {
                "用户不存在" | "密码错误" => return Err(StatusCode::UNAUTHORIZED),
                _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
    };

    // 生成 JWT
    let exp = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        exp,
    };

    let secret = jwt_secret_from_env();
    let token = encode_token(&claims, &secret).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = AuthResponse {
        token,
        user: user.into(),
    };

    Ok(Json(response))
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    // 使用 UserService 注册用户
    let user = match state
        .user_service
        .register(payload.username, payload.password, payload.email, payload.phone) // 传递 phone 参数
        .await
    {
        Ok(user) => user,
        Err(e) => {
            let error_msg = e.to_string();
            tracing::error!("注册失败: {}", error_msg);
            match error_msg.as_str() {
                "username_already_exists" => return Err(StatusCode::CONFLICT),
                "email_already_exists" => return Err(StatusCode::CONFLICT),
                _ => {
                    tracing::error!("未知注册错误: {}", error_msg);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
    };

    // 生成 JWT
    let exp = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        exp,
    };

    let secret = jwt_secret_from_env();
    let token = encode_token(&claims, &secret).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = AuthResponse {
        token,
        user: user.into(),
    };

    Ok(Json(response))
}
