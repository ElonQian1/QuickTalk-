use axum::{
    extract::{State, WebSocketUpgrade, Multipart, Query, Path},
    http::StatusCode,
    response::{Json, Html, Response},
    routing::{get, post},
    Router,
};
use axum::extract::ws::{WebSocket, Message as WsMessage};
use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, Row};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing::{info, warn, error, debug};
use futures_util::{sink::SinkExt, stream::StreamExt};
use std::path::PathBuf;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use tokio::sync::broadcast;

// WebSocket 连接管理
type WebSocketConnections = Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub ws_connections: WebSocketConnections,
    pub message_sender: broadcast::Sender<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Shop {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub api_key: String,
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String, // 'customer' or 'agent'
    pub content: String,
    pub message_type: String, // 'text', 'image', 'file'
    pub timestamp: DateTime<Utc>,
    pub shop_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String, // 'active', 'closed', 'pending'
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
}

// WebSocket 消息类型
#[derive(Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub msg_type: String, // 'join', 'leave', 'message', 'typing', 'status'
    pub conversation_id: Option<String>,
    pub sender_id: Option<String>,
    pub content: Option<String>,
    pub timestamp: DateTime<Utc>,
}

// API 请求/响应类型
#[derive(Serialize, Deserialize)]
pub struct CreateMessageRequest {
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub content: String,
    pub message_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct CreateConversationRequest {
    pub shop_id: String,
    pub customer_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

// 主页路由 - 纯静态HTML文件 (DDD: Presentation Layer)
pub async fn serve_index() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/index.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Customer Service</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>🦀 QuickTalk Customer Service - Pure Rust Edition</h1>
    <p>Welcome to QuickTalk - 纯Rust客服系统</p>
    <p><a href="/admin">管理后台</a> | <a href="/api/health">系统状态</a></p>
    <p>服务器只允许Rust程序 - 这是完全纯Rust实现的客服系统</p>
</body>
</html>
        "#.to_string())
    }
}

// 管理后台路由
pub async fn serve_admin() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-mobile.html").await {
        Html(content)
    } else if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-new.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Admin</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>🦀 QuickTalk Admin Panel - Pure Rust</h1>
    <p>管理界面 - 纯Rust客服系统</p>
    <div id="app">
        <p><a href="/api/health">健康检查</a></p>
        <p><a href="/api/shops">商店列表</a></p>
        <p><a href="/api/conversations">对话列表</a></p>
        <p><a href="/api/files">文件列表</a></p>
    </div>
</body>
</html>
        "#.to_string())
    }
}

// 移动端管理后台
pub async fn serve_mobile_admin() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../static/mobile/admin.html").await {
        Html(content)
    } else {
        serve_admin().await
    }
}

// WebSocket 处理 - 完全独立的实现
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
    
    info!("New WebSocket connection established: {}", connection_id);
    
    // 发送欢迎消息
    let welcome_msg = serde_json::json!({
        "type": "welcome",
        "message": "Connected to QuickTalk Pure Rust Server",
        "connection_id": connection_id,
        "timestamp": Utc::now()
    });
    
    if sender.send(WsMessage::Text(welcome_msg.to_string())).await.is_err() {
        error!("Failed to send welcome message");
        return;
    }
    
    // 创建任务来处理广播消息
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
    
    // 处理接收到的消息
    let mut recv_task = {
        let state = state.clone();
        let connection_id = connection_id.clone();
        
        tokio::spawn(async move {
            while let Some(msg) = receiver.next().await {
                match msg {
                    Ok(WsMessage::Text(text)) => {
                        info!("Received WebSocket message from {}: {}", connection_id, text);
                        
                        // 处理消息
                        if let Err(e) = handle_websocket_message(&state, &text, &connection_id).await {
                            warn!("Failed to handle WebSocket message: {}", e);
                        }
                    }
                    Ok(WsMessage::Close(_)) => {
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
        })
    };
    
    // 等待任何一个任务完成
    tokio::select! {
        _ = (&mut send_task) => {
            recv_task.abort();
        },
        _ = (&mut recv_task) => {
            send_task.abort();
        },
    }
    
    info!("WebSocket connection ended: {}", connection_id);
}

// 处理WebSocket消息
async fn handle_websocket_message(
    state: &AppState,
    message: &str,
    connection_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 解析消息
    let ws_message: WebSocketMessage = serde_json::from_str(message)?;
    
    match ws_message.msg_type.as_str() {
        "join" => {
            if let Some(conversation_id) = &ws_message.conversation_id {
                info!("Connection {} joined conversation {}", connection_id, conversation_id);
                
                // 广播加入消息
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
                
                // 保存消息到数据库
                let message_id = Uuid::new_v4().to_string();
                let result = sqlx::query(
                    "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                )
                .bind(&message_id)
                .bind(conversation_id)
                .bind(sender_id)
                .bind("customer") // 默认为客户
                .bind(content)
                .bind("text")
                .bind(Utc::now())
                .execute(&state.db)
                .await;
                
                if let Err(e) = result {
                    warn!("Failed to save message to database: {}", e);
                } else {
                    info!("Message saved: {} in conversation {}", message_id, conversation_id);
                    
                    // 广播消息
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
                // 广播打字状态
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
            debug!("Unknown WebSocket message type: {}", ws_message.msg_type);
        }
    }
    
    Ok(())
}

// API Routes
pub async fn health_check() -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "server": "pure_rust",
            "version": "2.0.0",
            "status": "running",
            "features": ["websocket", "file_upload", "database", "admin_panel"],
            "timestamp": Utc::now()
        })),
        message: "Pure Rust QuickTalk server is running".to_string(),
    })
}

