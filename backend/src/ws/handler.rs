use axum::{extract::{State, WebSocketUpgrade}, response::Response};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;

use crate::bootstrap::app_state::AppState;
use crate::types::{WsClientMessage, WsServerMessage};
use serde_json::json;

pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let connection_id = Uuid::new_v4().to_string();
    let mut message_receiver = state.message_sender.subscribe();
    
    info!("新的 WebSocket 连接已建立: {}", connection_id);
    
    let welcome_msg = json!({
        "version": "v1",
        "type": "system.welcome",
        "event_id": Uuid::new_v4().to_string(),
        "emitted_at": Utc::now().to_rfc3339(),
        "data": {
            "message": "已连接到 QuickTalk 纯 Rust 服务器",
            "connection_id": connection_id,
            "time": Utc::now()
        }
    });
    
    if sender.send(WsMessage::Text(welcome_msg.to_string())).await.is_err() {
        error!("发送欢迎消息失败");
        return;
    }
    
    let mut send_task = {
        let mut sender = sender;
        tokio::spawn(async move {
            while let Ok(message) = message_receiver.recv().await {
                if sender.send(WsMessage::Text(message)).await.is_err() {
                    break;
                }
            }
        })
    };
    
    let mut recv_task = {
        let state = state.clone();
        let connection_id = connection_id.clone();
        
        tokio::spawn(async move {
            while let Some(msg) = receiver.next().await {
                match msg {
                    Ok(WsMessage::Text(text)) => {
                        info!("收到 WebSocket 消息，来自 {}: {}", connection_id, text);
                        if let Err(e) = handle_websocket_message(&state, &text, &connection_id).await {
                            warn!("处理 WebSocket 消息失败: {}", e);
                        }
                    }
                    Ok(WsMessage::Close(_)) => {
                        info!("WebSocket 连接关闭: {}", connection_id);
                        break;
                    }
                    Err(e) => {
                        error!("WebSocket 连接 {} 出现错误: {}", connection_id, e);
                        break;
                    }
                    _ => {}
                }
            }
        })
    };
    
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        },
    }
    
    info!("WebSocket 连接已结束: {}", connection_id);
}

