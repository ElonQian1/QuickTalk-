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
    tracing::info!("🔍 开始登录处理，用户名: {}", payload.username);
    
    // 使用 UserService 进行身份验证（已添加详细日志）
    let user = match state
        .user_service
        .authenticate(&payload.username, &payload.password)
        .await
    {
        Ok(user) => {
            tracing::info!("✅ 用户认证成功，用户ID: {}", user.id);
            user
        },
        Err(e) => {
            tracing::error!("❌ 用户认证失败: {}", e);
            match e.to_string().as_str() {
                "用户不存在" | "密码错误" | "invalid_credentials" => return Err(StatusCode::UNAUTHORIZED),
                "user_inactive" => return Err(StatusCode::FORBIDDEN),
                _ => {
                    tracing::error!("❌ 认证过程中出现意外错误: {}", e);
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
    };

    tracing::info!("🔑 开始生成 JWT token");
    
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
    let token = encode_token(&claims, &secret).map_err(|e| {
        tracing::error!("❌ JWT token 生成失败: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    tracing::info!("🔄 开始用户数据转换");
    let user_public = UserPublic::from(user);
    
    let response = AuthResponse {
        token,
        user: user_public,
    };

    tracing::info!("✅ 登录处理完成");
    Ok(Json(response))
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    println!("注册请求: {:?}", payload);
    
    // 使用 UserService 注册用户
    let user = match state
        .user_service
        .register(
            payload.username,
            payload.password,
            payload.email,
            payload.phone,
        )
        .await
    {
        Ok(user) => {
            println!("用户注册成功: {:?}", user);
            user
        },
        Err(e) => {
            println!("用户注册失败: {:?}", e);
            match e.to_string().as_str() {
                "用户名已存在" => return Err(StatusCode::CONFLICT),
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