// 商店管理
pub async fn get_shops(State(state): State<Arc<AppState>>) -> Result<Json<ApiResponse<Vec<Shop>>>, StatusCode> {
    match sqlx::query("SELECT id, name, domain, api_key, status, created_at FROM shops ORDER BY created_at DESC")
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
                    created_at: row.get("created_at"),
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

pub async fn create_shop(
    State(state): State<Arc<AppState>>,
    Json(shop_data): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<Shop>>, StatusCode> {
    let shop_id = Uuid::new_v4().to_string();
    let api_key = Uuid::new_v4().to_string();
    
    let name = shop_data.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown Shop");
    let domain = shop_data.get("domain").and_then(|v| v.as_str()).unwrap_or("");
    
    match sqlx::query(
        "INSERT INTO shops (id, name, domain, api_key, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&shop_id)
    .bind(name)
    .bind(domain)
    .bind(&api_key)
    .bind("active")
    .bind(Utc::now())
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            let shop = Shop {
                id: shop_id,
                name: name.to_string(),
                domain: domain.to_string(),
                api_key,
                status: "active".to_string(),
                created_at: Some(Utc::now()),
            };
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(shop),
                message: "Shop created successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 对话管理
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
        Err(e) => {
            warn!("Database error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
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
        Err(e) => {
            warn!("Failed to create conversation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 消息管理
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
        Err(e) => {
            warn!("Database error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn create_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, StatusCode> {
    let message_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    
    match sqlx::query(
        "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&message_id)
    .bind(&request.conversation_id)
    .bind(&request.sender_id)
    .bind(&request.sender_type)
    .bind(&request.content)
    .bind(&request.message_type)
    .bind(now)
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            let message = Message {
                id: message_id,
                conversation_id: request.conversation_id.clone(),
                sender_id: request.sender_id,
                sender_type: request.sender_type,
                content: request.content,
                message_type: request.message_type,
                timestamp: now,
                shop_id: None,
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
                message: "Message created successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create message: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 管理员认证
pub async fn admin_login(
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    // 简单的硬编码认证 - 生产环境中应该使用数据库和密码哈希
    if request.username == "admin" && request.password == "admin123" {
        Ok(Json(ApiResponse {
            success: true,
            data: Some(serde_json::json!({
                "token": Uuid::new_v4().to_string(),
                "user": {
                    "id": "admin",
                    "username": "admin",
                    "role": "administrator"
                },
                "expires_at": Utc::now() + chrono::Duration::hours(24)
            })),
            message: "Login successful".to_string(),
        }))
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

// 文件上传处理 - 增强版
pub async fn upload_file(
    State(_state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let mut uploaded_files = Vec::new();
    
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        let _name = field.name().unwrap_or("file").to_string();
        let filename = field.file_name().unwrap_or("unknown").to_string();
        let content_type = field.content_type().unwrap_or("application/octet-stream").to_string();
        let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
        
        // 创建上传目录
        let upload_dir = PathBuf::from("../uploads");
        tokio::fs::create_dir_all(&upload_dir).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        // 生成唯一文件名
        let file_extension = filename.split('.').last().unwrap_or("bin");
        let unique_filename = format!("{}_{}.{}", Uuid::new_v4(), chrono::Utc::now().timestamp(), file_extension);
        let file_path = upload_dir.join(&unique_filename);
        
        // 保存文件
        tokio::fs::write(&file_path, &data).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        info!("File uploaded: {} -> {} ({}bytes)", filename, unique_filename, data.len());
        
        uploaded_files.push(serde_json::json!({
            "original_name": filename,
            "stored_name": unique_filename,
            "size": data.len(),
            "content_type": content_type,
            "url": format!("/uploads/{}", unique_filename),
            "upload_time": Utc::now()
        }));
    }
    
    if uploaded_files.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "files": uploaded_files,
            "count": uploaded_files.len()
        })),
        message: "Files uploaded successfully".to_string(),
    }))
}

// 获取上传文件列表
pub async fn list_uploaded_files() -> Result<Json<ApiResponse<Vec<serde_json::Value>>>, StatusCode> {
    let upload_dir = PathBuf::from("../uploads");
    
    if !upload_dir.exists() {
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(Vec::new()),
            message: "No uploads directory found".to_string(),
        }));
    }
    
    let mut files = Vec::new();
    let mut dir = tokio::fs::read_dir(upload_dir).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    while let Some(entry) = dir.next_entry().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        if let Ok(metadata) = entry.metadata().await {
            if metadata.is_file() {
                let filename = entry.file_name().to_string_lossy().to_string();
                files.push(serde_json::json!({
                    "name": filename,
                    "size": metadata.len(),
                    "url": format!("/uploads/{}", filename),
                    "modified": metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                }));
            }
        }
    }
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(files),
        message: "Files listed successfully".to_string(),
    }))
}

pub async fn create_app(db: SqlitePool) -> Router {
    // 初始化广播通道
    let (message_sender, _) = broadcast::channel(100);
    let ws_connections = Arc::new(Mutex::new(HashMap::new()));
    
    let state = Arc::new(AppState { 
        db,
        ws_connections,
        message_sender,
    });

    Router::new()
        // 主要页面路由
        .route("/", get(serve_index))
        .route("/admin", get(serve_admin))
        .route("/mobile/admin", get(serve_mobile_admin))
        
        // WebSocket
        .route("/ws", get(websocket_handler))
        
        // API 路由 - 健康检查
        .route("/api/health", get(health_check))
        
        // 商店管理 API
        .route("/api/shops", get(get_shops).post(create_shop))
        
        // 对话管理 API
        .route("/api/conversations", get(get_conversations).post(create_conversation))
        .route("/api/conversations/:id/messages", get(get_messages))
        
        // 消息管理 API
        .route("/api/messages", post(create_message))
        
        // 文件上传 API
        .route("/api/upload", post(upload_file))
        .route("/api/files", get(list_uploaded_files))
        
        // 管理员认证 API
        .route("/api/admin/login", post(admin_login))
        .route("/api/auth/login", post(admin_login))  // 前端期望的路径
        
        // 静态文件服务 - 纯静态文件架构 (DDD: Presentation Layer)
        .nest_service("/css", ServeDir::new("../presentation/static/css"))
        .nest_service("/js", ServeDir::new("../presentation/static/js"))
        .nest_service("/assets", ServeDir::new("../presentation/static/assets"))
        .nest_service("/static", ServeDir::new("../presentation/static"))
        .nest_service("/uploads", ServeDir::new("../uploads"))
        
        // CORS和追踪
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

// 数据库初始化
async fn initialize_database(db: &SqlitePool) -> Result<(), sqlx::Error> {
    info!("Initializing database schema...");
    
    // 创建商店表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS shops (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 创建客户表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            avatar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 创建对话表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            customer_id TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
        "#
    ).execute(db).await?;
    
    // 创建消息表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent')),
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            shop_id TEXT,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        )
        "#
    ).execute(db).await?;
    
    // 创建管理员表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS admins (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 创建索引以提高查询性能
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_shop_id ON conversations(shop_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)").execute(db).await?;
    
    info!("Database schema initialized successfully");
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();
    
    // 加载环境变量
    dotenv::dotenv().ok();
    
    info!("🦀 Starting QuickTalk Pure Rust Server...");
    
    // 连接数据库
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./quicktalk.sqlite".to_string());
    
    info!("Connecting to database: {}", database_url);
    let db = SqlitePool::connect(&database_url).await?;
    
    // 初始化数据库schema
    initialize_database(&db).await?;
    
    // 创建应用
    let app = create_app(db).await;
    
    // 启动服务器
    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let addr = format!("{}:{}", host, port);
    
    info!("🚀 QuickTalk Pure Rust Server starting on {}", addr);
    info!("📱 Main Interface: http://localhost:{}/", port);
    info!("🔧 Admin Panel: http://localhost:{}/admin", port);
    info!("📱 Mobile Admin: http://localhost:{}/mobile/admin", port);
    info!("🔌 WebSocket: ws://localhost:{}/ws", port);
    info!("📊 Health Check: http://localhost:{}/api/health", port);
    info!("📄 API Documentation: All endpoints available under /api/");
    info!("🎯 Features: Pure Rust, No Node.js dependency, Full WebSocket support");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}