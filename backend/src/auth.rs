use std::env;

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts, StatusCode},
};

use crate::jwt::{decode_token, Claims, JwtError};

/// 从环境变量读取 JWT 密钥，默认回退到开发密钥
pub fn jwt_secret_from_env() -> Vec<u8> {
    env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-secret-key".to_string())
        .into_bytes()
}

pub fn verify_token(token: &str) -> Result<Claims, JwtError> {
    let secret = jwt_secret_from_env();
    decode_token(token, &secret)
}

/// 认证后的用户提取器
#[derive(Debug, Clone, Copy)]
pub struct AuthUser {
    pub user_id: i64,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = StatusCode;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        // 期望格式：Bearer <token>
        let token = auth
            .strip_prefix("Bearer ")
            .or_else(|| auth.strip_prefix("bearer "))
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let claims = verify_token(token).map_err(|_| StatusCode::UNAUTHORIZED)?;
        let user_id: i64 = claims.sub.parse().map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(AuthUser { user_id })
    }
}
