use axum::{extract::{Path, State}, Json};
use serde::Serialize;

use crate::{auth::AuthUser, error::AppError, models::{Session, Customer}, services::chat::ChatService, AppState};

/// 会话及其关联客户信息的响应结构
#[derive(Debug, Serialize)]
pub struct SessionWithCustomer {
    #[serde(flatten)]
    pub session: Session,
    pub customer: Customer,
}

// Purpose: 获取会话元信息（含 shop_id 和完整客户信息），便于前端展示统一的客户名称
// Input: session_id（路径参数）
// Output: SessionWithCustomer（会话结构 + 完整客户对象）
// Errors: 404（会话不存在）、403（用户非该店铺店主/员工）、500（内部错误）
pub async fn get_session(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(session_id): Path<i64>,
) -> Result<Json<SessionWithCustomer>, AppError> {
    let chat = ChatService::new(&state);
    let (session, customer) = chat
        .resolve_session(session_id)
        .await
        .map_err(|_| AppError::NotFound)?;

    // 使用 SessionService 进行权限检查 (通过 ChatService 已经验证了权限)
    Ok(Json(SessionWithCustomer {
        session: session.into(),
        customer: customer.into(),
    }))
}
