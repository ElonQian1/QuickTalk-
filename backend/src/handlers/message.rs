use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{auth::AuthUser, error::AppError, models::*, services::chat::ChatService, AppState};

#[derive(Deserialize)]
pub struct PageQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn get_messages(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
    Query(p): Query<PageQuery>,
) -> Result<Json<Vec<Message>>, AppError> {
    let messages = match state
        .db
        .get_messages_by_session(session_id, p.limit.or(Some(50)), p.offset.or(Some(0)))
        .await
    {
        Ok(mut messages) => {
            // 反转消息顺序，最新的在前面
            messages.reverse();
            messages
        }
        Err(_) => return Err(AppError::Internal("获取消息失败".to_string())),
    };

    Ok(Json(messages))
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Message>, AppError> {
    // 解析会话与客户
    let chat = ChatService::new(&state);
    let (session, customer) = match chat.resolve_session(session_id).await {
        Ok(v) => v,
        Err(_) => return Err(AppError::NotFound),
    };

    let message_type = payload
        .message_type
        .clone()
        .unwrap_or_else(|| "text".to_string());

    let ws_payload = crate::services::chat::MessagePayload {
        content: Some(payload.content.clone()),
        message_type,
        file_url: payload.file_url.clone(),
        file_name: None,
        file_size: None,
        media_duration: None,
        metadata: None,
    };

    let persisted = match chat
        .persist_staff_message(&session, user_id, ws_payload, &customer)
        .await
    {
        Ok(v) => v,
        Err(_) => return Err(AppError::Internal("发送消息失败".to_string())),
    };

    // 广播给客户与店铺下所有客服
    {
        let mut manager = state.connections.lock().unwrap();
        manager.send_to_customer(
            session.shop_id,
            &customer.customer_id,
            &persisted.ws_message,
        );
        manager.broadcast_to_staff(session.shop_id, &persisted.ws_message);
    }

    Ok(Json(persisted.message))
}
