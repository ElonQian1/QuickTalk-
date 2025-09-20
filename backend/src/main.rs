use axum::{
    extract::{State, WebSocketUpgrade, Multipart, Query, Path},
    http::StatusCode,
    response::{Json, Html, Response},
    routing::{get, post, put, delete},
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

#[derive(Serialize, Deserialize, Clone)]
pub struct Employee {
    pub id: String,
    pub shop_id: String,
    pub name: String,
    pub email: String,
    pub role: String, // 'admin', 'agent', 'viewer'
    pub status: String, // 'active', 'inactive', 'pending'
    pub created_at: DateTime<Utc>,
}

// 新增的员工管理相关结构体
#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub name: String,
    pub phone: Option<String>,
    pub avatar: Option<String>,
    pub role: String, // 'super_admin', 'admin', 'shop_owner', 'user'
    pub status: String, // 'active', 'inactive', 'banned'
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct EmployeeInvitation {
    pub id: String,
    pub shop_id: String,
    pub inviter_id: String,
    pub invitee_email: String,
    pub invitee_id: Option<String>,
    pub role: String,
    pub message: Option<String>,
    pub token: String,
    pub status: String, // 'pending', 'accepted', 'rejected', 'expired'
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize)]
pub struct InviteEmployeeRequest {
    pub email: String,
    pub role: String,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct SearchUsersRequest {
    pub keyword: String,
    pub exclude_shop_id: Option<String>, // 排除已经是此店铺员工的用户
}

#[derive(Serialize, Deserialize)]
pub struct AcceptInvitationRequest {
    pub token: String,
}

// WebSocket 消息类型
#[derive(Serialize, Deserialize)]
pub struct WebSocketMessage {
    #[serde(alias = "msg_type")]
    pub r#type: String, // 'join', 'leave', 'message', 'typing', 'status', 'auth'
    pub conversation_id: Option<String>,
    pub sender_id: Option<String>,
    pub content: Option<String>,
    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
    // 新增字段以支持认证
    pub session_id: Option<String>,
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
    // 优先尝试加载简单的管理后台页面，而不是完整的聊天系统
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-new.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Admin</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            margin: 0;
            padding: 20px;
            color: #2c3e50;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            padding: 40px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .title {
            font-size: 32px;
            color: #667eea;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 18px;
            color: #6c757d;
        }
        .nav-links {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 40px;
        }
        .nav-link {
            display: block;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 12px;
            text-align: center;
            font-weight: 600;
            transition: transform 0.3s ease;
        }
        .nav-link:hover {
            transform: translateY(-4px);
        }
        .api-list {
            margin-top: 40px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
        }
        .api-item {
            margin: 10px 0;
        }
        .api-item a {
            color: #667eea;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="title">🦀 QuickTalk Admin</h1>
            <p class="subtitle">管理界面 - 纯Rust客服系统</p>
        </div>
        
        <div class="nav-links">
            <a href="/mobile/login" class="nav-link">📱 移动端登录</a>
            <a href="/mobile/dashboard" class="nav-link">📊 移动端仪表板</a>
            <a href="/mobile/admin" class="nav-link">💬 移动端聊天</a>
            <a href="/" class="nav-link">👥 客户界面</a>
        </div>
        
        <div class="api-list">
            <h3>API 端点</h3>
            <div class="api-item"><a href="/api/health">🔍 健康检查</a></div>
            <div class="api-item"><a href="/api/shops">🏪 商店列表</a></div>
            <div class="api-item"><a href="/api/conversations">💬 对话列表</a></div>
            <div class="api-item"><a href="/api/files">📁 文件列表</a></div>
        </div>
    </div>
</body>
</html>
        "#.to_string())
    }
}

// 移动端管理后台 (聊天系统)
pub async fn serve_mobile_admin() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/admin-mobile.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Admin</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Admin</h1>
    <p>移动端聊天管理系统加载失败，请检查文件路径</p>
    <p><a href="/mobile/dashboard">返回移动端仪表板</a></p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
    }
}

// 移动端仪表板
pub async fn serve_mobile_dashboard() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/mobile-dashboard.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Dashboard</h1>
    <p>移动端仪表板加载失败，请检查文件路径</p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
    }
}

