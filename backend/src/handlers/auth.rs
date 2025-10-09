use axum::{extract::State, http::StatusCode, Json};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};

use crate::{
    jwt::{encode_token, Claims},
    models::*,
    AppState,
};

const JWT_SECRET: &[u8] = b"your-secret-key"; // 在生产环境中应该从环境变量读取

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    // 查找用户
    let user = match state.db.get_user_by_username(&payload.username).await {
        Ok(Some(user)) => user,
        Ok(None) => return Err(StatusCode::UNAUTHORIZED),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // 验证密码
    if !verify(&payload.password, &user.password_hash).unwrap_or(false) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    // 生成 JWT
    let exp = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user.id.to_string(),
        exp,
    };

    let token = encode_token(&claims, JWT_SECRET).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

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
    // 检查用户名是否已存在
    match state.db.get_user_by_username(&payload.username).await {
        Ok(Some(_)) => return Err(StatusCode::CONFLICT),
        Ok(None) => {}
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    }

    // 哈希密码
    let password_hash =
        hash(&payload.password, DEFAULT_COST).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 创建用户
    let user = match state
        .db
        .create_user(
            &payload.username,
            &password_hash,
            payload.email.as_deref(),
            payload.phone.as_deref(),
        )
        .await
    {
        Ok(user) => user,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
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

    let token = encode_token(&claims, JWT_SECRET).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = AuthResponse {
        token,
        user: user.into(),
    };

    Ok(Json(response))
}
