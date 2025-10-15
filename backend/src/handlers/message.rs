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

    eprintln!("🔍 get_messages - user_id: {}, session_id: {}, limit: {}, offset: {}", user_id, session_id, limit, offset);

    match state
        .message_service
        .get_messages_by_session(user_id, session_id, Some(limit as u64), Some(offset as u64))
        .await
    {
        Ok(messages) => {
            eprintln!("✅ 查询到 {} 条消息", messages.len());
            // 转换为 Message 格式
            let result: Vec<Message> = messages.into_iter().map(|m| m.into()).collect();
            Ok(Json(result))
        }
        Err(e) => {
            eprintln!("❌ get_messages 错误: {:?}", e);
            Err(AppError::Internal(e.to_string()))
        }
    }
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Message>, AppError> {
    eprintln!("🔍 send_message - user_id: {}, session_id: {}, content: {}", 
              user_id, session_id, &payload.content[..payload.content.len().min(50)]);
    
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
        Ok(message) => {
            eprintln!("✅ 消息发送成功: id={}", message.id);
            // 转换为API响应格式
            let response_message: Message = message.into();
            Ok(Json(response_message))
        }
        Err(e) => {
            eprintln!("❌ send_message 错误: {:?}", e);
            Err(AppError::Internal(e.to_string()))
        }
    }
}
