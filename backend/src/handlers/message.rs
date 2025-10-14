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
    AuthUser { user_id }: AuthUser,
    Path(session_id): Path<i64>,
    Query(p): Query<PageQuery>,
) -> Result<Json<Vec<Message>>, AppError> {
    let limit = p.limit.unwrap_or(50);
    let offset = p.offset.unwrap_or(0);

    match state
        .message_service
        .get_messages_by_session(user_id, session_id, Some(limit as u64), Some(offset as u64))
        .await
    {
        Ok(messages) => {
            // 暂时返回空列表，等Repository层返回正确格式
            let empty_messages: Vec<Message> = Vec::new();
            Ok(Json(empty_messages))
        }
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Message>, AppError> {
    let message_type = payload
        .message_type
        .clone()
        .unwrap_or_else(|| "text".to_string());

    match state
        .message_service
        .send_staff_message(
            user_id.try_into().unwrap(),
            session_id,
            &payload.content,
        )
        .await
    {
        Ok(_message) => {
            // TODO: 需要重新实现WebSocket广播逻辑
            
            // 暂时返回简化的响应
            let response_message = Message {
                id: 1, // 临时值
                session_id: session_id,
                sender_type: "staff".to_string(),
                sender_id: Some(user_id),
                content: payload.content.clone(),
                message_type: message_type,
                file_url: payload.file_url.clone(),
                status: "sent".to_string(),
                created_at: chrono::Utc::now(),
            };

            Ok(Json(response_message))
        }
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}
