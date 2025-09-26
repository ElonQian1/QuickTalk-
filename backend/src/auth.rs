use axum::{http::request::Parts, async_trait, extract::FromRequestParts};
use axum::http::StatusCode;
use crate::types::ApiResponse;
use crate::bootstrap::app_state::AppState;
use serde::Serialize;
use tracing::error;
use sqlx::Row;

#[derive(Clone, Debug, Serialize)]
#[allow(dead_code)]
pub struct Session {
    pub admin_id: String,
    pub session_id: String,
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
    type Rejection = (StatusCode, axum::Json<ApiResponse<serde_json::Value>>);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let headers = &parts.headers;
        let raw = headers
            .get("X-Session-Id")
            .or_else(|| headers.get("Authorization"))
            .and_then(|h| h.to_str().ok());

        let token = match raw {
            Some(h) => if h.starts_with("Bearer ") { &h[7..] } else { h },
            None => {
                let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "未登录或缺少认证信息".into() };
                return Err((StatusCode::UNAUTHORIZED, axum::Json(body)));
            }
        };

        let row = sqlx::query("SELECT admin_id, session_id FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP")
            .bind(token)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| {
                error!(error=%e, "session 查询失败");
                let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "服务器内部错误".into() };
                (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(body))
            })?;

        if let Some(r) = row { return Ok(SessionExtractor(Session { admin_id: r.get::<String, _>("admin_id"), session_id: r.get::<String, _>("session_id") })); }

        let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "会话无效或已过期，请重新登录".into() };
        Err((StatusCode::UNAUTHORIZED, axum::Json(body)))
    }
}
