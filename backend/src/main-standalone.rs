use axum::{
    extract::{State, WebSocketUpgrade, Multipart},
    http::{StatusCode, Uri},
    response::{Json, Html, Response, Redirect},
    routing::{get, post, any},
    Router,
};
use axum::extract::ws::WebSocket;
use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing::{info, warn, error};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::path::PathBuf;
use std::collections::HashMap;
use tokio::sync::RwLock;

// 纯Rust架构应用状态
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub websocket_connections: Arc<RwLock<HashMap<String, tokio::sync::mpsc::UnboundedSender<axum::extract::ws::Message>>>>,
    pub standalone_mode: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: String,
}

#[derive(Serialize, Deserialize)]
pub struct Shop {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub api_key: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub conversation_id: String,
    pub sender_id: String,
    pub content: String,
    pub message_type: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// 主页路由 - 重定向到实际的index页面
pub async fn serve_index() -> Redirect {
    Redirect::permanent("/src/pages/index.html")
}

// 管理后台路由
pub async fn serve_admin() -> Redirect {
    Redirect::permanent("/src/pages/admin-mobile.html")
}

// 移动端管理后台
pub async fn serve_mobile_admin() -> Redirect {
    Redirect::permanent("/src/pages/admin-mobile.html")
}

// WebSocket 处理 - 完全独立实现
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let connection_id = uuid::Uuid::new_v4().to_string();
    
    info!("New WebSocket connection established: {}", connection_id);
    
    // 创建消息通道
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    
    // 注册连接
    state.websocket_connections.write().await.insert(connection_id.clone(), tx);
    
    // 发送欢迎消息
    let welcome_message = serde_json::json!({
        "type": "welcome",
        "message": "Connected to QuickTalk Rust Server (Standalone Mode)",
        "connection_id": connection_id,
        "timestamp": chrono::Utc::now()
    });
    
    if sender.send(axum::extract::ws::Message::Text(welcome_message.to_string())).await.is_err() {
        state.websocket_connections.write().await.remove(&connection_id);
        return;
    }
    
    // 启动消息转发任务
    let connection_id_clone = connection_id.clone();
    let state_clone = state.clone();
    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
        state_clone.websocket_connections.write().await.remove(&connection_id_clone);
    });
    
    // 处理接收到的消息
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(axum::extract::ws::Message::Text(text)) => {
                info!("Received WebSocket message from {}: {}", connection_id, text);
                
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Err(e) = handle_websocket_message(&state, &connection_id, json).await {
                        warn!("Failed to handle WebSocket message: {}", e);
                    }
                }
            }
            Ok(axum::extract::ws::Message::Close(_)) => {
                info!("WebSocket connection closed: {}", connection_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error for {}: {}", connection_id, e);
                break;
            }
            _ => {}
        }
    }
    
    // 清理连接
    state.websocket_connections.write().await.remove(&connection_id);
    forward_task.abort();
}

// 处理WebSocket消息 - 纯Rust实现
async fn handle_websocket_message(
    state: &AppState,
    connection_id: &str,
    message: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    match message.get("type").and_then(|t| t.as_str()) {
        Some("send_message") => {
            handle_send_message(state, connection_id, message).await?;
        }
        Some("join_conversation") => {
            handle_join_conversation(state, connection_id, message).await?;
        }
        Some("ping") => {
            send_to_connection(state, connection_id, serde_json::json!({
                "type": "pong",
                "timestamp": chrono::Utc::now()
            })).await?;
        }
        _ => {
            warn!("Unknown WebSocket message type from {}: {:?}", connection_id, message);
        }
    }
    Ok(())
}