// 移动端登录页面
pub async fn serve_mobile_login() -> Html<String> {
    if let Ok(content) = tokio::fs::read_to_string("../presentation/static/mobile-login.html").await {
        Html(content)
    } else {
        Html(r#"
<!DOCTYPE html>
<html>
<head>
    <title>QuickTalk Mobile Login</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>📱 QuickTalk Mobile Login</h1>
    <p>移动端登录页面加载失败，请检查文件路径</p>
    <p><a href="/admin">返回管理后台</a></p>
</body>
</html>
        "#.to_string())
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
    
    match ws_message.r#type.as_str() {
        "auth" => {
            info!("Connection {} attempting authentication", connection_id);
            if let Some(session_id) = &ws_message.session_id {
                info!("Session ID: {}", session_id);
                // 这里可以验证会话ID的有效性
                // 目前只是记录日志
            }
        },
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
            debug!("Unknown WebSocket message type: {}", ws_message.r#type);
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

// 店铺状态管理函数
pub async fn approve_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE shops SET status = 'approved' WHERE id = ?")
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} approved successfully", shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Shop approved successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to approve shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn reject_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE shops SET status = 'rejected' WHERE id = ?")
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} rejected successfully", shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Shop rejected successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to reject shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn activate_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE shops SET status = 'active' WHERE id = ?")
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} activated successfully", shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Shop activated successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to activate shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn deactivate_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE shops SET status = 'inactive' WHERE id = ?")
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} deactivated successfully", shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Shop deactivated successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to deactivate shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE shops SET name = ?, domain = ? WHERE id = ?")
        .bind(&payload.name)
        .bind(&payload.domain)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} updated successfully", shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Shop updated successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to update shop: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateShopRequest {
    pub name: String,
    pub domain: String,
    pub plan: Option<String>,
}

