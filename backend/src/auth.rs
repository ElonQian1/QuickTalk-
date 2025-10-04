use axum::{http::request::Parts, async_trait, extract::FromRequestParts};
use crate::types::ApiResponse;
use crate::bootstrap::app_state::AppState;
use serde::Serialize;
use tracing::error;
use sqlx::Row;
use axum::{extract::State, Json};
use std::sync::Arc;
use crate::api::errors::ApiError;
use crate::bootstrap::app_state::AppState as AppShared;

#[derive(Clone, Debug, Serialize)]
#[allow(dead_code)]
pub struct Session {
    pub admin_id: String,
    pub session_id: String,
}

// ============== 公开会话诊断端点 ==============
// GET /api/auth/session  (无需登录；若已登录返回 {authenticated:true, admin_id, expires_at})
#[derive(serde::Serialize)]
pub struct SessionInfoResponse {
    pub authenticated: bool,
    pub admin_id: Option<String>,
    pub expires_at: Option<String>,
}

pub async fn auth_session_info(
    State(state): State<Arc<AppShared>>,
    // 可选获取 header token，不报错
    parts: axum::http::request::Parts,
) -> Result<Json<ApiResponse<SessionInfoResponse>>, ApiError> {
    // 手动读取 header（与 SessionExtractor 逻辑类似，但宽松）
    let headers = &parts.headers;
    let raw = headers
        .get("X-Session-Id")
        .or_else(|| headers.get("Authorization"))
        .and_then(|h| h.to_str().ok());
    if raw.is_none() { return Ok(Json(ApiResponse { success: true, data: Some(SessionInfoResponse { authenticated: false, admin_id: None, expires_at: None }), message: "unauthenticated".into() })); }
    let token_full = raw.unwrap();
    let token = if token_full.starts_with("Bearer ") { &token_full[7..] } else { token_full };
    let row = sqlx::query("SELECT admin_id, session_id, expires_at FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP")
        .bind(token)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| { tracing::error!(error=%e, "session diag query failed"); ApiError::internal("session query failed") })?;
    if let Some(r) = row {
        let admin_id: String = r.get("admin_id");
        let expires_at: String = r.get("expires_at");
        return Ok(Json(ApiResponse { success: true, data: Some(SessionInfoResponse { authenticated: true, admin_id: Some(admin_id), expires_at: Some(expires_at) }), message: "ok".into() }));
    }
    Ok(Json(ApiResponse { success: true, data: Some(SessionInfoResponse { authenticated: false, admin_id: None, expires_at: None }), message: "expired".into() }))
}

#[derive(Debug)]
#[allow(dead_code)]
pub struct SessionExtractor(pub Session);

#[async_trait]
impl<S> FromRequestParts<S> for SessionExtractor
where
    S: Send + Sync,
    S: std::ops::Deref<Target = AppState>
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let headers = &parts.headers;
        let raw = headers
            .get("X-Session-Id")
            .or_else(|| headers.get("Authorization"))
            .and_then(|h| h.to_str().ok());

        let token = match raw {
            Some(h) => if h.starts_with("Bearer ") { &h[7..] } else { h },
            None => return Err(ApiError::unauthorized("未登录或缺少认证信息")),
        };

        let row = sqlx::query("SELECT admin_id, session_id FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP")
            .bind(token)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                error!(error=%e, "session 查询失败");
                ApiError::internal("服务器内部错误")
            })?;

        if let Some(r) = row {
            return Ok(SessionExtractor(Session { admin_id: r.get::<String, _>("admin_id"), session_id: r.get::<String, _>("session_id") }));
        }
        Err(ApiError::unauthorized("会话无效或已过期，请重新登录"))
    }
}