// 发送消息处理
async fn handle_send_message(
    state: &AppState,
    connection_id: &str,
    message: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let content = message.get("content").and_then(|c| c.as_str()).unwrap_or("");
    let conversation_id = message.get("conversation_id").and_then(|c| c.as_str()).unwrap_or("default");
    let sender_id = message.get("sender_id").and_then(|s| s.as_str()).unwrap_or("anonymous");
    
    // 保存消息到数据库
    let message_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now();
    
    sqlx::query!(
        "INSERT INTO messages (id, conversation_id, sender_id, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        message_id,
        conversation_id,
        sender_id,
        content,
        "text",
        timestamp
    )
    .execute(&state.db)
    .await?;
    
    // 广播消息给所有连接
    let broadcast_message = serde_json::json!({
        "type": "new_message",
        "message": {
            "id": message_id,
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "content": content,
            "message_type": "text",
            "timestamp": timestamp
        }
    });
    
    broadcast_to_all(state, broadcast_message).await?;
    
    Ok(())
}

// 加入对话处理
async fn handle_join_conversation(
    state: &AppState,
    connection_id: &str,
    message: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let conversation_id = message.get("conversation_id").and_then(|c| c.as_str()).unwrap_or("default");
    
    // 获取对话历史
    let messages = sqlx::query_as!(
        Message,
        "SELECT id, conversation_id, sender_id, content, message_type, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 50",
        conversation_id
    )
    .fetch_all(&state.db)
    .await?;
    
    // 发送历史消息
    let history_message = serde_json::json!({
        "type": "conversation_history",
        "conversation_id": conversation_id,
        "messages": messages
    });
    
    send_to_connection(state, connection_id, history_message).await?;
    
    Ok(())
}

// 发送消息到指定连接
async fn send_to_connection(
    state: &AppState,
    connection_id: &str,
    message: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let connections = state.websocket_connections.read().await;
    if let Some(tx) = connections.get(connection_id) {
        let _ = tx.send(axum::extract::ws::Message::Text(message.to_string()));
    }
    Ok(())
}

// 广播消息到所有连接
async fn broadcast_to_all(
    state: &AppState,
    message: serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let connections = state.websocket_connections.read().await;
    let message_text = message.to_string();
    
    for (_, tx) in connections.iter() {
        let _ = tx.send(axum::extract::ws::Message::Text(message_text.clone()));
    }
    
    Ok(())
}

// API Routes - 完全独立实现
pub async fn health_check() -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "server": "rust-standalone",
            "version": "1.0.0",
            "status": "running",
            "mode": "standalone",
            "dependencies": {
                "nodejs": false,
                "nginx": false,
                "external_services": false
            },
            "timestamp": chrono::Utc::now()
        })),
        message: "QuickTalk Rust Server (Standalone Mode) is running".to_string(),
    })
}

