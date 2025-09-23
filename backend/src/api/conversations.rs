use axum::{extract::{Path, Query, State}, http::StatusCode, response::Json};
use chrono::Utc;
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{ApiResponse, AppState, Conversation, CreateConversationRequest, Message, CreateMessageRequest, UpdateMessageRequest, UpdateConversationStatusRequest, ConversationSummary};

pub async fn get_conversations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Conversation>>>, StatusCode> {
    let shop_id = params.get("shop_id");

    let query = if let Some(shop_id) = shop_id {
        sqlx::query("SELECT * FROM conversations WHERE shop_id = ? ORDER BY updated_at DESC")
            .bind(shop_id)
    } else {
        sqlx::query("SELECT * FROM conversations ORDER BY updated_at DESC")
    };

    match query.fetch_all(&state.db).await {
        Ok(rows) => {
            let conversations: Vec<Conversation> = rows
                .iter()
                .map(|row| Conversation {
                    id: row.get("id"),
                    shop_id: row.get("shop_id"),
                    customer_id: row.get("customer_id"),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(conversations),
                message: "Conversations retrieved successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_conversation_details(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ApiResponse<Conversation>>, StatusCode> {
    match sqlx::query_as::<_, Conversation>("SELECT * FROM conversations WHERE id = ?")
        .bind(&conversation_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(conversation) => Ok(Json(ApiResponse {
            success: true,
            data: Some(conversation),
            message: "Conversation details retrieved successfully".to_string(),
        })),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn create_conversation(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateConversationRequest>,
) -> Result<Json<ApiResponse<Conversation>>, StatusCode> {
    let conversation_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    match sqlx::query(
        "INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&conversation_id)
    .bind(&request.shop_id)
    .bind(&request.customer_id)
    .bind("active")
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            let conversation = Conversation {
                id: conversation_id,
                shop_id: request.shop_id,
                customer_id: request.customer_id,
                status: "active".to_string(),
                created_at: now,
                updated_at: now,
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(conversation),
                message: "Conversation created successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Message>>>, StatusCode> {
    let limit: i32 = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(50);
    let offset: i32 = params.get("offset").and_then(|o| o.parse().ok()).unwrap_or(0);

    match sqlx::query(
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    )
    .bind(&conversation_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    {
        Ok(rows) => {
            let messages: Vec<Message> = rows
                .iter()
                .map(|row| Message {
                    id: row.get("id"),
                    conversation_id: row.get("conversation_id"),
                    sender_id: row.get("sender_id"),
                    sender_type: row.get("sender_type"),
                    content: row.get("content"),
                    message_type: row.get("message_type"),
                    timestamp: row.get("timestamp"),
                    shop_id: row.get("shop_id"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(messages),
                message: "Messages retrieved successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Json(request): Json<CreateMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    let message_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // 验证 conversation_id 是否匹配
    if conversation_id != request.conversation_id {
        return Err(StatusCode::BAD_REQUEST);
    }

    match sqlx::query(
        "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT shop_id FROM conversations WHERE id = ?))"
    )
    .bind(&message_id)
    .bind(&request.conversation_id)
    .bind(&request.sender_id)
    .bind(&request.sender_type)
    .bind(&request.content)
    .bind(&request.message_type)
    .bind(now)
    .bind(&request.conversation_id)
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            let message = Message {
                id: message_id,
                conversation_id: request.conversation_id.clone(),
                sender_id: request.sender_id.clone(),
                sender_type: request.sender_type.clone(),
                content: request.content.clone(),
                message_type: request.message_type.clone(),
                timestamp: now,
                shop_id: None, // This will be populated by a trigger or another query if needed
            };

            // 广播新消息
            let broadcast_msg = serde_json::json!({
                "type": "new_message",
                "message": message,
                "timestamp": now
            });

            let _ = state.message_sender.send(broadcast_msg.to_string());

            // 更新对话的最后更新时间
            let _ = sqlx::query("UPDATE conversations SET updated_at = ? WHERE id = ?")
                .bind(now)
                .bind(&request.conversation_id)
                .execute(&state.db)
                .await;

            Ok(Json(ApiResponse {
                success: true,
                data: Some(message),
                message: "Message sent successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn update_message(
    State(state): State<Arc<AppState>>,
    Path((_conversation_id, message_id)): Path<(String, String)>,
    Json(request): Json<UpdateMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    match sqlx::query("UPDATE messages SET content = ? WHERE id = ?")
        .bind(&request.content)
        .bind(&message_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() == 0 {
                return Err(StatusCode::NOT_FOUND);
            }
            // Fetch the updated message to return it
            match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ?")
                .bind(&message_id)
                .fetch_one(&state.db)
                .await
            {
                Ok(message) => Ok(Json(ApiResponse {
                    success: true,
                    data: Some(message),
                    message: "Message updated successfully".to_string(),
                })),
                Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    Path((_conversation_id, message_id)): Path<(String, String)>,
) -> Result<StatusCode, StatusCode> {
    match sqlx::query("DELETE FROM messages WHERE id = ?")
        .bind(&message_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(StatusCode::NO_CONTENT)
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn update_conversation_status(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Json(request): Json<UpdateConversationStatusRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE conversations SET status = ? WHERE id = ?")
        .bind(&request.status)
        .bind(&conversation_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                Ok(Json(ApiResponse {
                    success: true,
                    data: None,
                    message: "Conversation status updated".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn search_conversations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Conversation>>>, StatusCode> {
    let query_term = params.get("q").map(|s| format!("%{}%", s)).unwrap_or_else(|| "%".to_string());
    let shop_id = params.get("shop_id");

    let conversations_result = if let Some(id) = shop_id {
        sqlx::query_as::<_, Conversation>(
            "SELECT c.* FROM conversations c 
             LEFT JOIN customers cu ON c.customer_id = cu.id 
             WHERE c.shop_id = ? AND (cu.name LIKE ? OR cu.email LIKE ?)",
        )
        .bind(id)
        .bind(&query_term)
        .bind(&query_term)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query_as::<_, Conversation>(
            "SELECT c.* FROM conversations c 
             LEFT JOIN customers cu ON c.customer_id = cu.id 
             WHERE cu.name LIKE ? OR cu.email LIKE ?",
        )
        .bind(&query_term)
        .bind(&query_term)
        .fetch_all(&state.db)
        .await
    };
    
    match conversations_result {
        Ok(conversations) => Ok(Json(ApiResponse {
            success: true,
            data: Some(conversations),
            message: "Search results".to_string(),
        })),
        Err(e) => {
            tracing::error!("Failed to search conversations: {:?}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_conversation_summary(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ApiResponse<ConversationSummary>>, StatusCode> {
    match sqlx::query_as::<_, ConversationSummary>(
        "SELECT c.id, c.shop_id, c.customer_id, c.status, c.created_at, c.updated_at, 
                (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
                (SELECT MAX(timestamp) FROM messages WHERE conversation_id = c.id) as last_message_time
         FROM conversations c 
         WHERE c.id = ?"
    )
    .bind(&conversation_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(summary) => Ok(Json(ApiResponse {
            success: true,
            data: Some(summary),
            message: "Conversation summary retrieved successfully".to_string(),
        })),
        Err(sqlx::Error::RowNotFound) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