#[derive(Deserialize)]
pub struct AddEmployeeRequest {
    pub email: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateEmployeeRequest {
    pub role: String,
}

// 员工管理
pub async fn get_employees(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<Employee>>>, StatusCode> {
    match sqlx::query("SELECT * FROM employees WHERE shop_id = ?")
        .bind(&shop_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let employees: Vec<Employee> = rows
                .iter()
                .map(|row| Employee {
                    id: row.get("id"),
                    shop_id: row.get("shop_id"),
                    name: row.get("name"),
                    email: row.get("email"),
                    role: row.get("role"),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                })
                .collect();
                
            info!("Retrieved {} employees for shop {}", employees.len(), shop_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(employees),
                message: "Employees retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get employees: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn add_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<AddEmployeeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let employee_id = Uuid::new_v4().to_string();
    
    match sqlx::query("INSERT INTO employees (id, shop_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&employee_id)
        .bind(&shop_id)
        .bind(&payload.email) // 使用email作为临时的name
        .bind(&payload.email)
        .bind(&payload.role)
        .bind("active") // 默认状态为active
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Employee {} added to shop {}", payload.email, shop_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(()),
                message: "Employee added successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to add employee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn remove_employee(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("DELETE FROM employees WHERE id = ? AND shop_id = ?")
        .bind(&employee_id)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee {} removed from shop {}", employee_id, shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Employee removed successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to remove employee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_employee_role(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
    Json(payload): Json<UpdateEmployeeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE employees SET role = ? WHERE id = ? AND shop_id = ?")
        .bind(&payload.role)
        .bind(&employee_id)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee {} role updated in shop {}", employee_id, shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Employee role updated successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to update employee role: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 新增员工邀请和管理功能

// 搜索用户
pub async fn search_users(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<User>>>, StatusCode> {
    let keyword = params.get("q").unwrap_or(&String::new()).clone();
    let exclude_shop_id = params.get("exclude_shop_id");

    if keyword.len() < 2 {
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(vec![]),
            message: "Search keyword too short".to_string(),
        }));
    }

    let mut query = String::from("SELECT * FROM users WHERE (username LIKE ? OR email LIKE ? OR name LIKE ?) AND role != 'super_admin' AND role != 'admin' AND status = 'active'");
    let mut binds = vec![
        format!("%{}%", keyword),
        format!("%{}%", keyword),
        format!("%{}%", keyword),
    ];

    // 排除已经是某店铺员工的用户
    if let Some(shop_id) = exclude_shop_id {
        query.push_str(" AND id NOT IN (SELECT user_id FROM employees WHERE shop_id = ? AND status = 'active')");
        binds.push(shop_id.clone());
    }

    query.push_str(" LIMIT 10");

    let mut sqlx_query = sqlx::query(&query);
    for bind in &binds {
        sqlx_query = sqlx_query.bind(bind);
    }

    match sqlx_query.fetch_all(&state.db).await {
        Ok(rows) => {
            let users: Vec<User> = rows
                .iter()
                .map(|row| User {
                    id: row.get("id"),
                    username: row.get("username"),
                    email: row.get("email"),
                    name: row.get("name"),
                    phone: row.try_get("phone").ok(),
                    avatar: row.try_get("avatar").ok(),
                    role: row.get("role"),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(users),
                message: "Users retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to search users: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取用户资料
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<ApiResponse<User>>, StatusCode> {
    match sqlx::query("SELECT * FROM users WHERE id = ? AND status = 'active'")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let user = User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                name: row.get("name"),
                phone: row.try_get("phone").ok(),
                avatar: row.try_get("avatar").ok(),
                role: row.get("role"),
                status: row.get("status"),
                created_at: row.get("created_at"),
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(user),
                message: "User profile retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get user profile: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

// 邀请员工
pub async fn invite_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<InviteEmployeeRequest>,
) -> Result<Json<ApiResponse<EmployeeInvitation>>, StatusCode> {
    // 生成邀请令牌
    let invitation_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::days(7); // 7天后过期

    // 查找被邀请的用户ID（如果已注册）
    let invitee_id = sqlx::query("SELECT id FROM users WHERE email = ? AND status = 'active'")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(|row| row.get::<String, _>("id"));

    // 检查是否已经是员工或有待处理的邀请
    if let Some(uid) = &invitee_id {
        let existing = sqlx::query("SELECT COUNT(*) as count FROM employees WHERE shop_id = ? AND user_id = ? AND status IN ('active', 'pending')")
            .bind(&shop_id)
            .bind(uid)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        let count: i64 = existing.get("count");
        if count > 0 {
            return Err(StatusCode::CONFLICT); // 已经是员工或有待处理邀请
        }
    }

    // 创建邀请记录
    match sqlx::query("INSERT INTO employee_invitations (id, shop_id, inviter_id, invitee_email, invitee_id, role, message, token, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)")
        .bind(&invitation_id)
        .bind(&shop_id)
        .bind("shop_owner_001") // TODO: 从JWT或session获取实际的邀请人ID
        .bind(&payload.email)
        .bind(&invitee_id)
        .bind(&payload.role)
        .bind(&payload.message)
        .bind(&token)
        .bind(&expires_at)
        .bind(Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            let invitation = EmployeeInvitation {
                id: invitation_id,
                shop_id: shop_id.clone(),
                inviter_id: "shop_owner_001".to_string(),
                invitee_email: payload.email.clone(),
                invitee_id,
                role: payload.role.clone(),
                message: payload.message.clone(),
                token: token.clone(),
                status: "pending".to_string(),
                expires_at,
                created_at: Utc::now(),
                responded_at: None,
            };

            info!("Employee invitation sent to {} for shop {}", payload.email, shop_id);
            
            // TODO: 发送邀请邮件
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(invitation),
                message: "Employee invitation sent successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create employee invitation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取店铺的邀请列表
pub async fn get_employee_invitations(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<EmployeeInvitation>>>, StatusCode> {
    match sqlx::query("SELECT * FROM employee_invitations WHERE shop_id = ? ORDER BY created_at DESC")
        .bind(&shop_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let invitations: Vec<EmployeeInvitation> = rows
                .iter()
                .map(|row| EmployeeInvitation {
                    id: row.get("id"),
                    shop_id: row.get("shop_id"),
                    inviter_id: row.get("inviter_id"),
                    invitee_email: row.get("invitee_email"),
                    invitee_id: row.try_get("invitee_id").ok(),
                    role: row.get("role"),
                    message: row.try_get("message").ok(),
                    token: row.get("token"),
                    status: row.get("status"),
                    expires_at: row.get("expires_at"),
                    created_at: row.get("created_at"),
                    responded_at: row.try_get("responded_at").ok(),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(invitations),
                message: "Employee invitations retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get employee invitations: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 接受邀请
pub async fn accept_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<ApiResponse<Employee>>, StatusCode> {
    // 查找邀请
    let invitation = match sqlx::query("SELECT * FROM employee_invitations WHERE token = ? AND status = 'pending' AND expires_at > ?")
        .bind(&token)
        .bind(Utc::now())
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => EmployeeInvitation {
            id: row.get("id"),
            shop_id: row.get("shop_id"),
            inviter_id: row.get("inviter_id"),
            invitee_email: row.get("invitee_email"),
            invitee_id: row.try_get("invitee_id").ok(),
            role: row.get("role"),
            message: row.try_get("message").ok(),
            token: row.get("token"),
            status: row.get("status"),
            expires_at: row.get("expires_at"),
            created_at: row.get("created_at"),
            responded_at: row.try_get("responded_at").ok(),
        },
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    // 确保用户已注册
    let user_id = if let Some(uid) = invitation.invitee_id {
        uid
    } else {
        return Err(StatusCode::BAD_REQUEST); // 用户需要先注册
    };

    // 创建员工记录
    let employee_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // 开始事务
    let mut tx = state.db.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 插入员工记录
    if let Err(_) = sqlx::query("INSERT INTO employees (id, shop_id, user_id, invited_by, role, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)")
        .bind(&employee_id)
        .bind(&invitation.shop_id)
        .bind(&user_id)
        .bind(&invitation.inviter_id)
        .bind(&invitation.role)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 更新邀请状态
    if let Err(_) = sqlx::query("UPDATE employee_invitations SET status = 'accepted', responded_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&invitation.id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 提交事务
    if tx.commit().await.is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 获取用户信息构建Employee响应
    let user = sqlx::query("SELECT name, email FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let employee = Employee {
        id: employee_id,
        shop_id: invitation.shop_id.clone(),
        name: user.get("name"),
        email: user.get("email"),
        role: invitation.role.clone(),
        status: "active".to_string(),
        created_at: now,
    };

    info!("Employee invitation accepted: {} joined shop {}", invitation.invitee_email, invitation.shop_id);

    Ok(Json(ApiResponse {
        success: true,
        data: Some(employee),
        message: "Invitation accepted successfully".to_string(),
    }))
}

// 拒绝邀请
pub async fn reject_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE employee_invitations SET status = 'rejected', responded_at = ? WHERE token = ? AND status = 'pending'")
        .bind(Utc::now())
        .bind(&token)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee invitation rejected: token {}", token);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Invitation rejected successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to reject invitation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 集成代码生成
#[derive(Deserialize)]
pub struct GenerateCodeRequest {
    pub platform: String, // "html", "react", "php", "python"
    pub customization: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct GenerateCodeResponse {
    pub platform: String,
    pub code: String,
    pub instructions: String,
}

pub async fn generate_integration_code(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<GenerateCodeRequest>,
) -> Result<Json<ApiResponse<GenerateCodeResponse>>, StatusCode> {
    // 获取店铺的API密钥
    let shop_api_key = match sqlx::query("SELECT api_key FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => row.get::<String, _>("api_key"),
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    let (code, instructions) = match payload.platform.as_str() {
        "html" => generate_html_integration(&shop_api_key, &shop_id, &payload.customization),
        "react" => generate_react_integration(&shop_api_key, &shop_id, &payload.customization),
        "php" => generate_php_integration(&shop_api_key, &shop_id, &payload.customization),
        "python" => generate_python_integration(&shop_api_key, &shop_id, &payload.customization),
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    info!("Generated {} integration code for shop {}", payload.platform, shop_id);
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(GenerateCodeResponse {
            platform: payload.platform,
            code,
            instructions,
        }),
        message: "Integration code generated successfully".to_string(),
    }))
}

fn generate_html_integration(api_key: &str, shop_id: &str, customization: &Option<HashMap<String, String>>) -> (String, String) {
    let widget_color = customization.as_ref()
        .and_then(|c| c.get("color"))
        .map(|s| s.as_str())
        .unwrap_or("#007bff");
    
    let position = customization.as_ref()
        .and_then(|c| c.get("position"))
        .map(|s| s.as_str())
        .unwrap_or("bottom-right");

    let code = format!(r#"<!-- QuickTalk Chat Widget -->
<div id="quicktalk-widget"></div>
<script>
(function() {{
    // Widget configuration
    const config = {{
        apiKey: '{}',
        shopId: '{}',
        serverUrl: 'ws://localhost:3030/ws',
        theme: {{
            primaryColor: '{}',
            position: '{}'
        }}
    }};

    // Create chat widget
    const widget = document.createElement('div');
    widget.id = 'quicktalk-chat-widget';
    widget.style.cssText = `
        position: fixed;
        {}: 20px;
        bottom: 20px;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        display: none;
        flex-direction: column;
    `;

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.innerHTML = '💬';
    toggleBtn.style.cssText = `
        position: fixed;
        {}: 20px;
        bottom: 20px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: {};
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        z-index: 10001;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;

    // WebSocket connection
    let ws = null;
    function connectWebSocket() {{
        ws = new WebSocket(config.serverUrl);
        ws.onopen = function() {{
            ws.send(JSON.stringify({{
                type: 'auth',
                apiKey: config.apiKey,
                shopId: config.shopId
            }}));
        }};
        ws.onmessage = function(event) {{
            const data = JSON.parse(event.data);
            // Handle incoming messages
            displayMessage(data);
        }};
    }}

    function displayMessage(message) {{
        // Add message to chat widget
        console.log('New message:', message);
    }}

    // Toggle widget visibility
    toggleBtn.onclick = function() {{
        if (widget.style.display === 'none') {{
            widget.style.display = 'flex';
            if (!ws) connectWebSocket();
        }} else {{
            widget.style.display = 'none';
        }}
    }};

    // Add to page
    document.body.appendChild(widget);
    document.body.appendChild(toggleBtn);
}})();
</script>"#, 
        api_key, 
        shop_id, 
        widget_color, 
        position,
        if position.contains("left") { "left" } else { "right" },
        if position.contains("left") { "left" } else { "right" },
        widget_color
    );

    let instructions = format!(r#"HTML集成说明：

1. 将上述代码复制并粘贴到您网站的HTML页面中，建议放在 </body> 标签之前
2. 确保您的网站允许WebSocket连接
3. 可以自定义以下配置：
   - color: 聊天按钮和主题颜色
   - position: 聊天按钮位置 (bottom-right, bottom-left)

注意事项：
- API密钥：{}
- 店铺ID：{}
- 服务器地址：ws://localhost:3030/ws

如需修改样式，请调整CSS部分的代码。"#, api_key, shop_id);

    (code, instructions)
}

fn generate_react_integration(api_key: &str, shop_id: &str, customization: &Option<HashMap<String, String>>) -> (String, String) {
    let widget_color = customization.as_ref()
        .and_then(|c| c.get("color"))
        .map(|s| s.as_str())
        .unwrap_or("#007bff");

    let code = format!(r#"import React, {{ useState, useEffect, useRef }} from 'react';

const QuickTalkWidget = () => {{
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const ws = useRef(null);

    const config = {{
        apiKey: '{}',
        shopId: '{}',
        serverUrl: 'ws://localhost:3030/ws',
        theme: {{
            primaryColor: '{}'
        }}
    }};

    useEffect(() => {{
        if (isOpen && !ws.current) {{
            connectWebSocket();
        }}
        return () => {{
            if (ws.current) {{
                ws.current.close();
            }}
        }};
    }}, [isOpen]);

    const connectWebSocket = () => {{
        ws.current = new WebSocket(config.serverUrl);
        
        ws.current.onopen = () => {{
            ws.current.send(JSON.stringify({{
                type: 'auth',
                apiKey: config.apiKey,
                shopId: config.shopId
            }}));
        }};

        ws.current.onmessage = (event) => {{
            const data = JSON.parse(event.data);
            setMessages(prev => [...prev, data]);
        }};
    }};

    const sendMessage = () => {{
        if (message.trim() && ws.current) {{
            ws.current.send(JSON.stringify({{
                type: 'message',
                content: message,
                shopId: config.shopId
            }}));
            setMessage('');
        }}
    }};

    return (
        <>
            {{/* Chat Toggle Button */}}
            <button
                onClick={{{{() => setIsOpen(!isOpen)}}}}
                style={{{{{{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: config.theme.primaryColor,
                    color: 'white',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    zIndex: 10001,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}}}}}
            >
                💬
            </button>

            {{/* Chat Widget */}}
            {{{{isOpen && (
                <div
                    style={{{{{{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        width: '350px',
                        height: '500px',
                        background: 'white',
                        borderRadius: '10px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        zIndex: 10000,
                        display: 'flex',
                        flexDirection: 'column'
                    }}}}}}
                >
                    {{/* Header */}}
                    <div
                        style={{{{{{
                            background: config.theme.primaryColor,
                            color: 'white',
                            padding: '15px',
                            borderTopLeftRadius: '10px',
                            borderTopRightRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}}}}}
                    >
                        <span>在线客服</span>
                        <button
                            onClick={{{{() => setIsOpen(false)}}}}
                            style={{{{{{
                                background: 'transparent',
                                color: 'white',
                                border: 'none',
                                fontSize: '18px',
                                cursor: 'pointer'
                            }}}}}}
                        >
                            ✕
                        </button>
                    </div>

                    {{/* Messages */}}
                    <div style={{{{{{ flex: 1, padding: '10px', overflowY: 'auto' }}}}}}>
                        {{{{messages.map((msg, index) => (
                            <div key={{{{index}}}} style={{{{{{ marginBottom: '10px' }}}}}}>
                                {{{{msg.content}}}}
                            </div>
                        ))}}}}
                    </div>

                    {{/* Input */}}
                    <div style={{{{{{ padding: '10px', borderTop: '1px solid #eee' }}}}}}>
                        <div style={{{{{{ display: 'flex' }}}}}}>
                            <input
                                type="text"
                                value={{{{message}}}}
                                onChange={{{{(e) => setMessage(e.target.value)}}}}
                                onKeyPress={{{{(e) => e.key === 'Enter' && sendMessage()}}}}
                                placeholder="输入消息..."
                                style={{{{{{
                                    flex: 1,
                                    padding: '10px',
                                    border: '1px solid #ddd',
                                    borderRadius: '5px',
                                    marginRight: '5px'
                                }}}}}}
                            />
                            <button
                                onClick={{{{sendMessage}}}}
                                style={{{{{{
                                    padding: '10px 15px',
                                    background: config.theme.primaryColor,
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer'
                                }}}}}}
                            >
                                发送
                            </button>
                        </div>
                    </div>
                </div>
            )}}}}
        </>
    );
}};

export default QuickTalkWidget;"#, api_key, shop_id, widget_color);

    let instructions = format!(r#"React集成说明：

1. 安装依赖（如果还没有）：
   npm install react

2. 将QuickTalkWidget组件复制到您的项目中

3. 在您的主组件中引入并使用：
   import QuickTalkWidget from './QuickTalkWidget';
   
   function App() {{
     return (
       <div>
         {{/* 您的其他组件 */}}
         <QuickTalkWidget />
       </div>
     );
   }}

配置信息：
- API密钥：{}
- 店铺ID：{}
- 服务器地址：ws://localhost:3030/ws

可以通过修改config对象来自定义主题颜色和其他设置。"#, api_key, shop_id);

    (code, instructions)
}

fn generate_php_integration(api_key: &str, shop_id: &str, _customization: &Option<HashMap<String, String>>) -> (String, String) {
    let code = format!(r#"<?php
/**
 * QuickTalk PHP集成类
 */
class QuickTalkAPI {{
    private $apiKey;
    private $shopId;
    private $serverUrl;

    public function __construct($apiKey = '{}', $shopId = '{}') {{
        $this->apiKey = $apiKey;
        $this->shopId = $shopId;
        $this->serverUrl = 'http://localhost:3030/api';
    }}

    /**
     * 发送消息
     */
    public function sendMessage($content, $customerId = null, $customerName = 'Guest') {{
        $data = array(
            'content' => $content,
            'shop_id' => $this->shopId,
            'customer_id' => $customerId ?: 'web_' . uniqid(),
            'customer_name' => $customerName,
            'type' => 'text'
        );

        return $this->makeRequest('/messages', 'POST', $data);
    }}

    /**
     * 获取对话列表
     */
    public function getConversations($status = 'active') {{
        $params = array(
            'shop_id' => $this->shopId,
            'status' => $status
        );

        return $this->makeRequest('/conversations?' . http_build_query($params), 'GET');
    }}

    /**
     * 获取对话消息
     */
    public function getMessages($conversationId) {{
        return $this->makeRequest("/conversations/$conversationId/messages", 'GET');
    }}

    /**
     * 创建客户
     */
    public function createCustomer($name, $email = null, $phone = null) {{
        $data = array(
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'shop_id' => $this->shopId
        );

        return $this->makeRequest('/customers', 'POST', $data);
    }}

    /**
     * 生成聊天小部件HTML
     */
    public function renderChatWidget($options = array()) {{
        $defaultOptions = array(
            'color' => '#007bff',
            'position' => 'bottom-right',
            'title' => '在线客服'
        );
        
        $options = array_merge($defaultOptions, $options);
        
        $html = '
        <div id="quicktalk-widget-php"></div>
        <script>
        (function() {{
            const config = {{
                apiKey: "' . $this->apiKey . '",
                shopId: "' . $this->shopId . '",
                serverUrl: "ws://localhost:3030/ws",
                theme: {{
                    primaryColor: "' . $options['color'] . '",
                    position: "' . $options['position'] . '",
                    title: "' . $options['title'] . '"
                }}
            }};
            
            // 创建聊天按钮
            const btn = document.createElement("button");
            btn.innerHTML = "💬";
            btn.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: ${{config.theme.primaryColor}};
                color: white;
                border: none;
                font-size: 24px;
                cursor: pointer;
                z-index: 10001;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            `;
            
            btn.onclick = function() {{
                // 打开聊天窗口的逻辑
                console.log("Opening chat with config:", config);
            }};
            
            document.body.appendChild(btn);
        }})();
        </script>';
        
        return $html;
    }}

    /**
     * 发送API请求
     */
    private function makeRequest($endpoint, $method = 'GET', $data = null) {{
        $url = $this->serverUrl . $endpoint;
        
        $options = array(
            'http' => array(
                'header' => array(
                    'Content-Type: application/json',
                    'X-API-Key: ' . $this->apiKey
                ),
                'method' => $method
            )
        );
        
        if ($data && in_array($method, array('POST', 'PUT'))) {{
            $options['http']['content'] = json_encode($data);
        }}
        
        $context = stream_context_create($options);
        $result = file_get_contents($url, false, $context);
        
        if ($result === FALSE) {{
            return array('success' => false, 'error' => 'Request failed');
        }}
        
        return json_decode($result, true);
    }}
}}

// 使用示例
$quickTalk = new QuickTalkAPI();

// 发送消息
$response = $quickTalk->sendMessage('Hello from PHP!', 'customer123', 'John Doe');

// 获取对话
$conversations = $quickTalk->getConversations();

// 渲染聊天小部件
echo $quickTalk->renderChatWidget(array(
    'color' => '#28a745',
    'title' => '联系我们'
));
?>"#, api_key, shop_id);

    let instructions = format!(r#"PHP集成说明：

1. 将QuickTalkAPI类保存为quicktalk.php文件

2. 在您的PHP应用中引入：
   require_once 'quicktalk.php';
   $quickTalk = new QuickTalkAPI();

3. 基本用法：
   - 发送消息：$quickTalk->sendMessage('消息内容', '客户ID', '客户姓名');
   - 获取对话：$quickTalk->getConversations();
   - 渲染聊天窗口：echo $quickTalk->renderChatWidget();

4. 自定义聊天窗口：
   echo $quickTalk->renderChatWidget(array(
       'color' => '#your-color',
       'title' => '您的标题'
   ));

配置信息：
- API密钥：{}
- 店铺ID：{}
- 服务器地址：http://localhost:3030/api

确保您的服务器可以访问QuickTalk API端点。"#, api_key, shop_id);

    (code, instructions)
}

fn generate_python_integration(api_key: &str, shop_id: &str, _customization: &Option<HashMap<String, String>>) -> (String, String) {
    let code = format!(r#""""
QuickTalk Python集成模块
"""
import json
import requests
import websocket
import threading
from typing import Optional, Dict, List

class QuickTalkAPI:
    def __init__(self, api_key: str = '{}', shop_id: str = '{}'):
        self.api_key = api_key
        self.shop_id = shop_id
        self.base_url = 'http://localhost:3030/api'
        self.ws_url = 'ws://localhost:3030/ws'
        self.ws = None
        
    def _make_request(self, endpoint: str, method: str = 'GET', data: Optional[Dict] = None) -> Dict:
        """发送HTTP请求"""
        url = f"{{{{self.base_url}}}}{{{{endpoint}}}}"
        headers = {{{{
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key
        }}}}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=data)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {{{{method}}}}")
                
            return response.json()
        except Exception as e:
            return {{{{'success': False, 'error': str(e)}}}}
    
    def send_message(self, content: str, customer_id: Optional[str] = None, 
                    customer_name: str = 'Guest') -> Dict:
        """发送消息"""
        data = {{{{
            'content': content,
            'shop_id': self.shop_id,
            'customer_id': customer_id or f'python_{{{{hash(content) % 10000}}}}',
            'customer_name': customer_name,
            'type': 'text'
        }}}}
        return self._make_request('/messages', 'POST', data)
    
    def get_conversations(self, status: str = 'active') -> Dict:
        """获取对话列表"""
        params = {{{{
            'shop_id': self.shop_id,
            'status': status
        }}}}
        return self._make_request('/conversations', 'GET', params)
    
    def get_messages(self, conversation_id: str) -> Dict:
        """获取对话消息"""
        return self._make_request(f'/conversations/{{{{conversation_id}}}}/messages')
    
    def create_customer(self, name: str, email: Optional[str] = None, 
                       phone: Optional[str] = None) -> Dict:
        """创建客户"""
        data = {{{{
            'name': name,
            'email': email,
            'phone': phone,
            'shop_id': self.shop_id
        }}}}
        return self._make_request('/customers', 'POST', data)
    
    def connect_websocket(self, on_message_callback=None):
        """连接WebSocket"""
        def on_open(ws):
            auth_message = {{{{
                'type': 'auth',
                'apiKey': self.api_key,
                'shopId': self.shop_id
            }}}}
            ws.send(json.dumps(auth_message))
            print("WebSocket连接已建立")
        
        def on_message(ws, message):
            data = json.loads(message)
            print(f"收到消息: {{{{data}}}}")
            if on_message_callback:
                on_message_callback(data)
        
        def on_error(ws, error):
            print(f"WebSocket错误: {{{{error}}}}")
        
        def on_close(ws, close_status_code, close_msg):
            print("WebSocket连接已关闭")
        
        self.ws = websocket.WebSocketApp(
            self.ws_url,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close
        )
        
        # 在新线程中运行WebSocket
        def run_ws():
            self.ws.run_forever()
        
        ws_thread = threading.Thread(target=run_ws)
        ws_thread.daemon = True
        ws_thread.start()
    
    def send_websocket_message(self, content: str, customer_id: str = 'python_client'):
        """通过WebSocket发送消息"""
        if self.ws:
            message = {{{{
                'type': 'message',
                'content': content,
                'shopId': self.shop_id,
                'customerId': customer_id
            }}}}
            self.ws.send(json.dumps(message))

# 使用示例
if __name__ == '__main__':
    # 初始化API客户端
    quicktalk = QuickTalkAPI()
    
    # 发送消息
    response = quicktalk.send_message('Hello from Python!', 'customer_123', 'Python User')
    print(f"发送消息响应: {{{{response}}}}")
    
    # 获取对话列表
    conversations = quicktalk.get_conversations()
    print(f"对话列表: {{{{conversations}}}}")
    
    # 创建客户
    customer = quicktalk.create_customer('张三', 'zhangsan@example.com', '13800138000')
    print(f"创建客户响应: {{{{customer}}}}")
    
    # 连接WebSocket并监听消息
    def handle_message(message):
        print(f"处理收到的消息: {{{{message}}}}")
    
    quicktalk.connect_websocket(handle_message)
    
    # 保持程序运行以监听WebSocket消息
    import time
    while True:
        time.sleep(1)

# Flask集成示例
"""
from flask import Flask, render_template_string

app = Flask(__name__)
quicktalk = QuickTalkAPI()

@app.route('/')
def index():
    # 生成聊天小部件HTML
    chat_widget = '''
    <div id="quicktalk-python-widget"></div>
    <script>
    // 连接WebSocket
    const ws = new WebSocket('ws://localhost:3030/ws');
    ws.onopen = function() {{{{
        ws.send(JSON.stringify({{{{
            type: 'auth',
            apiKey: 'API_KEY_PLACEHOLDER',
            shopId: 'SHOP_ID_PLACEHOLDER'
        }}}}));
    }}}};
    
    ws.onmessage = function(event) {{{{
        const data = JSON.parse(event.data);
        console.log('收到消息:', data);
    }}}};
    </script>
    '''.replace('API_KEY_PLACEHOLDER', quicktalk.api_key).replace('SHOP_ID_PLACEHOLDER', quicktalk.shop_id)
    
    return render_template_string('''
    <!DOCTYPE html>
    <html>
    <head><title>QuickTalk Python集成示例</title></head>
    <body>
        <h1>欢迎使用QuickTalk</h1>
        {{{{{{ chat_widget|safe }}}}}}
    </body>
    </html>
    ''', chat_widget=chat_widget)

if __name__ == '__main__':
    app.run(debug=True)
"""
"#, api_key, shop_id);

    let instructions = format!(r#"Python集成说明：

1. 安装依赖：
   pip install requests websocket-client

2. 保存代码为quicktalk.py文件

3. 基本用法：
   from quicktalk import QuickTalkAPI
   
   quicktalk = QuickTalkAPI()
   
   # 发送消息
   response = quicktalk.send_message('Hello!', 'customer123', 'John')
   
   # 获取对话
   conversations = quicktalk.get_conversations()
   
   # 连接WebSocket
   quicktalk.connect_websocket(your_message_handler)

4. Flask集成：
   参考代码中的Flask示例部分

5. Django集成：
   在views.py中导入QuickTalkAPI类并在视图中使用

配置信息：
- API密钥：{}
- 店铺ID：{}
- HTTP API地址：http://localhost:3030/api
- WebSocket地址：ws://localhost:3030/ws

特性：
- 支持HTTP API调用
- 支持WebSocket实时消息
- 异步消息处理
- 适合集成到各种Python框架"#, api_key, shop_id);

    (code, instructions)
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
        .route("/mobile/dashboard", get(serve_mobile_dashboard))
        .route("/mobile/login", get(serve_mobile_login))
        
        // WebSocket
        .route("/ws", get(websocket_handler))
        
        // API 路由 - 健康检查
        .route("/api/health", get(health_check))
        
        // 商店管理 API
        .route("/api/shops", get(get_shops).post(create_shop))
        .route("/api/shops/:id", put(update_shop))
        .route("/api/shops/:id/approve", post(approve_shop))
        .route("/api/shops/:id/reject", post(reject_shop))
        .route("/api/shops/:id/activate", post(activate_shop))
        .route("/api/shops/:id/deactivate", post(deactivate_shop))
        
        // 员工管理 API
        .route("/api/shops/:shop_id/employees", get(get_employees).post(add_employee))
        .route("/api/shops/:shop_id/employees/:employee_id", delete(remove_employee).put(update_employee_role))
        
        // 新增员工邀请和管理 API
        .route("/api/shops/:shop_id/invitations", get(get_employee_invitations).post(invite_employee))
        .route("/api/invitations/:token/accept", post(accept_invitation))
        .route("/api/invitations/:token/reject", post(reject_invitation))
        .route("/api/users/search", get(search_users))
        .route("/api/users/:user_id", get(get_user_profile))
        
        // 集成代码生成 API
        .route("/api/shops/:shop_id/generate-code", post(generate_integration_code))
        
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
    info!("� Mobile Dashboard: http://localhost:{}/mobile/dashboard", port);
    info!("🔐 Mobile Login: http://localhost:{}/mobile/login", port);
    info!("�🔌 WebSocket: ws://localhost:{}/ws", port);
    info!("📊 Health Check: http://localhost:{}/api/health", port);
    info!("📄 API Documentation: All endpoints available under /api/");
    info!("🎯 Features: Pure Rust, No Node.js dependency, Full WebSocket support");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}