pub async fn get_shops(State(state): State<Arc<AppState>>) -> Result<Json<ApiResponse<Vec<Shop>>>, StatusCode> {
    match sqlx::query("SELECT id, name, domain, api_key, status FROM shops")
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let shops: Vec<Shop> = rows
                .iter()
                .map(|row| Shop {
                    id: row.get("id"),
                    name: row.get("name"),
                    domain: row.get("domain"),
                    api_key: row.get("api_key"),
                    status: row.get("status"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(shops),
                message: "Shops retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Database error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 消息API
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    let message_id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now();
    let message_type = payload.message_type.unwrap_or_else(|| "text".to_string());
    
    // 保存到数据库
    match sqlx::query!(
        "INSERT INTO messages (id, conversation_id, sender_id, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
        message_id,
        payload.conversation_id,
        payload.sender_id,
        payload.content,
        message_type,
        timestamp
    )
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            let message = Message {
                id: message_id,
                conversation_id: payload.conversation_id.clone(),
                sender_id: payload.sender_id.clone(),
                content: payload.content.clone(),
                message_type: message_type.clone(),
                timestamp,
            };
            
            // 通过WebSocket广播
            let broadcast_message = serde_json::json!({
                "type": "new_message",
                "message": message
            });
            
            if let Err(e) = broadcast_to_all(&state, broadcast_message).await {
                warn!("Failed to broadcast message: {}", e);
            }
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(message),
                message: "Message sent successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to save message: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取对话消息
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(conversation_id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Vec<Message>>>, StatusCode> {
    match sqlx::query_as!(
        Message,
        "SELECT id, conversation_id, sender_id, content, message_type, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT 100",
        conversation_id
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(messages) => {
            Ok(Json(ApiResponse {
                success: true,
                data: Some(messages),
                message: "Messages retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to get messages: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 文件上传处理 - 独立实现
pub async fn upload_file(
    State(_state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    while let Some(field) = multipart.next_field().await.unwrap() {
        let _name = field.name().unwrap_or("").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        let data = field.bytes().await.unwrap();
        
        // 保存文件
        let upload_dir = PathBuf::from("../uploads");
        tokio::fs::create_dir_all(&upload_dir).await.unwrap();
        
        let file_path = upload_dir.join(&filename);
        tokio::fs::write(&file_path, &data).await.unwrap();
        
        info!("File uploaded: {} ({})", filename, data.len());
        
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "filename": filename,
                "size": data.len(),
                "path": format!("/uploads/{}", filename)
            })),
            message: "File uploaded successfully".to_string(),
        }));
    }
    
    Err(StatusCode::BAD_REQUEST)
}

// WebSocket状态API
pub async fn websocket_status(
    State(state): State<Arc<AppState>>,
) -> Json<ApiResponse<serde_json::Value>> {
    let connections = state.websocket_connections.read().await;
    let connection_count = connections.len();
    
    Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "active_connections": connection_count,
            "connection_ids": connections.keys().collect::<Vec<_>>(),
            "status": "active"
        })),
        message: format!("{} active WebSocket connections", connection_count),
    })
}

// 创建应用路由
pub async fn create_app(db: SqlitePool) -> Router {
    let state = Arc::new(AppState { 
        db,
        websocket_connections: Arc::new(RwLock::new(HashMap::new())),
        standalone_mode: true,
    });

    Router::new()
        // API 路由
        .route("/api/health", get(health_check))
        .route("/api/shops", get(get_shops))
        .route("/api/messages/send", post(send_message))
        .route("/api/messages/:conversation_id", get(get_messages))
        .route("/api/upload", post(upload_file))
        .route("/api/websocket/status", get(websocket_status))
        
        // WebSocket
        .route("/ws", get(websocket_handler))
        
        // 主要页面路由（需要在静态文件服务之前）
        .route("/", get(serve_index))
        .route("/admin", get(serve_admin))
        .route("/mobile/admin", get(serve_mobile_admin))
        
        // 上传文件服务
        .nest_service("/uploads", ServeDir::new("../uploads"))
        
        // 静态文件服务 - 这会匹配所有其他路径
        .fallback_service(ServeDir::new("../frontend/dist"))
        
        // CORS和追踪
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

// 初始化数据库
async fn init_database(db: &SqlitePool) -> Result<(), sqlx::Error> {
    // 创建消息表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            message_type TEXT NOT NULL DEFAULT 'text',
            timestamp DATETIME NOT NULL,
            INDEX idx_conversation_id (conversation_id),
            INDEX idx_timestamp (timestamp)
        )
        "#,
    )
    .execute(db)
    .await?;
    
    // 创建商店表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS shops (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            api_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(db)
    .await?;
    
    // 创建对话表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(db)
    .await?;
    
    info!("Database tables initialized successfully");
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();
    
    // 加载环境变量
    dotenv::dotenv().ok();
    
    info!("🦀 Starting QuickTalk Rust Server (Standalone Mode)");
    
    // 连接数据库
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../data/database/database.sqlite".to_string());
    
    let db = SqlitePool::connect(&database_url).await?;
    
    // 初始化数据库表
    init_database(&db).await?;
    
    // 创建应用
    let app = create_app(db).await;
    
    // 启动服务器
    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("🦀 QuickTalk Rust Server (Standalone) starting on {}", addr);
    info!("📱 Admin Panel: http://localhost:{}/admin", port);
    info!("📱 Mobile Admin: http://localhost:{}/mobile/admin", port);
    info!("🔌 WebSocket: ws://localhost:{}/ws", port);
    info!("📊 Health Check: http://localhost:{}/api/health", port);
    info!("🚀 Mode: Standalone (No Node.js/Nginx dependencies)");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}