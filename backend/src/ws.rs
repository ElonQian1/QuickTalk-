use axum::{extract::{State, WebSocketUpgrade}, response::Response};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use futures_util::{sink::SinkExt, stream::StreamExt};
use tracing::{info, warn, error, debug};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;

use crate::bootstrap::app_state::AppState;
use crate::types::{WsClientMessage, WsServerMessage};

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
                let server_msg = WsServerMessage::MessageSent { conversation_id: conversation_id.clone(), message: crate::types::Message {
                    id: message_id,
                    conversation_id: conversation_id.clone(),
                    sender_id: connection_id.to_string(),
                    sender_type: "customer".into(),
                    content,
                    message_type,
                    timestamp: Utc::now(),
                    shop_id: None,
                }};
                let _ = state.message_sender.send(serde_json::to_string(&server_msg)?);
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
    // Legacy fallback omitted for brevity after refactor
    debug!("Unsupported WS message format from {}", connection_id);
    Ok(())
 }
