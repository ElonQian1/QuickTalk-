use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;

use crate::{auth::AuthUser, error::AppError, models::*, services::chat::ChatService, AppState};
use crate::services::permissions as perms;

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
    // SQLx 权限校验：根据 session_id 解析 shop_id，再判定是否为店主或成员
    let session = crate::repositories::SessionRepository::find_by_id(&state.db_connection, session_id as i32)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::NotFound)?;
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, session.shop_id as i64).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
    let limit = p.limit.unwrap_or(50);
    let offset = p.offset.unwrap_or(0);

    eprintln!("🔍 get_messages - user_id: {}, session_id: {}, limit: {}, offset: {}", user_id, session_id, limit, offset);

    // 当offset为0时，不使用分页查询（走find_by_session分支，该分支已使用ASC排序）
    let offset_opt = if offset == 0 { 
        eprintln!("🎯 offset=0，将使用find_by_session分支（ASC排序）");
        None 
    } else { 
        eprintln!("📄 offset>0，将使用分页查询");
        Some(offset as u64) 
    };

    match state
        .message_service
        .get_messages_by_session(user_id, session_id, Some(limit as u64), offset_opt)
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
    // SQLx 权限校验：解析会话所属店铺，验证是否成员/店主
    let session = crate::repositories::SessionRepository::find_by_id(&state.db_connection, session_id as i32)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::NotFound)?;
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, session.shop_id as i64).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
    let message_type = payload
        .message_type
        .clone()
        .unwrap_or_else(|| "text".to_string());

    eprintln!("🔍 send_message - user_id: {}, session_id: {}, content: {}, message_type: {}", 
              user_id, session_id, &payload.content[..payload.content.len().min(50)], message_type);

    match state
        .message_service
        .send_staff_message(
            user_id.try_into().unwrap(),
            session_id,
            &payload.content,
            payload.message_type.clone(),
            payload.file_url.clone(),
            payload.file_name.clone(),
        )
        .await
    {
        Ok(message) => {
            eprintln!("✅ 消息创建成功，准备广播");
            
            // 构建WebSocket消息
            let ws_message = crate::models::WebSocketMessage {
                message_type: "new_message".to_string(),
                content: Some(payload.content.clone()),
                session_id: Some(session_id),
                sender_id: Some(user_id),
                sender_type: Some("staff".to_string()),
                timestamp: Some(chrono::Utc::now()),
                metadata: Some(serde_json::json!({
                    "messageType": message_type,
                })),
                file_url: payload.file_url.clone(),
                file_name: payload.file_name.clone(),
                file_size: None,
                media_duration: None,
            };
            
            // 广播给所有店铺客服（包括自己）
            if let Ok(sessions) = crate::repositories::SessionRepository::find_by_id(
                &state.db_connection,
                session_id as i32
            ).await {
                if let Some(session) = sessions {
                    eprintln!("📡 广播消息到店铺 {}", session.shop_id);
                    state.connections.lock().unwrap()
                        .broadcast_to_staff(session.shop_id as i64, &ws_message);
                    
                    // 获取客户信息以发送消息
                    if let Ok(Some(customer)) = crate::repositories::CustomerRepository::find_by_id(
                        &state.db_connection,
                        session.customer_id
                    ).await {
                        eprintln!("📡 发送消息给客户 {} (customer_id: {})", session.customer_id, customer.customer_id);
                        state.connections.lock().unwrap()
                            .send_to_customer(session.shop_id as i64, &customer.customer_id, &ws_message);
                    }
                }
            }
            
            // 转换为响应格式
            let response_message: Message = message.into();
            eprintln!("✅ 消息发送完成: id={}", response_message.id);
            
            Ok(Json(response_message))
        }
        Err(e) => {
            eprintln!("❌ send_message 错误: {:?}", e);
            Err(AppError::Internal(e.to_string()))
        }
    }
}
