use axum::{extract::{Path, State}, Json};

use crate::{auth::AuthUser, error::AppError, models::Session, services::{chat::ChatService, permissions}, AppState};

// Purpose: 获取会话元信息（含 shop_id），便于前端按会话所属店铺建立正确的 WS 连接
// Input: session_id（路径参数）
// Output: Session（完整结构体，包含 shop_id/customer_id 等）
// Errors: 404（会话不存在）、403（用户非该店铺店主/员工）、500（内部错误）
pub async fn get_session(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(session_id): Path<i64>,
) -> Result<Json<Session>, AppError> {
    let chat = ChatService::new(&state);
    let (session, _customer) = chat
        .resolve_session(session_id)
        .await
        .map_err(|_| AppError::NotFound)?;

    // 权限：仅店主或该店铺员工可访问
    if let Err(e) = permissions::ensure_member_or_owner(&state.db, user_id, session.shop_id).await {
        return Err(match e { AppError::Unauthorized => AppError::Forbidden, other => other });
    }

    Ok(Json(session))
}