async fn handle_websocket_message(
    state: &AppState,
    message: &str,
    connection_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Try new enum format first
    if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(message) {
        match client_msg {
            WsClientMessage::Auth { token } => {
                info!("Connection {} auth token length={} ", connection_id, token.len());
                let ack = WsServerMessage::Authenticated { user_id: connection_id.to_string() };
                let _ = state.message_sender.send(serde_json::to_string(&ack)?);
            }
            WsClientMessage::JoinConversation { conversation_id } => {
                info!("Connection {} joined conversation {}", connection_id, conversation_id);
                let joined = WsServerMessage::JoinedConversation { conversation_id: conversation_id.clone() };
                let _ = state.message_sender.send(serde_json::to_string(&joined)?);
            }
            WsClientMessage::LeaveConversation { conversation_id } => {
                info!("Connection {} left conversation {}", connection_id, conversation_id);
                let left = WsServerMessage::LeftConversation { conversation_id };
                let _ = state.message_sender.send(serde_json::to_string(&left)?);
            }
            WsClientMessage::Send { conversation_id, content, message_type } => {
                let message_id = Uuid::new_v4().to_string();
                let result = sqlx::query(
                    "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&message_id)
                .bind(&conversation_id)
                .bind(connection_id)
                .bind("customer")
                .bind(&content)
                .bind(&message_type)
                .bind(Utc::now())
                .execute(&state.db)
                .await;
                if let Err(e) = result { warn!("Failed to save message: {}", e); }
                let enriched = json!({
                    "id": message_id,
                    "conversation_id": conversation_id,
                    "sender_id": connection_id,
                    "sender_type": "customer",
                    "content": content,
                    "message_type": message_type,
                    "timestamp": Utc::now(),
                    "shop_id": null
                });
                let envelope = json!({
                    "version": "v1",
                    "type": "domain.event.message_appended",
                    "event_id": Uuid::new_v4().to_string(),
                    "emitted_at": Utc::now().to_rfc3339(),
                    "data": { "message": enriched }
                });
                let _ = state.message_sender.send(envelope.to_string());
            }
            WsClientMessage::Typing { conversation_id, user_id } => {
                let server_msg = WsServerMessage::Typing { conversation_id, user_id };
                let _ = state.message_sender.send(serde_json::to_string(&server_msg)?);
            }
            WsClientMessage::Read { conversation_id, message_ids } => {
                let server_msg = WsServerMessage::Read { conversation_id, message_ids };
                let _ = state.message_sender.send(serde_json::to_string(&server_msg)?);
            }
            WsClientMessage::Ping => {
                let pong = WsServerMessage::Pong { time: Utc::now() };
                let _ = state.message_sender.send(serde_json::to_string(&pong)?);
            }
            WsClientMessage::Pong | WsClientMessage::LoadHistory { .. } | WsClientMessage::ErrorAck { .. } => {
                debug!("Received client control msg: ignored for now");
            }
        }
        return Ok(());
    }
    
    // Legacy format support: 兼容旧版客户端发送的消息格式
    if let Ok(legacy_msg) = serde_json::from_str::<serde_json::Value>(message) {
        if let Some(msg_type) = legacy_msg.get("type").and_then(|t| t.as_str()) {
            match msg_type {
                "customer_message" => {
                    // 处理旧格式的客户消息
                    let shop_id = legacy_msg.get("shop_id")
                        .and_then(|s| s.as_str())
                        .unwrap_or("unknown");
                    let content = legacy_msg.get("content")
                        .and_then(|c| c.as_str())
                        .unwrap_or("");
                    
                    if !content.is_empty() {
                        // 使用新的消息处理模块
                        if let Err(e) = super::message_handler::handle_customer_message(state, shop_id, content, connection_id).await {
                            warn!("处理客户端消息失败: {}", e);
                        }
                    }
                }
                "message" => {
                    // 处理管理端发送的消息
                    let conversation_id = legacy_msg.get("conversation_id")
                        .and_then(|c| c.as_str())
                        .unwrap_or("");
                    let content = legacy_msg.get("content")
                        .and_then(|c| c.as_str())
                        .unwrap_or("");
                    let _sender_type = legacy_msg.get("sender_type")
                        .and_then(|s| s.as_str())
                        .unwrap_or("agent");
                    
                    if !content.is_empty() && !conversation_id.is_empty() {
                        // 使用新的消息处理模块处理管理端消息
                        if let Err(e) = super::message_handler::handle_agent_message(state, conversation_id, content, connection_id).await {
                            warn!("处理管理端消息失败: {}", e);
                        }
                    }
                }
                _ => {
                    debug!("Unsupported legacy message type: {}", msg_type);
                }
            }
        }
    }
    
    debug!("Unsupported WS message format from {}", connection_id);
    Ok(())
}

// 查找或创建对话的辅助函数
pub async fn find_or_create_conversation(
    state: &AppState,
    shop_id: &str,
    customer_id: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    // 先查找现有对话
    let existing = sqlx::query_scalar::<_, String>(
        "SELECT id FROM conversations WHERE shop_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 1"
    )
    .bind(shop_id)
    .bind(customer_id)
    .fetch_optional(&state.db)
    .await?;
    
    if let Some(conversation_id) = existing {
        return Ok(conversation_id);
    }
    
    // 确保客户记录存在（如果不存在则创建）
    let customer_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM customers WHERE id = ?"
    )
    .bind(customer_id)
    .fetch_one(&state.db)
    .await?;
    
    if customer_exists == 0 {
        info!("Creating new customer record: {}", customer_id);
        sqlx::query(
            "INSERT OR IGNORE INTO customers (id, name, email, created_at) VALUES (?, ?, ?, ?)"
        )
        .bind(customer_id)
        .bind(format!("客户_{}", &customer_id[..8])) // 使用部分ID作为默认名称
        .bind(format!("{}@example.com", customer_id))
        .bind(Utc::now())
        .execute(&state.db)
        .await?;
    }
    
    // 确保店铺记录存在
    let shop_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM shops WHERE id = ?"
    )
    .bind(shop_id)
    .fetch_one(&state.db)
    .await?;
    
    if shop_exists == 0 {
        warn!("Shop {} does not exist, cannot create conversation", shop_id);
        return Err(format!("Shop {} not found", shop_id).into());
    }
    
    // 创建新对话
    let conversation_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&conversation_id)
    .bind(shop_id)
    .bind(customer_id)
    .bind("active")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&state.db)
    .await?;
    
    info!("Created new conversation: {} for shop {} and customer {}", conversation_id, shop_id, customer_id);
    Ok(conversation_id)
}