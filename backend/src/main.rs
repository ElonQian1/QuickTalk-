use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        ConnectInfo, State, WebSocketUpgrade,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{error, info, warn};
use uuid::Uuid;

mod auth;
mod database;
mod handlers;
mod models;
mod websocket;

use database::Database;
use models::*;
use websocket::ConnectionManager;

// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub connections: Arc<Mutex<ConnectionManager>>,
}

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志
    tracing_subscriber::fmt::init();

    // 初始化数据库
    let db = Database::new("sqlite:customer_service.db").await?;
    db.migrate().await?;

    // 创建连接管理器
    let connections = Arc::new(Mutex::new(ConnectionManager::new()));

    let state = AppState { db, connections };

    // 构建路由
    let app = Router::new()
        .route("/", get(|| async { "Customer Service System API" }))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/shops", get(handlers::shop::get_shops))
        .route("/api/shops", post(handlers::shop::create_shop))
        .route("/api/shops/:shop_id/customers", get(handlers::customer::get_customers))
        .route("/api/sessions/:session_id/messages", get(handlers::message::get_messages))
        .route("/api/sessions/:session_id/messages", post(handlers::message::send_message))
        .route("/ws/staff/:user_id", get(websocket_handler_staff))
        .route("/ws/customer/:shop_id/:customer_id", get(websocket_handler_customer))
        .nest_service("/static", ServeDir::new("static"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    info!("Customer Service System started on http://0.0.0.0:8080");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

// 客服人员 WebSocket 处理
async fn websocket_handler_staff(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Staff WebSocket connection from: {}", addr);
    ws.on_upgrade(move |socket| handle_staff_socket(socket, state))
}

// 客户 WebSocket 处理
async fn websocket_handler_customer(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Customer WebSocket connection from: {}", addr);
    ws.on_upgrade(move |socket| handle_customer_socket(socket, state))
}

async fn handle_staff_socket(mut socket: WebSocket, state: AppState) {
    let connection_id = Uuid::new_v4().to_string();
    info!("New staff connection: {}", connection_id);

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(message) = serde_json::from_str::<WebSocketMessage>(&text) {
                    handle_staff_message(message, &state, &connection_id).await;
                }
            }
            Ok(Message::Close(_)) => {
                info!("Staff connection {} closed", connection_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

async fn handle_customer_socket(mut socket: WebSocket, state: AppState) {
    let connection_id = Uuid::new_v4().to_string();
    info!("New customer connection: {}", connection_id);

    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(Message::Text(text)) => {
                if let Ok(message) = serde_json::from_str::<WebSocketMessage>(&text) {
                    handle_customer_message(message, &state, &connection_id).await;
                }
            }
            Ok(Message::Close(_)) => {
                info!("Customer connection {} closed", connection_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }
}

async fn handle_staff_message(message: WebSocketMessage, state: &AppState, connection_id: &str) {
    match message.message_type.as_str() {
        "auth" => {
            // 处理客服认证
            info!("Staff authentication for connection: {}", connection_id);
        }
        "send_message" => {
            // 处理发送消息
            if let Some(content) = message.content {
                info!("Staff message: {}", content);
                // 保存消息到数据库并转发给客户
            }
        }
        "typing" => {
            // 处理打字状态
            info!("Staff typing indicator");
        }
        _ => {
            warn!("Unknown message type from staff: {}", message.message_type);
        }
    }
}

async fn handle_customer_message(message: WebSocketMessage, state: &AppState, connection_id: &str) {
    match message.message_type.as_str() {
        "auth" => {
            // 处理客户认证
            info!("Customer authentication for connection: {}", connection_id);
        }
        "send_message" => {
            // 处理发送消息
            if let Some(content) = message.content {
                info!("Customer message: {}", content);
                // 保存消息到数据库并转发给客服
            }
        }
        "typing" => {
            // 处理打字状态
            info!("Customer typing indicator");
        }
        _ => {
            warn!("Unknown message type from customer: {}", message.message_type);
        }
    }
}