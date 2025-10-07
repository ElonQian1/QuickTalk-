use axum::{extract::{Path, State}, http::StatusCode, Json};

use crate::{models::*, AppState};

pub async fn get_messages(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
) -> Result<Json<Vec<Message>>, StatusCode> {
    let messages = match state.db.get_messages_by_session(session_id, Some(50), Some(0)).await {
        Ok(mut messages) => {
            // 反转消息顺序，最新的在前面
            messages.reverse();
            messages
        },
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Json(messages))
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(session_id): Path<i64>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<Message>, StatusCode> {
    // TODO: 从认证中间件获取发送者信息
    let sender_type = "staff"; // 暂时硬编码
    let sender_id = Some(2i64); // 暂时硬编码

    let message = match state.db.create_message(
        session_id,
        sender_type,
        sender_id,
        &payload.content,
        &payload.message_type.unwrap_or_else(|| "text".to_string()),
    ).await {
        Ok(message) => message,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    // TODO: 通过 WebSocket 推送消息给相关用户

    Ok(Json(message))
}