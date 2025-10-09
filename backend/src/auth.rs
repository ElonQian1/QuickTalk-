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
        tracing::debug!("🔍 AuthUser: 开始认证检查");
        
        let auth = parts
            .headers
            .get(header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok());
            
        if let Some(auth_header) = &auth {
            tracing::debug!("🔍 AuthUser: 找到Authorization头: {}...", &auth_header[..std::cmp::min(20, auth_header.len())]);
        } else {
            tracing::error!("❌ AuthUser: 未找到Authorization头");
            tracing::debug!("📋 AuthUser: 可用的请求头: {:?}", parts.headers.keys().collect::<Vec<_>>());
        }
        
        let auth = auth.ok_or_else(|| {
            tracing::error!("❌ AuthUser: Authorization头缺失");
            StatusCode::UNAUTHORIZED
        })?;

        // 期望格式：Bearer <token>
        let token = auth
            .strip_prefix("Bearer ")
            .or_else(|| auth.strip_prefix("bearer "))
            .ok_or_else(|| {
                tracing::error!("❌ AuthUser: Authorization头格式错误，期望 'Bearer <token>'，实际: {}", auth);
                StatusCode::UNAUTHORIZED
            })?;

        let claims = verify_token(token).map_err(|e| {
            tracing::error!("❌ AuthUser: token验证失败: {:?}", e);
            StatusCode::UNAUTHORIZED
        })?;
        
        let user_id: i64 = claims.sub.parse().map_err(|e| {
            tracing::error!("❌ AuthUser: user_id解析失败: {:?}", e);
            StatusCode::UNAUTHORIZED
        })?;
        
        tracing::debug!("✅ AuthUser: 认证成功，user_id: {}", user_id);
        Ok(AuthUser { user_id })
    }
}
