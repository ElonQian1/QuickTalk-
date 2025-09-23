use axum::{extract::{State, WebSocketUpgrade}, response::Response};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;

use crate::{AppState, WebSocketMessage};

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
    
    let welcome_msg = serde_json::json!({
        "type": "welcome",
        "message": "已连接到 QuickTalk 纯 Rust 服务器",
        "connection_id": connection_id,
        "timestamp": Utc::now()
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
    let ws_message: WebSocketMessage = serde_json::from_str(message)?;
    
    match ws_message.r#type.as_str() {
        "auth" => {
            info!("Connection {} attempting authentication", connection_id);
            if let Some(session_id) = &ws_message.session_id {
                info!("Session ID: {}", session_id);
            }
        },
        "join" => {
            if let Some(conversation_id) = &ws_message.conversation_id {
                info!("Connection {} joined conversation {}", connection_id, conversation_id);
                let join_msg = serde_json::json!({
                    "type": "user_joined",
                    "conversation_id": conversation_id,
                    "user_id": connection_id,
                    "timestamp": Utc::now()
                });
                let _ = state.message_sender.send(join_msg.to_string());
            }
        }
        "message" => {
            if let (Some(conversation_id), Some(sender_id), Some(content)) = 
                (&ws_message.conversation_id, &ws_message.sender_id, &ws_message.content) {
                let message_id = Uuid::new_v4().to_string();
                let result = sqlx::query(
                    "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&message_id)
                .bind(conversation_id)
                .bind(sender_id)
                .bind("customer")
                .bind(content)
                .bind("text")
                .bind(Utc::now())
                .execute(&state.db)
                .await;
                
                if let Err(e) = result {
                    warn!("Failed to save message to database: {}", e);
                } else {
                    info!("Message saved: {} in conversation {}", message_id, conversation_id);
                    let broadcast_msg = serde_json::json!({
                        "type": "new_message",
                        "message_id": message_id,
                        "conversation_id": conversation_id,
                        "sender_id": sender_id,
                        "content": content,
                        "timestamp": Utc::now()
                    });
                    let _ = state.message_sender.send(broadcast_msg.to_string());
                }
            }
        }
        "typing" => {
            if let Some(conversation_id) = &ws_message.conversation_id {
                let typing_msg = serde_json::json!({
                    "type": "typing",
                    "conversation_id": conversation_id,
                    "user_id": connection_id,
                    "timestamp": Utc::now()
                });
                let _ = state.message_sender.send(typing_msg.to_string());
            }
        }
        _ => {
            debug!("Unknown WebSocket message type: {}", ws_message.r#type);
        }
    }
    Ok(())
 }
