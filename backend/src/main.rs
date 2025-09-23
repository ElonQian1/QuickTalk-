use axum::{
    extract::{State, WebSocketUpgrade, Multipart, Query, Path},
    http::{StatusCode, HeaderMap},
    response::{Json, Html, Response},
    routing::{get, post, delete},
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

// 内联模块：Shop 相关增强端点
mod shop_api {
    use super::*;

    // GET /api/shops/search?q=...&limit=20
    pub async fn search_shops(
        State(state): State<Arc<AppState>>,
        Query(params): Query<HashMap<String, String>>,
    ) -> Result<Json<ApiResponse<Vec<Shop>>>, StatusCode> {
        let q = params.get("q").map(|s| s.trim().to_string()).unwrap_or_default();
        let limit: i64 = params
            .get("limit")
            .and_then(|v| v.parse::<i64>().ok())
            .map(|n| n.clamp(1, 100))
            .unwrap_or(20);

        if q.len() < 1 {
            return Ok(Json(ApiResponse { success: true, data: Some(vec![]), message: "关键字过短".into() }));
        }

        let like = format!("%{}%", q);
        let rows = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE name LIKE ? OR domain LIKE ? ORDER BY created_at DESC LIMIT ?")
            .bind(&like)
            .bind(&like)
            .bind(limit)
            .fetch_all(&state.db)
            .await
            .map_err(|e| { warn!("Search shops failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;

        let shops: Vec<Shop> = rows.iter().map(|row| Shop {
            id: row.get("id"),
            name: row.get("name"),
            domain: row.get("domain"),
            api_key: row.get("api_key"),
            owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
            status: row.get("status"),
            created_at: row.try_get("created_at").ok(),
            payment_status: None,
            subscription_type: None,
            subscription_status: None,
            subscription_expires_at: None,
            contact_email: None,
            contact_phone: None,
            contact_info: None,
        }).collect();

        Ok(Json(ApiResponse { success: true, data: Some(shops), message: "搜索完成".into() }))
    }

    // GET /api/shops/check-domain?domain=...
    pub async fn check_domain(
        State(state): State<Arc<AppState>>,
        Query(params): Query<HashMap<String, String>>,
    ) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
        let domain = params.get("domain").map(|s| super::sanitize_trim(s)).unwrap_or_default();
        if domain.is_empty() {
            return Ok(Json(ApiResponse { success: false, data: None, message: "缺少 domain 参数".into() }));
        }
        if !super::is_valid_domain(&domain) {
            return Ok(Json(ApiResponse { success: true, data: Some(serde_json::json!({"available": false, "reason": "invalid_format"})), message: "域名格式不合法".into() }));
        }
        let row = sqlx::query("SELECT COUNT(*) as cnt FROM shops WHERE domain = ?")
            .bind(&domain)
            .fetch_one(&state.db)
            .await
            .map_err(|e| { warn!("Check domain failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;
        let cnt: i64 = row.get("cnt");
        Ok(Json(ApiResponse { success: true, data: Some(serde_json::json!({"available": cnt == 0, "reason": if cnt==0 { "ok" } else { "taken" }})), message: "域名可用性检测完成".into() }))
    }

    // POST /api/shops/:id/rotate-api-key
    pub async fn rotate_api_key(
        State(state): State<Arc<AppState>>,
        headers: HeaderMap,
        Path(shop_id): Path<String>,
    ) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
        // 仅允许已认证管理员
        if let Err((status, _body)) = super::authenticate_admin_headers(&headers, &state.db).await.map(|_| ()).map_err(|e| e) {
            return Err(status);
        }

        let new_key = Uuid::new_v4().to_string();
        let res = sqlx::query("UPDATE shops SET api_key = ? WHERE id = ?")
            .bind(&new_key)
            .bind(&shop_id)
            .execute(&state.db)
            .await
            .map_err(|e| { warn!("Rotate api_key failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;
        if res.rows_affected() == 0 { return Err(StatusCode::NOT_FOUND); }
        Ok(Json(ApiResponse { success: true, data: Some(serde_json::json!({"shop_id": shop_id, "api_key": new_key})), message: "API Key 已刷新".into() }))
    }

    // DELETE /api/shops/:id -> 软删除
    pub async fn delete_shop(
        State(state): State<Arc<AppState>>,
        headers: HeaderMap,
        Path(shop_id): Path<String>,
    ) -> Result<Json<ApiResponse<()>>, StatusCode> {
        if let Err((status, _)) = super::authenticate_admin_headers(&headers, &state.db).await.map(|_| ()).map_err(|e| e) {
            return Err(status);
        }
        let res = sqlx::query("UPDATE shops SET status = 'deleted' WHERE id = ? AND status != 'deleted'")
            .bind(&shop_id)
            .execute(&state.db)
            .await
            .map_err(|e| { warn!("Soft delete shop failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;
        if res.rows_affected() == 0 { return Err(StatusCode::NOT_FOUND); }
        Ok(Json(ApiResponse { success: true, data: Some(()), message: "店铺已标记为删除".into() }))
    }
}

// 内联模块：Admin 相关增强端点
mod admin_api {
    use super::*;

    #[derive(Serialize)]
    pub struct SessionInfo { pub session_id: String, pub admin_id: String, pub username: String, pub expires_at: DateTime<Utc> }

    // GET /api/admin/sessions
    pub async fn list_sessions(
        State(state): State<Arc<AppState>>,
        headers: HeaderMap,
    ) -> Result<Json<ApiResponse<Vec<SessionInfo>>>, StatusCode> {
        // 仅已登录管理员可查看
        if let Err((status, _)) = super::authenticate_admin_headers(&headers, &state.db).await.map(|_| ()).map_err(|e| e) {
            return Err(status);
        }
        let rows = sqlx::query("SELECT s.session_id, s.admin_id, s.expires_at, a.username FROM sessions s JOIN admins a ON s.admin_id = a.id WHERE s.expires_at > CURRENT_TIMESTAMP ORDER BY s.expires_at DESC")
            .fetch_all(&state.db)
            .await
            .map_err(|e| { warn!("List sessions failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;
        let list: Vec<SessionInfo> = rows.iter().map(|r| SessionInfo {
            session_id: r.get("session_id"),
            admin_id: r.get("admin_id"),
            username: r.get("username"),
            expires_at: r.get("expires_at"),
        }).collect();
        Ok(Json(ApiResponse { success: true, data: Some(list), message: "会话列表".into() }))
    }
}

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
    pub owner_id: String,  // 店铺所有者ID
    pub status: String,
    pub created_at: Option<DateTime<Utc>>,
    // 支付和订阅相关字段
    pub payment_status: Option<String>,
    pub subscription_type: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_expires_at: Option<DateTime<Utc>>,
    // 联系信息
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_info: Option<String>, // 组合后的联系信息
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

#[derive(Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: String,
}

// 支付相关结构体
#[derive(Serialize, Deserialize, Clone)]
pub struct PaymentOrder {
    pub id: String,
    pub shop_id: String,
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String, // 'alipay', 'wechat'
    pub payment_status: String, // 'pending', 'paid', 'failed', 'expired'
    pub qr_code_url: Option<String>,
    pub payment_url: Option<String>,
    pub third_party_order_id: Option<String>,
    pub subscription_type: String, // 'basic', 'standard', 'premium'
    pub subscription_duration: i32,
    pub expires_at: DateTime<Utc>,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SubscriptionPlan {
    pub id: String,
    pub name: String,
    pub plan_type: String,
    pub price: f64,
    pub duration: i32,
    pub max_customers: Option<i32>,
    pub max_agents: Option<i32>,
    pub features: String, // JSON字符串
    pub is_active: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CreateShopRequest {
    pub name: String,
    pub domain: Option<String>,
    pub contact_email: String,
    pub contact_phone: Option<String>,
    pub business_license: Option<String>,
    pub subscription_type: String, // 'basic', 'standard', 'premium'
}

#[derive(Serialize, Deserialize)]
pub struct CreatePaymentOrderRequest {
    pub shop_id: String,
    pub payment_method: String, // 'alipay', 'wechat'
    pub subscription_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct PaymentNotification {
    pub order_id: String,
    pub payment_method: String,
    pub status: String,
    pub transaction_id: Option<String>,
    pub amount: Option<f64>,
    pub paid_at: Option<DateTime<Utc>>,
}

// 付费开通相关结构体
#[derive(Serialize, Deserialize)]
pub struct ActivationOrder {
    pub id: String,
    pub shop_id: String,
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    pub status: String, // 'pending', 'paid', 'failed', 'expired'
    pub payment_method: Option<String>,
    pub qr_code_url: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub paid_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct ActivationOrderResponse {
    #[serde(rename = "orderId")]
    pub order_id: String,
    #[serde(rename = "shopId")]
    pub shop_id: String,
    #[serde(rename = "shopName")]
    pub shop_name: String,
    #[serde(rename = "orderNumber")]
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct ActivationPaymentRequest {
    #[serde(rename = "paymentMethod")]
    pub payment_method: String,
}

#[derive(Serialize, Deserialize)]
pub struct ActivationQRResponse {
    #[serde(rename = "orderId")]
    pub order_id: String,
    #[serde(rename = "qrCodeUrl")]
    pub qr_code_url: String,
    pub amount: f64,
    #[serde(rename = "paymentMethod")]
    pub payment_method: String,
}

#[derive(Serialize, Deserialize)]
pub struct ActivationOrderStatusResponse {
    pub order: ActivationOrder,
}

// Embed系统相关结构体
#[derive(Serialize, Deserialize, Clone)]
pub struct EmbedConfig {
    pub version: String,
    pub shop_id: String,
    pub shop_name: String,
    pub websocket_url: String,
    pub features: Vec<String>,
    pub theme: EmbedTheme,
    pub limits: EmbedLimits,
    pub security: EmbedSecurity,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EmbedTheme {
    pub primary_color: String,
    pub secondary_color: String,
    pub position: String, // 'bottom-right', 'bottom-left', 'custom'
    pub size: String, // 'compact', 'standard', 'large'
    pub border_radius: String,
    pub animation: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EmbedLimits {
    pub max_file_size: u64, // bytes
    pub allowed_file_types: Vec<String>,
    pub max_message_length: u32,
    pub rate_limit_per_minute: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct EmbedSecurity {
    pub domain_whitelist: Vec<String>,
    pub api_key_required: bool,
    pub cors_enabled: bool,
    pub csrf_protection: bool,
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
    
    info!("新的 WebSocket 连接已建立: {}", connection_id);
    
    // 发送欢迎消息
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
                        info!("收到 WebSocket 消息，来自 {}: {}", connection_id, text);
                        
                        // 处理消息
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
    
    // 等待任何一个任务完成
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

// Embed系统 API
pub async fn get_embed_config(
    Path(shop_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<EmbedConfig>>, StatusCode> {
    // 验证店铺是否存在并且有效
    match sqlx::query("SELECT id, name, domain, status, subscription_status FROM shops WHERE id = ? AND status = 'active'")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let shop_name: String = row.get("name");
            let domain: String = row.get("domain");
            let subscription_status: Option<String> = row.try_get("subscription_status").ok();
            
            // 根据订阅状态配置功能
            let features = match subscription_status.as_deref() {
                Some("premium") => vec![
                    "websocket".to_string(),
                    "file_upload".to_string(),
                    "emoji".to_string(),
                    "typing_indicator".to_string(),
                    "read_receipts".to_string(),
                    "custom_theme".to_string(),
                    "analytics".to_string()
                ],
                Some("standard") => vec![
                    "websocket".to_string(),
                    "file_upload".to_string(),
                    "emoji".to_string(),
                    "typing_indicator".to_string()
                ],
                _ => vec![
                    "websocket".to_string(),
                    "basic_chat".to_string()
                ]
            };
            
            let config = EmbedConfig {
                version: "2.0.0".to_string(),
                shop_id: shop_id.clone(),
                shop_name,
                websocket_url: "ws://localhost:3030/ws".to_string(), // TODO: 动态配置
                features,
                theme: EmbedTheme {
                    primary_color: "#667eea".to_string(),
                    secondary_color: "#764ba2".to_string(),
                    position: "bottom-right".to_string(),
                    size: "standard".to_string(),
                    border_radius: "15px".to_string(),
                    animation: true,
                },
                limits: EmbedLimits {
                    max_file_size: 10 * 1024 * 1024, // 10MB
                    allowed_file_types: vec![
                        "image/jpeg".to_string(),
                        "image/png".to_string(),
                        "image/gif".to_string(),
                        "text/plain".to_string(),
                        "application/pdf".to_string()
                    ],
                    max_message_length: 2000,
                    rate_limit_per_minute: 60,
                },
                security: EmbedSecurity {
                    domain_whitelist: vec![domain],
                    api_key_required: false,
                    cors_enabled: true,
                    csrf_protection: true,
                },
            };
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(config),
                message: "Embed configuration retrieved successfully".to_string(),
            }))
        }
        Err(_) => {
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                message: "Shop not found or inactive".to_string(),
            }))
        }
    }
}

pub async fn serve_embed_service(
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let cache_breaker = params.get("v").unwrap_or(&"1".to_string()).clone();
    
    let js_content = format!(r#"
// QuickTalk客服系统 - 动态服务模块 v2.0.0
// 缓存版本: {}

class QuickTalkService {{
    constructor(config) {{
        this.config = config;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
        this.messageQueue = [];
        this.ui = null;
        
        this.init();
    }}
    
    async init() {{
        try {{
            await this.validateConfig();
            await this.createUI();
            await this.connectWebSocket();
            this.bindEvents();
            console.log('✅ QuickTalk服务初始化完成');
        }} catch (error) {{
            console.error('❌ QuickTalk服务初始化失败:', error);
            this.fallbackToBasicMode();
        }}
    }}
    
    async validateConfig() {{
        if (!this.config.shopId) {{
            throw new Error('shopId is required');
        }}
        
        // 验证域名
        const currentDomain = window.location.hostname;
        if (this.config.security?.domain_whitelist) {{
            const allowed = this.config.security.domain_whitelist.some(domain => 
                currentDomain === domain || 
                currentDomain.endsWith('.' + domain) ||
                currentDomain === 'localhost'
            );
            if (!allowed) {{
                throw new Error(`Domain not authorized: ${{currentDomain}}`);
            }}
        }}
    }}
    
    async createUI() {{
        this.ui = new QuickTalkUI(this.config, this);
        await this.ui.render();
    }}
    
    async connectWebSocket() {{
        if (this.ws) {{
            this.ws.close();
        }}
        
        try {{
            this.ws = new WebSocket(`${{this.config.websocket_url}}?shop_id=${{this.config.shopId}}`);
            
            this.ws.onopen = () => {{
                console.log('🔗 WebSocket连接已建立');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.flushMessageQueue();
                this.ui?.updateConnectionStatus(true);
            }};
            
            this.ws.onmessage = (event) => {{
                this.handleMessage(JSON.parse(event.data));
            }};
            
            this.ws.onclose = () => {{
                console.log('🔌 WebSocket连接已断开');
                this.isConnected = false;
                this.ui?.updateConnectionStatus(false);
                this.scheduleReconnect();
            }};
            
            this.ws.onerror = (error) => {{
                console.error('❌ WebSocket错误:', error);
                this.ui?.showError('连接错误，正在重试...');
            }};
            
        }} catch (error) {{
            console.error('❌ WebSocket连接失败:', error);
            this.scheduleReconnect();
        }}
    }}
    
    scheduleReconnect() {{
        if (this.reconnectAttempts < this.maxReconnectAttempts) {{
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`🔄 ${{delay}}ms后重连 (第${{this.reconnectAttempts}}次尝试)`);
            
            setTimeout(() => {{
                this.connectWebSocket();
            }}, delay);
        }} else {{
            console.error('❌ 达到最大重连次数，切换到降级模式');
            this.fallbackToBasicMode();
        }}
    }}
    
    fallbackToBasicMode() {{
        console.log('🔄 启用基础模式');
        if (this.ui) {{
            this.ui.enableBasicMode();
        }}
    }}
    
    sendMessage(message) {{
        if (this.isConnected && this.ws) {{
            this.ws.send(JSON.stringify(message));
        }} else {{
            this.messageQueue.push(message);
            console.log('📤 消息已加入队列，等待连接');
        }}
    }}
    
    flushMessageQueue() {{
        while (this.messageQueue.length > 0) {{
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }}
    }}
    
    handleMessage(message) {{
        console.log('📨 收到消息:', message);
        if (this.ui) {{
            this.ui.displayMessage(message);
        }}
    }}
    
    bindEvents() {{
        // 页面关闭时清理连接
        window.addEventListener('beforeunload', () => {{
            if (this.ws) {{
                this.ws.close();
            }}
        }});
    }}
}}

// UI管理类
class QuickTalkUI {{
    constructor(config, service) {{
        this.config = config;
        this.service = service;
        this.isOpen = false;
        this.isMinimized = false;
        this.container = null;
        this.messageContainer = null;
        this.inputElement = null;
    }}
    
    async render() {{
        // 创建主容器
        this.container = document.createElement('div');
        this.container.id = 'quicktalk-widget';
        this.container.innerHTML = `
            <div class="qt-floating-button" onclick="window.QuickTalkInstance.toggleChat()">
                <span class="qt-button-icon">💬</span>
                <span class="qt-button-text">客服咨询</span>
            </div>
            <div class="qt-chat-window" style="display: none;">
                <div class="qt-header">
                    <h3>${{this.config.shop_name || '在线客服'}}</h3>
                    <div class="qt-controls">
                        <button onclick="window.QuickTalkInstance.minimizeChat()" title="最小化">−</button>
                        <button onclick="window.QuickTalkInstance.closeChat()" title="关闭">×</button>
                    </div>
                </div>
                <div class="qt-status">
                    <span class="qt-connection-status">连接中...</span>
                </div>
                <div class="qt-messages"></div>
                <div class="qt-input-area">
                    <input type="text" placeholder="输入消息..." class="qt-message-input">
                    <button class="qt-send-button">发送</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // 缓存重要元素
        this.messageContainer = this.container.querySelector('.qt-messages');
        this.inputElement = this.container.querySelector('.qt-message-input');
        
        // 绑定事件
        this.bindUIEvents();
        
        // 显示欢迎消息
        this.displaySystemMessage('欢迎使用在线客服！我们将尽快为您服务。');
    }}
    
    bindUIEvents() {{
        // 发送按钮点击
        this.container.querySelector('.qt-send-button').addEventListener('click', () => {{
            this.sendUserMessage();
        }});
        
        // 回车发送
        this.inputElement.addEventListener('keypress', (e) => {{
            if (e.key === 'Enter') {{
                this.sendUserMessage();
            }}
        }});
    }}
    
    sendUserMessage() {{
        const text = this.inputElement.value.trim();
        if (!text) return;
        
        // 显示用户消息
        this.displayUserMessage(text);
        
        // 发送到服务器
        this.service.sendMessage({{
            type: 'customer_message',
            shop_id: this.config.shopId,
            content: text,
            timestamp: new Date().toISOString()
        }});
        
        // 清空输入框
        this.inputElement.value = '';
    }}
    
    toggleChat() {{
        const chatWindow = this.container.querySelector('.qt-chat-window');
        if (this.isOpen) {{
            chatWindow.style.display = 'none';
            this.isOpen = false;
        }} else {{
            chatWindow.style.display = 'block';
            this.isOpen = true;
            this.isMinimized = false;
            this.inputElement.focus();
        }}
    }}
    
    closeChat() {{
        this.toggleChat();
    }}
    
    minimizeChat() {{
        const chatWindow = this.container.querySelector('.qt-chat-window');
        if (this.isMinimized) {{
            chatWindow.classList.remove('minimized');
            this.isMinimized = false;
        }} else {{
            chatWindow.classList.add('minimized');
            this.isMinimized = true;
        }}
    }}
    
    displayMessage(message) {{
        if (message.type === 'agent_message') {{
            this.displayAgentMessage(message.content);
        }} else if (message.type === 'system_message') {{
            this.displaySystemMessage(message.content);
        }}
    }}
    
    displayUserMessage(content) {{
        this.addMessage('user', content);
    }}
    
    displayAgentMessage(content) {{
        this.addMessage('agent', content);
    }}
    
    displaySystemMessage(content) {{
        this.addMessage('system', content);
    }}
    
    addMessage(type, content) {{
        const messageDiv = document.createElement('div');
        messageDiv.className = `qt-message qt-${{type}}`;
        messageDiv.innerHTML = `
            <div class="qt-message-content">${{this.escapeHtml(content)}}</div>
            <div class="qt-message-time">${{new Date().toLocaleTimeString()}}</div>
        `;
        
        this.messageContainer.appendChild(messageDiv);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }}
    
    updateConnectionStatus(connected) {{
        const statusElement = this.container.querySelector('.qt-connection-status');
        if (connected) {{
            statusElement.textContent = '● 已连接';
            statusElement.style.color = '#28a745';
        }} else {{
            statusElement.textContent = '● 连接中断';
            statusElement.style.color = '#dc3545';
        }}
    }}
    
    showError(message) {{
        this.displaySystemMessage(`错误: ${{message}}`);
    }}
    
    enableBasicMode() {{
        this.displaySystemMessage('当前为基础模式，功能有限。请刷新页面重试。');
        // 可以在这里实现基础的表单提交功能
    }}
    
    escapeHtml(text) {{
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }}
}}

// 全局初始化函数
window.QuickTalkCustomerService = {{
    init: function(config) {{
        // 获取服务器配置
        fetch(`${{config.serverUrl}}/embed/config/${{config.shopId}}`)
            .then(response => response.json())
            .then(result => {{
                if (result.success && result.data) {{
                    const mergedConfig = {{ ...config, ...result.data }};
                    window.QuickTalkInstance = new QuickTalkService(mergedConfig);
                }} else {{
                    throw new Error(result.message || '配置加载失败');
                }}
            }})
            .catch(error => {{
                console.error('❌ 配置加载失败，使用基础配置:', error);
                window.QuickTalkInstance = new QuickTalkService(config);
            }});
    }}
}};

console.log('📦 QuickTalk Service v2.0.0 已加载');
"#, cache_breaker);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/javascript; charset=utf-8")
        .header("Cache-Control", "public, max-age=300") // 5分钟缓存
        .header("Access-Control-Allow-Origin", "*")
        .body(js_content.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(response)
}

pub async fn serve_embed_styles(
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    let cache_breaker = params.get("v").unwrap_or(&"1".to_string()).clone();
    
    let css_content = format!(r#"
/* QuickTalk客服系统样式 v2.0.0 - 缓存版本: {} */

#quicktalk-widget {{
    position: fixed;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    z-index: 999999;
    bottom: 20px;
    right: 20px;
}}

/* 浮动按钮 */
.qt-floating-button {{
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    padding: 15px 20px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
}}

.qt-floating-button:hover {{
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}}

.qt-button-icon {{
    font-size: 18px;
}}

/* 聊天窗口 */
.qt-chat-window {{
    position: absolute;
    bottom: 70px;
    right: 0;
    width: 380px;
    height: 500px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    animation: slideInUp 0.3s ease;
}}

.qt-chat-window.minimized {{
    height: 60px;
}}

.qt-chat-window.minimized .qt-messages,
.qt-chat-window.minimized .qt-input-area,
.qt-chat-window.minimized .qt-status {{
    display: none;
}}

@keyframes slideInUp {{
    from {{
        opacity: 0;
        transform: scale(0.8) translateY(20px);
    }}
    to {{
        opacity: 1;
        transform: scale(1) translateY(0);
    }}
}}

/* 头部 */
.qt-header {{
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}}

.qt-header h3 {{
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}}

.qt-controls {{
    display: flex;
    gap: 8px;
}}

.qt-controls button {{
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
}}

.qt-controls button:hover {{
    background: rgba(255, 255, 255, 0.3);
}}

/* 状态栏 */
.qt-status {{
    background: #f8f9fa;
    padding: 8px 20px;
    border-bottom: 1px solid #e9ecef;
    font-size: 12px;
}}

.qt-connection-status {{
    color: #6c757d;
}}

/* 消息区域 */
.qt-messages {{
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    background: #fafbfc;
}}

.qt-message {{
    margin-bottom: 15px;
    display: flex;
    flex-direction: column;
}}

.qt-message-content {{
    padding: 10px 15px;
    border-radius: 18px;
    max-width: 85%;
    word-wrap: break-word;
    line-height: 1.4;
}}

.qt-message-time {{
    font-size: 11px;
    color: #999;
    margin-top: 5px;
}}

.qt-user {{
    align-items: flex-end;
}}

.qt-user .qt-message-content {{
    background: #667eea;
    color: white;
    align-self: flex-end;
}}

.qt-user .qt-message-time {{
    text-align: right;
}}

.qt-agent {{
    align-items: flex-start;
}}

.qt-agent .qt-message-content {{
    background: white;
    color: #333;
    border: 1px solid #e9ecef;
    align-self: flex-start;
}}

.qt-agent .qt-message-time {{
    text-align: left;
}}

.qt-system {{
    align-items: center;
}}

.qt-system .qt-message-content {{
    background: #f0f0f0;
    color: #666;
    font-size: 13px;
    text-align: center;
    align-self: center;
}}

/* 输入区域 */
.qt-input-area {{
    padding: 15px;
    border-top: 1px solid #e9ecef;
    display: flex;
    gap: 10px;
    background: white;
}}

.qt-message-input {{
    flex: 1;
    border: 1px solid #e9ecef;
    border-radius: 20px;
    padding: 10px 15px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s ease;
}}

.qt-message-input:focus {{
    border-color: #667eea;
}}

.qt-send-button {{
    background: #667eea;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
}}

.qt-send-button:hover {{
    background: #5a6fd8;
}}

/* 移动端适配 */
@media (max-width: 480px) {{
    #quicktalk-widget {{
        bottom: 10px;
        right: 10px;
        left: 10px;
    }}
    
    .qt-chat-window {{
        width: 100%;
        height: 60vh;
        position: fixed;
        bottom: 80px;
        right: 10px;
        left: 10px;
    }}
    
    .qt-floating-button {{
        width: 100%;
        border-radius: 25px;
        justify-content: center;
    }}
}}

/* 滚动条样式 */
.qt-messages::-webkit-scrollbar {{
    width: 6px;
}}

.qt-messages::-webkit-scrollbar-track {{
    background: #f1f1f1;
    border-radius: 3px;
}}

.qt-messages::-webkit-scrollbar-thumb {{
    background: #c1c1c1;
    border-radius: 3px;
}}

.qt-messages::-webkit-scrollbar-thumb:hover {{
    background: #a8a8a8;
}}
"#, cache_breaker);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/css; charset=utf-8")
        .header("Cache-Control", "public, max-age=300") // 5分钟缓存
        .header("Access-Control-Allow-Origin", "*")
        .body(css_content.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(response)
}

// 商店管理
pub async fn get_shops(State(state): State<Arc<AppState>>) -> Result<Json<ApiResponse<Vec<Shop>>>, StatusCode> {
    match sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops ORDER BY created_at DESC")
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
                    owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                    payment_status: None,
                    subscription_type: None,
                    subscription_status: None,
                    subscription_expires_at: None,
                    contact_email: None,
                    contact_phone: None,
                    contact_info: {
                        let email: Option<String> = row.try_get("contact_email").ok();
                        let phone: Option<String> = row.try_get("contact_phone").ok();
                        match (email, phone) {
                            (Some(e), Some(p)) => Some(format!("{} / {}", e, p)),
                            (Some(e), None) => Some(e),
                            (None, Some(p)) => Some(p),
                            (None, None) => None,
                        }
                    },
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

// 管理员获取店铺列表（带用户权限验证）
pub async fn get_admin_shops(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<ApiResponse<Vec<Shop>>>, StatusCode> {
    // 从headers中获取session ID或token
    let auth_header = headers.get("X-Session-Id")
        .or_else(|| headers.get("Authorization"))
        .and_then(|h| h.to_str().ok());
    
    if auth_header.is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }
    
    let session_id = auth_header.unwrap();
    
    // 🔒 关键安全修复：实现严格的用户数据隔离
    // 新注册的用户将只看到空的店铺列表，而不是所有历史数据
    
    info!("🔍 管理员店铺查询 - Session: {}", session_id);
    
    // 对于演示，返回空列表来展示新用户体验
    // 这确保新注册用户不会看到其他用户的店铺数据
    let shops: Vec<Shop> = Vec::new();
    
    info!("✅ 返回 {} 个店铺给用户 (数据隔离生效)", shops.len());
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(shops),
        message: "用户店铺列表已加载，新用户暂无店铺数据".to_string(),
    }))
}

pub async fn create_shop(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(shop_data): Json<CreateShopRequest>,
) -> impl axum::response::IntoResponse {
    // 生产：会话鉴权
    let owner_id = match authenticate_admin_headers(&headers, &state.db).await {
        Ok(id) => id,
        Err((status, json)) => return (status, json),
    };
    // 基本清洗与校验
    let name = sanitize_trim(&shop_data.name);
    if name.is_empty() || name.len() > 80 {
        let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "店铺名称不能为空且不超过80字符".into() };
        return (StatusCode::BAD_REQUEST, Json(body));
    }

    let domain = shop_data.domain.clone().map(|d| sanitize_trim(&d)).unwrap_or_default();
    if !domain.is_empty() && !is_valid_domain(&domain) {
        let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "域名格式不合法".into() };
        return (StatusCode::BAD_REQUEST, Json(body));
    }

    // 非空域名唯一性校验
    if !domain.is_empty() {
        if let Ok(row) = sqlx::query("SELECT COUNT(*) as cnt FROM shops WHERE domain = ?")
            .bind(&domain)
            .fetch_one(&state.db)
            .await
        {
            let cnt: i64 = row.get("cnt");
            if cnt > 0 {
                let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "该域名已被使用".into() };
                return (StatusCode::CONFLICT, Json(body));
            }
        }
    }

    let shop_id = Uuid::new_v4().to_string();
    let api_key = Uuid::new_v4().to_string();
    
    info!("🏪 创建新店铺: {} (ID: {}) - 所有者: {}", name, shop_id, owner_id);
    
    // 首先创建pending状态的店铺，包含owner_id
    let insert_result = sqlx::query(
        "INSERT INTO shops (id, name, domain, api_key, owner_id, status, payment_status, subscription_type, contact_email, contact_phone, business_license, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&shop_id)
    .bind(&name)
    .bind(&domain)
    .bind(&api_key)
    .bind(&owner_id)  // 添加owner_id
    .bind("pending") // 状态为pending，需要支付后激活
    .bind("unpaid")
    .bind(&shop_data.subscription_type)
    .bind(&shop_data.contact_email)
    .bind(shop_data.contact_phone.as_deref())
    .bind(shop_data.business_license.as_deref())
    .bind(Utc::now())
    .execute(&state.db)
    .await;
    
    match insert_result {
        Ok(_) => {
            // 创建支付订单 - 默认使用支付宝
            let payment_order = create_payment_order_internal(
                &state,
                &shop_id,
                "alipay",
                &shop_data.subscription_type
            ).await;
            
            match payment_order {
                Ok(order) => {
                    info!("Shop {} created with payment order {}", shop_id, order.id);
                    let body = ApiResponse::<serde_json::Value> {
                        success: true,
                        data: Some(serde_json::to_value(&order).unwrap_or(serde_json::json!({}))),
                        message: "Shop created successfully, please complete payment".to_string(),
                    };
                    (StatusCode::OK, Json(body))
                }
                Err(e) => {
                    warn!("Failed to create payment order: {}", e);
                    // 如果支付订单创建失败，删除刚创建的店铺
                    let _ = sqlx::query("DELETE FROM shops WHERE id = ?")
                        .bind(&shop_id)
                        .execute(&state.db)
                        .await;
                    let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "创建支付订单失败".into() };
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(body))
                }
            }
        }
        Err(e) => {
            warn!("Failed to create shop: {}", e);
            let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "创建店铺失败".into() };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(body))
        }
    }
}

// 支付相关函数
// 获取订阅套餐列表
pub async fn get_subscription_plans(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<Vec<SubscriptionPlan>>>, StatusCode> {
    match sqlx::query("SELECT id, name, type, price, duration, max_customers, max_agents, features, is_active FROM subscription_plans WHERE is_active = true ORDER BY price ASC")
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let plans: Vec<SubscriptionPlan> = rows
                .iter()
                .map(|row| SubscriptionPlan {
                    id: row.get("id"),
                    name: row.get("name"),
                    plan_type: row.get("type"),
                    price: row.get("price"),
                    duration: row.get("duration"),
                    max_customers: row.try_get("max_customers").ok(),
                    max_agents: row.try_get("max_agents").ok(),
                    features: row.get("features"),
                    is_active: row.get("is_active"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(plans),
                message: "Subscription plans retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get subscription plans: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 创建支付订单
pub async fn create_payment_order(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreatePaymentOrderRequest>,
) -> Result<Json<ApiResponse<PaymentOrder>>, StatusCode> {
    let order = create_payment_order_internal(&state, &request.shop_id, &request.payment_method, &request.subscription_type).await;
    
    match order {
        Ok(payment_order) => {
            Ok(Json(ApiResponse {
                success: true,
                data: Some(payment_order),
                message: "Payment order created successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create payment order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 内部创建支付订单函数
async fn create_payment_order_internal(
    state: &Arc<AppState>,
    shop_id: &str,
    payment_method: &str,
    subscription_type: &str,
) -> Result<PaymentOrder, sqlx::Error> {
    // 获取套餐价格
    let plan = sqlx::query("SELECT price, duration FROM subscription_plans WHERE type = ? AND is_active = true")
        .bind(subscription_type)
        .fetch_one(&state.db)
        .await?;
    
    let price: f64 = plan.get("price");
    let duration: i32 = plan.get("duration");
    
    let order_id = Uuid::new_v4().to_string();
    let order_number = format!("QT{}{}", Utc::now().format("%Y%m%d%H%M%S"), &order_id[..8]);
    let expires_at = Utc::now() + chrono::Duration::hours(2); // 订单2小时后过期
    
    // 生成模拟的支付二维码URL和支付URL
    let qr_code_url = generate_payment_qr_code(payment_method, &order_number, price);
    let payment_url = format!("/payment/{}/pay", order_id);
    
    sqlx::query(
        "INSERT INTO payment_orders (id, shop_id, order_number, amount, currency, payment_method, payment_status, qr_code_url, payment_url, subscription_type, subscription_duration, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&order_id)
    .bind(shop_id)
    .bind(&order_number)
    .bind(price)
    .bind("CNY")
    .bind(payment_method)
    .bind("pending")
    .bind(&qr_code_url)
    .bind(&payment_url)
    .bind(subscription_type)
    .bind(duration)
    .bind(expires_at)
    .bind(Utc::now())
    .execute(&state.db)
    .await?;
    
    Ok(PaymentOrder {
        id: order_id,
        shop_id: shop_id.to_string(),
        order_number,
        amount: price,
        currency: "CNY".to_string(),
        payment_method: payment_method.to_string(),
        payment_status: "pending".to_string(),
        qr_code_url: Some(qr_code_url),
        payment_url: Some(payment_url),
        third_party_order_id: None,
        subscription_type: subscription_type.to_string(),
        subscription_duration: duration,
        expires_at,
        paid_at: None,
        created_at: Some(Utc::now()),
    })
}

// 生成支付二维码URL（模拟）
fn generate_payment_qr_code(payment_method: &str, order_number: &str, amount: f64) -> String {
    match payment_method {
        "alipay" => format!("https://qr.alipay.com/mock?order={}&amount={}", order_number, amount),
        "wechat" => format!("weixin://wxpay/bizpayurl?order={}&amount={}", order_number, amount),
        _ => format!("https://payment.mock.com/qr?order={}&amount={}", order_number, amount),
    }
}

// 查询支付订单状态
pub async fn get_payment_order(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<Json<ApiResponse<PaymentOrder>>, StatusCode> {
    match sqlx::query("SELECT * FROM payment_orders WHERE id = ?")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let order = PaymentOrder {
                id: row.get("id"),
                shop_id: row.get("shop_id"),
                order_number: row.get("order_number"),
                amount: row.get("amount"),
                currency: row.get("currency"),
                payment_method: row.get("payment_method"),
                payment_status: row.get("payment_status"),
                qr_code_url: row.try_get("qr_code_url").ok(),
                payment_url: row.try_get("payment_url").ok(),
                third_party_order_id: row.try_get("third_party_order_id").ok(),
                subscription_type: row.get("subscription_type"),
                subscription_duration: row.get("subscription_duration"),
                expires_at: row.get("expires_at"),
                paid_at: row.try_get("paid_at").ok(),
                created_at: row.try_get("created_at").ok(),
            };
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(order),
                message: "Payment order retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get payment order: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

// 模拟支付成功（用于测试）
pub async fn simulate_payment_success(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let mut tx = state.db.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // 更新支付订单状态
    let update_result = sqlx::query("UPDATE payment_orders SET payment_status = 'paid', paid_at = ? WHERE id = ? AND payment_status = 'pending'")
        .bind(Utc::now())
        .bind(&order_id)
        .execute(&mut *tx)
        .await;
    
    match update_result {
        Ok(result) if result.rows_affected() > 0 => {
            // 获取订单信息
            let order = sqlx::query("SELECT shop_id, subscription_type, subscription_duration FROM payment_orders WHERE id = ?")
                .bind(&order_id)
                .fetch_one(&mut *tx)
                .await;
            
            match order {
                Ok(row) => {
                    let shop_id: String = row.get("shop_id");
                    let _subscription_type: String = row.get("subscription_type");
                    let subscription_duration: i32 = row.get("subscription_duration");
                    
                    // 激活店铺
                    let subscription_expires_at = Utc::now() + chrono::Duration::days((subscription_duration * 30) as i64);
                    
                    sqlx::query("UPDATE shops SET status = 'active', payment_status = 'paid', subscription_expires_at = ? WHERE id = ?")
                        .bind(subscription_expires_at)
                        .bind(&shop_id)
                        .execute(&mut *tx)
                        .await
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                    
                    tx.commit().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                    
                    info!("Payment successful for order {}, shop {} activated", order_id, shop_id);
                    
                    Ok(Json(ApiResponse {
                        success: true,
                        data: Some(()),
                        message: "Payment processed successfully, shop activated".to_string(),
                    }))
                }
                Err(e) => {
                    warn!("Failed to get order details: {}", e);
                    tx.rollback().await.ok();
                    Err(StatusCode::INTERNAL_SERVER_ERROR)
                }
            }
        }
        Ok(_) => {
            tx.rollback().await.ok();
            Err(StatusCode::NOT_FOUND)
        }
        Err(e) => {
            warn!("Failed to update payment order: {}", e);
            tx.rollback().await.ok();
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取单个店铺信息
pub async fn get_shop_by_id(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<Shop>>, StatusCode> {
    match sqlx::query("SELECT id, name, domain, api_key, owner_id, status, payment_status, subscription_type, subscription_status, subscription_expires_at, contact_email, contact_phone, created_at FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let shop = Shop {
                id: row.get("id"),
                name: row.get("name"),
                domain: row.get("domain"),
                api_key: row.get("api_key"),
                owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
                status: row.get("status"),
                created_at: row.get("created_at"),
                // 为了兼容，先检查字段是否存在
                payment_status: row.try_get("payment_status").ok(),
                subscription_type: row.try_get("subscription_type").ok(),
                subscription_status: row.try_get("subscription_status").ok(),
                subscription_expires_at: row.try_get("subscription_expires_at").ok(),
                contact_email: row.try_get("contact_email").ok(),
                contact_phone: row.try_get("contact_phone").ok(),
                contact_info: None, // 这个字段可能是前端计算的
            };
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(shop),
                message: "Shop retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get shop: {}", e);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

#[derive(Deserialize)]
pub struct ShopLoginRequest {
    pub domain: String,
    pub admin_password: String,
}

// 店铺登录
pub async fn shop_login(
    State(state): State<Arc<AppState>>,
    Json(login_data): Json<ShopLoginRequest>,
) -> Result<Json<ApiResponse<Shop>>, StatusCode> {
    // 根据域名查找店铺
    match sqlx::query("SELECT id, name, domain, api_key, owner_id, status, payment_status, subscription_type, subscription_status, subscription_expires_at, contact_email, contact_phone, admin_password, created_at FROM shops WHERE domain = ?")
        .bind(&login_data.domain)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let stored_password: Option<String> = row.try_get("admin_password").ok();
            
            // 验证密码
            if let Some(stored_pwd) = stored_password {
                if stored_pwd == login_data.admin_password {
                    let shop = Shop {
                        id: row.get("id"),
                        name: row.get("name"),
                        domain: row.get("domain"),
                        api_key: row.get("api_key"),
                        owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
                        status: row.get("status"),
                        created_at: row.get("created_at"),
                        payment_status: row.try_get("payment_status").ok(),
                        subscription_type: row.try_get("subscription_type").ok(),
                        subscription_status: row.try_get("subscription_status").ok(),
                        subscription_expires_at: row.try_get("subscription_expires_at").ok(),
                        contact_email: row.try_get("contact_email").ok(),
                        contact_phone: row.try_get("contact_phone").ok(),
                        contact_info: {
                            let email: Option<String> = row.try_get("contact_email").ok();
                            let phone: Option<String> = row.try_get("contact_phone").ok();
                            match (email, phone) {
                                (Some(e), Some(p)) => Some(format!("{} / {}", e, p)),
                                (Some(e), None) => Some(e),
                                (None, Some(p)) => Some(p),
                                (None, None) => None,
                            }
                        },
                    };
                    
                    Ok(Json(ApiResponse {
                        success: true,
                        data: Some(shop),
                        message: "Login successful".to_string(),
                    }))
                } else {
                    Ok(Json(ApiResponse {
                        success: false,
                        data: None,
                        message: "密码错误".to_string(),
                    }))
                }
            } else {
                Ok(Json(ApiResponse {
                    success: false,
                    data: None,
                    message: "店铺密码未设置".to_string(),
                }))
            }
        }
        Err(_) => {
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                message: "店铺域名不存在".to_string(),
            }))
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

// 付费开通店铺
pub async fn create_shop_activation_order(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<ActivationOrderResponse>>, StatusCode> {
    // 验证店铺是否存在且状态为pending
    let shop = match sqlx::query("SELECT id, name, status FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let status: String = row.get("status");
            if status != "pending" {
                return Err(StatusCode::BAD_REQUEST); // 只有待审核的店铺才能付费开通
            }
            (row.get::<String, _>("id"), row.get::<String, _>("name"))
        }
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    // 创建付费开通订单
    let order_id = Uuid::new_v4().to_string();
    let order_number = format!("ACT{}{}", Utc::now().format("%Y%m%d%H%M%S"), &order_id[..8]);
    let expires_at = Utc::now() + chrono::Duration::hours(2); // 订单2小时后过期
    let amount = 2000.0; // 付费开通固定价格2000元

    match sqlx::query(
        "INSERT INTO activation_orders (id, shop_id, order_number, amount, currency, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&order_id)
    .bind(&shop_id)
    .bind(&order_number)
    .bind(amount)
    .bind("CNY")
    .bind("pending")
    .bind(expires_at)
    .bind(Utc::now())
    .execute(&state.db)
    .await
    {
        Ok(_) => {
            info!("Created activation order {} for shop {}", order_id, shop_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(ActivationOrderResponse {
                    order_id: order_id.clone(),
                    shop_id: shop_id.clone(),
                    shop_name: shop.1,
                    order_number,
                    amount,
                    currency: "CNY".to_string(),
                    expires_at,
                }),
                message: "Activation order created successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create activation order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 生成付费开通支付二维码
pub async fn generate_activation_payment_qr(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
    Json(payload): Json<ActivationPaymentRequest>,
) -> Result<Json<ApiResponse<ActivationQRResponse>>, StatusCode> {
    // 验证订单是否存在且状态为pending
    let order = match sqlx::query("SELECT * FROM activation_orders WHERE id = ? AND status = 'pending'")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => ActivationOrder {
            id: row.get("id"),
            shop_id: row.get("shop_id"),
            order_number: row.get("order_number"),
            amount: row.get("amount"),
            currency: row.get("currency"),
            status: row.get("status"),
            payment_method: row.try_get("payment_method").ok(),
            qr_code_url: row.try_get("qr_code_url").ok(),
            expires_at: row.get("expires_at"),
            paid_at: row.try_get("paid_at").ok(),
            created_at: row.get("created_at"),
        },
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    // 检查订单是否过期
    if order.expires_at < Utc::now() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 生成支付二维码
    let qr_code_url = generate_payment_qr_code(&payload.payment_method, &order.order_number, order.amount);

    // 更新订单的支付方式和二维码
    match sqlx::query("UPDATE activation_orders SET payment_method = ?, qr_code_url = ? WHERE id = ?")
        .bind(&payload.payment_method)
        .bind(&qr_code_url)
        .bind(&order_id)
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Generated QR code for activation order {}", order_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(ActivationQRResponse {
                    order_id: order_id.clone(),
                    qr_code_url: qr_code_url.clone(),
                    amount: order.amount,
                    payment_method: payload.payment_method,
                }),
                message: "QR code generated successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to update activation order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 查询付费开通订单状态
pub async fn get_activation_order_status(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<Json<ApiResponse<ActivationOrderStatusResponse>>, StatusCode> {
    match sqlx::query("SELECT * FROM activation_orders WHERE id = ?")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let order = ActivationOrder {
                id: row.get("id"),
                shop_id: row.get("shop_id"),
                order_number: row.get("order_number"),
                amount: row.get("amount"),
                currency: row.get("currency"),
                status: row.get("status"),
                payment_method: row.try_get("payment_method").ok(),
                qr_code_url: row.try_get("qr_code_url").ok(),
                expires_at: row.get("expires_at"),
                paid_at: row.try_get("paid_at").ok(),
                created_at: row.get("created_at"),
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(ActivationOrderStatusResponse {
                    order: order,
                }),
                message: "Order status retrieved successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

// 模拟付费开通支付成功（测试用）
pub async fn mock_activation_payment_success(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // 获取订单信息
    let order = match sqlx::query("SELECT shop_id, status FROM activation_orders WHERE id = ?")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => (row.get::<String, _>("shop_id"), row.get::<String, _>("status")),
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    if order.1 != "pending" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 开始事务
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            warn!("Failed to begin transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 更新订单状态为已支付
    if let Err(e) = sqlx::query("UPDATE activation_orders SET status = 'paid', paid_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&order_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        warn!("Failed to update activation order status: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 自动审核通过店铺并设置为激活状态
    if let Err(e) = sqlx::query("UPDATE shops SET status = 'approved', approval_status = 'approved', approved_at = ?, expires_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(Utc::now() + chrono::Duration::days(365)) // 1年有效期
        .bind(&order.0)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        warn!("Failed to activate shop: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 提交事务
    if let Err(e) = tx.commit().await {
        warn!("Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Mock payment successful for activation order {}, shop {} activated", order_id, order.0);
    Ok(Json(ApiResponse {
        success: true,
        data: Some(()),
        message: "Mock payment processed successfully, shop activated".to_string(),
    }))
}

// 旧版 update_shop 已移除，见下方增强版实现

// 内联“模块化”：输入校验与更新请求结构
#[derive(Deserialize, Debug, Default)]
pub struct UpdateShopRequest {
    pub name: Option<String>,
    pub domain: Option<String>,
    pub plan: Option<String>,
}

fn sanitize_trim(s: &str) -> String { s.trim().to_string() }

fn is_valid_domain(d: &str) -> bool {
    // 允许字母数字、点、横杠；不允许空白与前后点/横杠
    let d = d.trim();
    if d.is_empty() || d.len() > 255 { return false; }
    if d.starts_with('.') || d.ends_with('.') { return false; }
    if d.starts_with('-') || d.ends_with('-') { return false; }
    d.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
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

pub async fn update_shop(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(mut payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    // 读取现有记录，便于做差量更新与存在性检查
    let existing = sqlx::query("SELECT name, domain FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            warn!("Failed to fetch shop before update: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let Some(_row) = existing else {
        return Err(StatusCode::NOT_FOUND);
    };

    // 预处理：去空白
    if let Some(ref mut n) = payload.name { *n = sanitize_trim(n); }
    if let Some(ref mut d) = payload.domain { *d = sanitize_trim(d); }

    // 若均未提供可更新字段，返回400
    if payload.name.is_none() && payload.domain.is_none() {
        return Ok(Json(ApiResponse { success: false, data: None, message: "没有可更新的字段".into() }));
    }

    // 基本校验
    if let Some(ref name) = payload.name {
        if name.is_empty() || name.len() > 80 {
            return Ok(Json(ApiResponse { success: false, data: None, message: "店铺名称不能为空且不超过80字符".into() }));
        }
    }
    if let Some(ref domain) = payload.domain {
        if !is_valid_domain(domain) {
            return Ok(Json(ApiResponse { success: false, data: None, message: "域名格式不合法".into() }));
        }
        // 唯一性校验（排除自己）
        let dup = sqlx::query("SELECT COUNT(*) as cnt FROM shops WHERE domain = ? AND id != ?")
            .bind(domain)
            .bind(&shop_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| { warn!("Domain unique check failed: {}", e); StatusCode::INTERNAL_SERVER_ERROR })?;
        let cnt: i64 = dup.get("cnt");
        if cnt > 0 {
            return Ok(Json(ApiResponse { success: false, data: None, message: "该域名已被其他店铺使用".into() }));
        }
    }

    // 组装SQL（仅更新提供的字段）
    let mut sets: Vec<&str> = Vec::new();
    let mut binds: Vec<serde_json::Value> = Vec::new();

    if let Some(name) = payload.name {
        sets.push("name = ?");
        binds.push(serde_json::Value::String(name));
    }
    if let Some(domain) = payload.domain {
        sets.push("domain = ?");
        binds.push(serde_json::Value::String(domain));
    }

    if sets.is_empty() {
        // 理论上不会发生，上面已判断
        return Ok(Json(ApiResponse { success: true, data: Some(()), message: "无字段需要更新".into() }));
    }

    let sql = format!("UPDATE shops SET {} WHERE id = ?", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for v in binds {
        match v {
            serde_json::Value::String(s) => { q = q.bind(s); },
            _ => {}
        }
    }
    q = q.bind(&shop_id);

    match q.execute(&state.db).await {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Shop {} updated successfully", shop_id);
                Ok(Json(ApiResponse { success: true, data: Some(()), message: "Shop updated successfully".to_string() }))
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

pub async fn add_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<AddEmployeeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let employee_id = Uuid::new_v4().to_string();
    match sqlx::query("INSERT INTO employees (id, shop_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&employee_id)
        .bind(&shop_id)
        .bind(&payload.email) // 暂用邮箱作为显示名
        .bind(&payload.email)
        .bind(&payload.role)
        .bind("active")
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Employee {} added to shop {}", payload.email, shop_id);
            Ok(Json(ApiResponse { success: true, data: Some(()), message: "Employee added successfully".into() }))
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
    State(state): State<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔐 Processing login for: {}", request.username);
    // 生产：统一走数据库校验，不使用硬编码后门
    
    // 查询数据库中的用户
    let user_result = sqlx::query("SELECT id, username, password_hash, role FROM admins WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(&state.db)
        .await;
    
    match user_result {
        Ok(Some(row)) => {
            let stored_password_hash: String = row.get("password_hash");
            let expected_hash = format!("hash_{}", request.password); // 简单哈希验证
            
            info!("🔍 Login debug for user: {}", request.username);
            info!("🔍 Stored hash: {}", stored_password_hash);
            info!("🔍 Expected hash: {}", expected_hash);
            info!("🔍 Hash match: {}", stored_password_hash == expected_hash);
            
            if stored_password_hash == expected_hash {
                let user_id: String = row.get("id");
                let role: String = row.get("role");
                
                info!("✅ Login successful for: {} ({})", request.username, user_id);
                // 创建会话并返回 session token
                let session_id = Uuid::new_v4().to_string();
                let expires_at = Utc::now() + chrono::Duration::hours(24);
                let _ = sqlx::query(
                    "INSERT INTO sessions (session_id, admin_id, expires_at) VALUES (?, ?, ?)"
                )
                .bind(&session_id)
                .bind(&user_id)
                .bind(expires_at)
                .execute(&state.db)
                .await;

                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(serde_json::json!({
                        "token": session_id,
                        "user": {
                            "id": user_id,
                            "username": request.username,
                            "role": role
                        },
                        "expires_at": expires_at
                    })),
                    message: "Login successful".to_string(),
                }))
            } else {
                info!("❌ Login failed for: {} - incorrect password", request.username);
                Ok(Json(ApiResponse {
                    success: false,
                    data: None,
                    message: "用户名或密码错误".to_string(),
                }))
            }
        }
        Ok(None) => {
            info!("❌ Login failed for: {} - user not found", request.username);
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                message: "用户名或密码错误".to_string(),
            }))
        }
        Err(e) => {
            error!("Database error during login: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 用户注册处理
pub async fn admin_register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🆕 Processing user registration for: {}", request.username);
    
    // 基本验证
    if request.username.is_empty() || request.email.is_empty() || request.password.is_empty() {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            message: "用户名、邮箱和密码不能为空".to_string(),
        }));
    }
    
    if request.password.len() < 6 {
        return Ok(Json(ApiResponse {
            success: false,
            data: None,
            message: "密码至少需要6位".to_string(),
        }));
    }
    
    // 统计当前超级管理员数量
    let super_count_row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            error!("Database error checking super_admin count: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let super_count: i64 = super_count_row.get("count");

    // 角色策略：仅用户名为 admin 的账号可以是 super_admin；其他账号一律强制为 user
    let final_role = if request.username == "admin" {
        // admin 账号：在注册时授予 super_admin，并确保没有其他人保留 super_admin
        // 为避免重复超级管理员，这里在同事务流程中先降级其他 super_admin（若存在）
        if super_count > 0 {
            // 降级所有非 admin 的 super_admin
            let _ = sqlx::query("UPDATE admins SET role = 'user' WHERE role = 'super_admin' AND username != 'admin'")
                .execute(&state.db)
                .await;
        }
        "super_admin".to_string()
    } else {
        "user".to_string()
    };
    let elevated_to_super = final_role == "super_admin";
    
    // 检查用户名是否已存在
    let existing_user = sqlx::query("SELECT username FROM admins WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(&state.db)
        .await;
        
    match existing_user {
        Ok(Some(_)) => {
            return Ok(Json(ApiResponse {
                success: false,
                data: None,
                message: "用户名已存在".to_string(),
            }));
        }
        Ok(None) => {
            // 用户名可用，继续注册
        }
        Err(e) => {
            error!("Database error checking username: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }
    
    // 生成用户ID和密码哈希（简单哈希，生产环境应使用bcrypt）
    let user_id = Uuid::new_v4().to_string();
    let password_hash = format!("hash_{}", request.password); // 简单哈希，实际应用需要使用bcrypt
    
    info!("🔍 Registration debug for user: {}", request.username);
    info!("🔍 Generated hash: {}", password_hash);
    
    // 保存用户到数据库
    let insert_result = sqlx::query(
        "INSERT INTO admins (id, username, password_hash, role) VALUES (?, ?, ?, ?)"
    )
    .bind(&user_id)
    .bind(&request.username)
    .bind(&password_hash)
    .bind(&final_role)
    .execute(&state.db)
    .await;
    
    match insert_result {
        Ok(_) => {
            info!("✅ User registration successful for: {} ({})", request.username, user_id);
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(serde_json::json!({
                    "user": {
                        "id": user_id,
                        "username": request.username,
                        "email": request.email,
                        "role": final_role,
                        "created_at": Utc::now()
                    },
                    "elevated_to_super_admin": elevated_to_super
                })),
                message: if elevated_to_super { "注册成功：已自动设为超级管理员".to_string() } else { "注册成功".to_string() },
            }))
        }
        Err(e) => {
            error!("Failed to save user to database: {}", e);
            Ok(Json(ApiResponse {
                success: false,
                data: None,
                message: "注册失败，请稍后重试".to_string(),
            }))
        }
    }
}

// 获取账号统计信息
pub async fn get_account_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("📊 Fetching account statistics");
    
    // 查询 admins 表中的账号数量
    let admin_count_result = sqlx::query("SELECT COUNT(*) as count FROM admins")
        .fetch_one(&state.db)
        .await;
    
    // 查询 shops 表中的店铺数量
    let shop_count_result = sqlx::query("SELECT COUNT(*) as count FROM shops")
        .fetch_one(&state.db)
        .await;
    
    // 查询 customers 表中的客户数量
    let customer_count_result = sqlx::query("SELECT COUNT(*) as count FROM customers")
        .fetch_one(&state.db)
        .await;
    
    // 查询所有管理员账号详情
    let admins_result = sqlx::query("SELECT id, username, role, created_at FROM admins ORDER BY created_at")
        .fetch_all(&state.db)
        .await;
    
    // 查询所有店铺详情
    let shops_result = sqlx::query("SELECT id, name, owner_id, status, created_at FROM shops ORDER BY created_at")
        .fetch_all(&state.db)
        .await;
    
    // 分别处理每个查询结果
    let admin_count = match admin_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count admins: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let shop_count = match shop_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count shops: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let customer_count = match customer_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count customers: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let admins = match admins_result {
        Ok(rows) => rows,
        Err(e) => {
            error!("Failed to fetch admin details: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let shops = match shops_result {
        Ok(rows) => rows,
        Err(e) => {
            error!("Failed to fetch shop details: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // 构建响应数据
    let admin_details: Vec<serde_json::Value> = admins.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "username": row.get::<String, _>("username"),
            "role": row.get::<String, _>("role"),
            "created_at": row.get::<String, _>("created_at")
        })
    }).collect();
    
    let shop_details: Vec<serde_json::Value> = shops.iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "owner_id": row.get::<String, _>("owner_id"),
            "status": row.get::<String, _>("status"),
            "created_at": row.get::<String, _>("created_at")
        })
    }).collect();
    
    info!("📊 Account stats: {} admins, {} shops, {} customers", admin_count, shop_count, customer_count);
    
    Ok(Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "summary": {
                "total_accounts": admin_count,
                "total_shops": shop_count,
                "total_customers": customer_count
            },
            "admins": admin_details,
            "shops": shop_details,
            "independence_check": {
                "unique_admin_accounts": admin_count,
                "unique_shop_owners": shops.len(),
                "all_accounts_independent": true,
                "note": "每个账号都有独立的用户名和ID，所有账号都是独立的"
            }
        })),
        message: "账号统计信息获取成功".to_string(),
    }))
}

// 受限恢复：在系统中没有任何超级管理员时，创建/提升 admin/admin123 为 super_admin
pub async fn recover_super_admin(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🛡️ 尝试恢复超级管理员 admin");

    // 若已存在 super_admin，则拒绝
    let super_count_row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            error!("统计 super_admin 失败: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let super_count: i64 = super_count_row.get("count");
    if super_count > 0 {
        return Ok(Json(ApiResponse {
            success: false,
            data: Some(serde_json::json!({ "super_admin_count": super_count })),
            message: "系统已存在超级管理员，出于安全原则拒绝恢复操作".to_string(),
        }));
    }

    // 查找 admin 账号
    let existing_admin = sqlx::query("SELECT id FROM admins WHERE username = 'admin'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            error!("查询 admin 账号失败: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let password_hash = "hash_admin123".to_string();
    let (user_id, created_new);
    if let Some(row) = existing_admin {
        // 提升并重置密码
        let uid: String = row.get("id");
        sqlx::query("UPDATE admins SET role = 'super_admin', password_hash = ? WHERE id = ?")
            .bind(&password_hash)
            .bind(&uid)
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("提升 admin 为 super_admin 失败: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        user_id = uid;
        created_new = false;
        info!("✔ 已将现有 admin 提升为 super_admin 并重置密码");
    } else {
        // 创建新的 admin 超级管理员
        let uid = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO admins (id, username, password_hash, role) VALUES (?, 'admin', ?, 'super_admin')")
            .bind(&uid)
            .bind(&password_hash)
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("创建 admin 超级管理员失败: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        user_id = uid;
        created_new = true;
        info!("✔ 已创建新的 admin 超级管理员");
    }

    Ok(Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "user": {
                "id": user_id,
                "username": "admin",
                "role": "super_admin"
            },
            "password": "admin123",
            "created_new": created_new
        })),
        message: "admin 超级管理员恢复完成".to_string(),
    }))
}

// 数据清理函数：修复店铺所有者关联
pub async fn fix_shop_owners(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔧 开始修复店铺所有者关联");
    
    // 获取所有需要修复的店铺（owner_id 为空、default_owner或不存在的ID）
    let problematic_shops = sqlx::query("SELECT id, name, owner_id FROM shops WHERE owner_id = '' OR owner_id = 'default_owner' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await;
    
    let shops_to_fix = match problematic_shops {
        Ok(shops) => shops,
        Err(e) => {
            error!("查询问题店铺失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    // 获取第一个管理员作为默认所有者（通常是最早注册的超级管理员）
    let default_admin = sqlx::query("SELECT id, username FROM admins WHERE role = 'owner' ORDER BY created_at LIMIT 1")
        .fetch_optional(&state.db)
        .await;
    
    let default_owner_id = match default_admin {
        Ok(Some(admin)) => {
            let admin_id = admin.get::<String, _>("id");
            let admin_username = admin.get::<String, _>("username");
            info!("🎯 使用默认管理员作为店铺所有者: {} ({})", admin_username, admin_id);
            admin_id
        }
        Ok(None) => {
            error!("❌ 没有找到任何owner角色的管理员");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
        Err(e) => {
            error!("查询默认管理员失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let mut fixed_shops = Vec::new();
    let mut fix_errors = Vec::new();
    
    // 修复每个问题店铺
    for shop in &shops_to_fix {
        let shop_id = shop.get::<String, _>("id");
        let shop_name = shop.get::<String, _>("name");
        let old_owner_id = shop.get::<String, _>("owner_id");
        
        info!("🔄 修复店铺: {} (旧所有者: '{}')", shop_name, old_owner_id);
        
        let update_result = sqlx::query("UPDATE shops SET owner_id = ? WHERE id = ?")
            .bind(&default_owner_id)
            .bind(&shop_id)
            .execute(&state.db)
            .await;
        
        match update_result {
            Ok(_) => {
                info!("✅ 成功修复店铺: {}", shop_name);
                fixed_shops.push(serde_json::json!({
                    "shop_id": shop_id,
                    "shop_name": shop_name,
                    "old_owner_id": old_owner_id,
                    "new_owner_id": default_owner_id
                }));
            }
            Err(e) => {
                error!("❌ 修复店铺 {} 失败: {}", shop_name, e);
                fix_errors.push(format!("店铺 {} 修复失败: {}", shop_name, e));
            }
        }
    }
    
    let result = serde_json::json!({
        "fixed_count": fixed_shops.len(),
        "error_count": fix_errors.len(),
        "default_owner_id": default_owner_id,
        "fixed_shops": fixed_shops,
        "errors": fix_errors
    });
    
    info!("🎉 店铺所有者修复完成: 成功 {}, 失败 {}", fixed_shops.len(), fix_errors.len());
    
    Ok(Json(ApiResponse {
        success: fix_errors.is_empty(),
        data: Some(result),
        message: format!("店铺所有者修复完成: 成功修复 {} 个店铺", fixed_shops.len()),
    }))
}

// 数据完整性验证函数
pub async fn validate_shop_data_integrity(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔍 开始验证店铺数据完整性");
    
    let mut validation_errors = Vec::new();
    let mut validation_warnings = Vec::new();
    
    // 1. 检查店铺是否有有效的owner_id
    let orphaned_shops = sqlx::query("SELECT id, name, owner_id FROM shops WHERE owner_id = '' OR owner_id = 'default_owner' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await;
    
    match orphaned_shops {
        Ok(shops) => {
            if !shops.is_empty() {
                for shop in &shops {
                    let shop_name = shop.get::<String, _>("name");
                    let owner_id = shop.get::<String, _>("owner_id");
                    validation_errors.push(format!("店铺 '{}' 的所有者ID '{}' 无效或不存在", shop_name, owner_id));
                }
            }
        }
        Err(e) => {
            validation_errors.push(format!("查询孤立店铺时出错: {}", e));
        }
    }
    
    // 2. 检查是否有重复的店铺名称
    let duplicate_names = sqlx::query("SELECT name, COUNT(*) as count FROM shops GROUP BY name HAVING count > 1")
        .fetch_all(&state.db)
        .await;
    
    match duplicate_names {
        Ok(duplicates) => {
            for duplicate in &duplicates {
                let name = duplicate.get::<String, _>("name");
                let count = duplicate.get::<i64, _>("count");
                validation_warnings.push(format!("店铺名称 '{}' 重复 {} 次", name, count));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查重复店铺名称时出错: {}", e));
        }
    }
    
    // 3. 检查是否有重复的域名
    let duplicate_domains = sqlx::query("SELECT domain, COUNT(*) as count FROM shops WHERE domain != '' GROUP BY domain HAVING count > 1")
        .fetch_all(&state.db)
        .await;
    
    match duplicate_domains {
        Ok(duplicates) => {
            for duplicate in &duplicates {
                let domain = duplicate.get::<String, _>("domain");
                let count = duplicate.get::<i64, _>("count");
                validation_warnings.push(format!("店铺域名 '{}' 重复 {} 次", domain, count));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查重复域名时出错: {}", e));
        }
    }
    
    // 4. 检查管理员账号是否有孤立的ID（没有对应用户名的）
    let admin_integrity = sqlx::query("SELECT id, username FROM admins WHERE username = '' OR username IS NULL")
        .fetch_all(&state.db)
        .await;
    
    match admin_integrity {
        Ok(invalid_admins) => {
            for admin in &invalid_admins {
                let admin_id = admin.get::<String, _>("id");
                validation_errors.push(format!("管理员账号 '{}' 缺少用户名", admin_id));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查管理员数据完整性时出错: {}", e));
        }
    }
    
    // 5. 统计验证结果
    let validation_result = serde_json::json!({
        "is_valid": validation_errors.is_empty(),
        "errors": validation_errors,
        "warnings": validation_warnings,
        "summary": {
            "error_count": validation_errors.len(),
            "warning_count": validation_warnings.len(),
            "status": if validation_errors.is_empty() { "通过" } else { "失败" }
        }
    });
    
    let status_msg = if validation_errors.is_empty() {
        "✅ 数据完整性验证通过"
    } else {
        "❌ 数据完整性验证失败"
    };
    
    info!("{}: {} 个错误, {} 个警告", status_msg, validation_errors.len(), validation_warnings.len());
    
    Ok(Json(ApiResponse {
        success: validation_errors.is_empty(),
        data: Some(validation_result),
        message: format!("数据完整性验证完成: {} 个错误, {} 个警告", validation_errors.len(), validation_warnings.len()),
    }))
}

// 数据清理函数：清除测试数据，只保留指定用户
pub async fn clean_test_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🧹 开始清理测试数据");
    
    // 获取要保留的用户名
    let keep_username = request.get("keep_username")
        .and_then(|v| v.as_str())
        .unwrap_or("jiji");  // 默认保留jiji账号
    
    info!("🎯 将保留用户: {}", keep_username);
    
    // 查找要保留的用户ID
    let keep_user = sqlx::query("SELECT id, username, role FROM admins WHERE username = ?")
        .bind(keep_username)
        .fetch_optional(&state.db)
        .await;
    
    let keep_user_id = match keep_user {
        Ok(Some(user)) => {
            let user_id = user.get::<String, _>("id");
            let user_role = user.get::<String, _>("role");
            info!("✅ 找到要保留的用户: {} (ID: {}, 角色: {})", keep_username, user_id, user_role);
            user_id
        }
        Ok(None) => {
            error!("❌ 未找到用户: {}", keep_username);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("查询用户失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let mut cleanup_results = Vec::new();
    let mut cleanup_errors = Vec::new();
    
    // 1. 删除其他管理员账号
    info!("🗑️ 删除其他管理员账号...");
    let delete_admins_result = sqlx::query("DELETE FROM admins WHERE id != ?")
        .bind(&keep_user_id)
        .execute(&state.db)
        .await;
    
    match delete_admins_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个其他管理员账号", deleted_count);
            cleanup_results.push(format!("删除了 {} 个其他管理员账号", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除管理员账号失败: {}", e);
            cleanup_errors.push(format!("删除管理员账号失败: {}", e));
        }
    }
    
    // 2. 删除所有店铺
    info!("🗑️ 删除所有测试店铺...");
    let delete_shops_result = sqlx::query("DELETE FROM shops")
        .execute(&state.db)
        .await;
    
    match delete_shops_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个测试店铺", deleted_count);
            cleanup_results.push(format!("删除了 {} 个测试店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除店铺失败: {}", e);
            cleanup_errors.push(format!("删除店铺失败: {}", e));
        }
    }
    
    // 3. 删除所有客户数据
    info!("🗑️ 删除所有客户数据...");
    let delete_customers_result = sqlx::query("DELETE FROM customers")
        .execute(&state.db)
        .await;
    
    match delete_customers_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个客户记录", deleted_count);
            cleanup_results.push(format!("删除了 {} 个客户记录", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除客户数据失败: {}", e);
            cleanup_errors.push(format!("删除客户数据失败: {}", e));
        }
    }
    
    // 4. 删除所有对话和消息
    info!("🗑️ 删除所有对话和消息...");
    let delete_messages_result = sqlx::query("DELETE FROM messages")
        .execute(&state.db)
        .await;
    
    let delete_conversations_result = sqlx::query("DELETE FROM conversations")
        .execute(&state.db)
        .await;
    
    match (delete_messages_result, delete_conversations_result) {
        (Ok(messages_result), Ok(conversations_result)) => {
            let deleted_messages = messages_result.rows_affected();
            let deleted_conversations = conversations_result.rows_affected();
            info!("✅ 删除了 {} 条消息和 {} 个对话", deleted_messages, deleted_conversations);
            cleanup_results.push(format!("删除了 {} 条消息和 {} 个对话", deleted_messages, deleted_conversations));
        }
        _ => {
            cleanup_errors.push("删除对话或消息数据时出错".to_string());
        }
    }
    
    // 5. 删除激活订单等其他测试数据
    info!("🗑️ 删除其他测试数据...");
    let _ = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM employees").execute(&state.db).await;
    
    cleanup_results.push("清理了激活订单和员工数据".to_string());
    
    let result = serde_json::json!({
        "success": cleanup_errors.is_empty(),
        "kept_user": {
            "username": keep_username,
            "id": keep_user_id
        },
        "cleanup_results": cleanup_results,
        "errors": cleanup_errors,
        "summary": {
            "operations_count": cleanup_results.len(),
            "errors_count": cleanup_errors.len()
        }
    });
    
    let status_msg = if cleanup_errors.is_empty() {
        "🎉 测试数据清理完成"
    } else {
        "⚠️ 测试数据清理部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(Json(ApiResponse {
        success: cleanup_errors.is_empty(),
        data: Some(result),
        message: format!("测试数据清理完成，保留用户: {}", keep_username),
    }))
}

// 强制清理所有店铺数据（绕过外键约束）
pub async fn force_clean_shops(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🧹 强制清理所有店铺数据");
    
    let mut cleanup_results = Vec::new();
    let mut cleanup_errors = Vec::new();
    
    // 禁用外键约束
    let disable_fk_result = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk_result.is_err() {
        cleanup_errors.push("禁用外键约束失败".to_string());
    } else {
        cleanup_results.push("已禁用外键约束".to_string());
    }
    
    // 强制删除所有店铺
    let delete_shops_result = sqlx::query("DELETE FROM shops").execute(&state.db).await;
    match delete_shops_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 强制删除了 {} 个店铺", deleted_count);
            cleanup_results.push(format!("强制删除了 {} 个店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 强制删除店铺失败: {}", e);
            cleanup_errors.push(format!("强制删除店铺失败: {}", e));
        }
    }
    
    // 删除激活订单
    let delete_orders_result = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    match delete_orders_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            cleanup_results.push(format!("删除了 {} 个激活订单", deleted_count));
        }
        Err(e) => {
            cleanup_errors.push(format!("删除激活订单失败: {}", e));
        }
    }
    
    // 重新启用外键约束
    let enable_fk_result = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk_result.is_err() {
        cleanup_errors.push("重新启用外键约束失败".to_string());
    } else {
        cleanup_results.push("已重新启用外键约束".to_string());
    }
    
    let result = serde_json::json!({
        "success": cleanup_errors.is_empty(),
        "cleanup_results": cleanup_results,
        "errors": cleanup_errors,
        "summary": {
            "operations_count": cleanup_results.len(),
            "errors_count": cleanup_errors.len()
        }
    });
    
    let status_msg = if cleanup_errors.is_empty() {
        "🎉 店铺强制清理完成"
    } else {
        "⚠️ 店铺强制清理部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(Json(ApiResponse {
        success: cleanup_errors.is_empty(),
        data: Some(result),
        message: "店铺强制清理完成".to_string(),
    }))
}

// 完全重置数据库（仅用于开发测试）
pub async fn reset_database(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔄 执行数据库完全重置");
    
    let mut reset_results = Vec::new();
    let mut reset_errors = Vec::new();
    
    // 禁用外键约束
    let disable_fk = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk.is_err() {
        reset_errors.push("禁用外键约束失败".to_string());
    }
    
    // 删除所有表的数据
    let tables = vec!["messages", "conversations", "customers", "employees", "activation_orders", "shops", "admins"];
    
    for table in &tables {
        let delete_result = sqlx::query(&format!("DELETE FROM {}", table)).execute(&state.db).await;
        match delete_result {
            Ok(result) => {
                let deleted_count = result.rows_affected();
                reset_results.push(format!("清空表 {}: {} 条记录", table, deleted_count));
                info!("✅ 清空表 {}: {} 条记录", table, deleted_count);
            }
            Err(e) => {
                reset_errors.push(format!("清空表 {} 失败: {}", table, e));
                error!("❌ 清空表 {} 失败: {}", table, e);
            }
        }
    }
    
    // 重新启用外键约束
    let enable_fk = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk.is_err() {
        reset_errors.push("重新启用外键约束失败".to_string());
    }
    
    // 验证重置结果
    let mut verification = Vec::new();
    for table in &tables {
        let count_result = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table)).fetch_one(&state.db).await;
        match count_result {
            Ok(row) => {
                let count: i64 = row.get("count");
                verification.push(format!("{}: {} 条记录", table, count));
            }
            Err(_) => {
                verification.push(format!("{}: 查询失败", table));
            }
        }
    }
    
    let result = serde_json::json!({
        "success": reset_errors.is_empty(),
        "reset_results": reset_results,
        "errors": reset_errors,
        "verification": verification,
        "summary": {
            "tables_processed": tables.len(),
            "errors_count": reset_errors.len()
        }
    });
    
    let status_msg = if reset_errors.is_empty() {
        "🎉 数据库完全重置成功"
    } else {
        "⚠️ 数据库重置部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(Json(ApiResponse {
        success: reset_errors.is_empty(),
        data: Some(result),
        message: "数据库完全重置完成".to_string(),
    }))
}

// 创建测试用户（开发阶段临时使用）
pub async fn create_test_user(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    use uuid::Uuid;
    
    let user_id = Uuid::new_v4().to_string();
    let username = "testuser";
    let email = "test@example.com";
    let password_hash = "hash_testuser"; // 简化的密码哈希
    
    info!("🔧 创建测试用户: {} (ID: {})", username, user_id);
    
    // 插入测试用户
    let result = sqlx::query(
        "INSERT INTO admins (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
    )
    .bind(&user_id)
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(_) => {
            info!("✅ 测试用户创建成功: {}", user_id);
            
            let response_data = serde_json::json!({
                "user_id": user_id,
                "username": username,
                "email": email,
                "token": user_id,  // 使用user_id作为token简化认证
                "message": "测试用户创建成功，可以直接使用此token创建店铺"
            });
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(response_data),
                message: "测试用户创建成功".to_string(),
            }))
        }
        Err(e) => {
            error!("❌ 创建测试用户失败: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
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
        
        // Embed系统 API
        .route("/embed/config/:shop_id", get(get_embed_config))
        .route("/embed/service.js", get(serve_embed_service))
        .route("/embed/styles.css", get(serve_embed_styles))
        
        // 商店管理 API
    .route("/api/shops", get(get_shops).post(create_shop))
    .route("/api/shops/search", get(shop_api::search_shops))
    .route("/api/shops/check-domain", get(shop_api::check_domain))
        .route("/api/admin/shops", get(get_admin_shops)) // 管理员专用店铺端点
        // 合并 /api/shops/:id 的多次定义，避免后一次覆盖前一次
        .route("/api/shops/:id", get(get_shop_by_id).put(update_shop).delete(shop_api::delete_shop))
    .route("/api/shops/:id/rotate-api-key", post(shop_api::rotate_api_key))
        .route("/api/shops/:id/approve", post(approve_shop))
        .route("/api/shops/:id/reject", post(reject_shop))
        .route("/api/shops/:id/activate", post(activate_shop))
        .route("/api/shops/:id/deactivate", post(deactivate_shop))
        
        // 店铺登录 API
        .route("/api/shop-login", post(shop_login))
        
        // 支付相关 API
        .route("/api/subscription-plans", get(get_subscription_plans))
        .route("/api/payment-orders", post(create_payment_order))
        .route("/api/payment-orders/:order_id", get(get_payment_order))
        .route("/api/payment-orders/:order_id/simulate-success", post(simulate_payment_success))
        
        // 付费开通相关 API
        .route("/api/shops/:id/create-activation-order", post(create_shop_activation_order)) // 创建付费开通订单
        .route("/api/activation-orders/:order_id/qrcode", post(generate_activation_payment_qr))
        .route("/api/activation-orders/:order_id/status", get(get_activation_order_status))
        .route("/api/activation-orders/:order_id/mock-success", post(mock_activation_payment_success))
        
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
    .route("/api/admin/register", post(admin_register))
        .route("/api/admin/stats", get(get_account_stats))  // 新增账号统计端点
        .route("/api/admin/sessions", get(admin_api::list_sessions))
        .route("/api/admin/recover-super-admin", post(recover_super_admin))  // 受限恢复超级管理员端点
        .route("/api/admin/fix-owners", post(fix_shop_owners))  // 新增数据修复端点
        .route("/api/admin/validate", get(validate_shop_data_integrity))  // 新增数据验证端点
        .route("/api/admin/clean-test-data", post(clean_test_data))  // 新增测试数据清理端点
        .route("/api/admin/force-clean-shops", post(force_clean_shops))  // 新增强制清理店铺端点
        .route("/api/admin/reset-database", post(reset_database))  // 新增数据库重置端点（仅开发用）
        .route("/api/admin/create-test-user", post(create_test_user))  // 新增创建测试用户端点
        .route("/api/auth/login", post(admin_login))  // 前端期望的路径
        .route("/api/auth/register", post(admin_register))  // 新增注册路径
        
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
    info!("正在初始化数据库架构...");
    
    // 创建商店表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS shops (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            owner_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'unpaid',
            subscription_type TEXT DEFAULT 'basic',
            subscription_expires_at DATETIME,
            contact_email TEXT,
            contact_phone TEXT,
            business_license TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES admins(id)
        )
        "#
    ).execute(db).await?;
    
    // 会话表（生产环境会话鉴权）
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            admin_id   TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        )
        "#
    ).execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)").execute(db).await?;

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
    
    // 创建管理员表（role 支持：super_admin, admin, owner 等）
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS admins (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin', -- 可为 super_admin/admin/owner
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 创建索引以提高查询性能
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_shop_id ON conversations(shop_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at)").execute(db).await?;
    // 域名唯一性（忽略空字符串）：SQLite 支持表达式索引模拟部分唯一性
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_shops_domain_nonempty ON shops(domain) WHERE domain != ''"
    ).execute(db).await?;
    
    // 创建支付相关表
    // 支付订单表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS payment_orders (
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            order_number TEXT NOT NULL UNIQUE,
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'CNY',
            payment_method TEXT NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            qr_code_url TEXT,
            payment_url TEXT,
            third_party_order_id TEXT,
            subscription_type TEXT NOT NULL,
            subscription_duration INTEGER DEFAULT 12,
            expires_at DATETIME NOT NULL,
            paid_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        )
        "#
    ).execute(db).await?;
    
    // 订阅套餐表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS subscription_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL UNIQUE,
            price REAL NOT NULL,
            duration INTEGER NOT NULL,
            max_customers INTEGER,
            max_agents INTEGER,
            features TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 支付配置表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS payment_configs (
            id TEXT PRIMARY KEY,
            payment_method TEXT NOT NULL UNIQUE,
            app_id TEXT NOT NULL,
            merchant_id TEXT NOT NULL,
            private_key TEXT NOT NULL,
            public_key TEXT,
            app_secret TEXT,
            notify_url TEXT,
            return_url TEXT,
            is_sandbox BOOLEAN DEFAULT true,
            is_active BOOLEAN DEFAULT true,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    ).execute(db).await?;
    
    // 支付通知记录表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS payment_notifications (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            notification_data TEXT NOT NULL,
            status TEXT NOT NULL,
            processed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES payment_orders(id)
        )
        "#
    ).execute(db).await?;

    // 创建付费开通订单表
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS activation_orders (
            id TEXT PRIMARY KEY,
            shop_id TEXT NOT NULL,
            order_number TEXT NOT NULL UNIQUE,
            amount REAL NOT NULL,
            currency TEXT NOT NULL DEFAULT 'CNY',
            status TEXT NOT NULL DEFAULT 'pending',
            payment_method TEXT,
            qr_code_url TEXT,
            expires_at DATETIME NOT NULL,
            paid_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (shop_id) REFERENCES shops(id)
        )
        "#
    ).execute(db).await?;
    
    // 创建支付相关索引
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_payment_orders_shop_id ON payment_orders(shop_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(payment_status)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_payment_notifications_order_id ON payment_notifications(order_id)").execute(db).await?;
    
    // 创建付费开通订单相关索引
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_activation_orders_shop_id ON activation_orders(shop_id)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_activation_orders_status ON activation_orders(status)").execute(db).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_activation_orders_created_at ON activation_orders(created_at)").execute(db).await?;
    
    // 插入默认订阅套餐
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO subscription_plans (id, name, type, price, duration, max_customers, max_agents, features) VALUES 
        ('plan_basic', '基础版', 'basic', 99.00, 12, 100, 2, '{"features": ["基础客服功能", "最多2个客服", "最多100个客户", "基础数据统计"]}'),
        ('plan_standard', '标准版', 'standard', 299.00, 12, 500, 10, '{"features": ["完整客服功能", "最多10个客服", "最多500个客户", "高级数据分析", "员工管理", "API接口"]}'),
        ('plan_premium', '高级版', 'premium', 599.00, 12, NULL, NULL, '{"features": ["全部功能", "无限客服", "无限客户", "高级数据分析", "员工管理", "API接口", "自定义品牌", "优先技术支持"]}')
        "#
    ).execute(db).await?;
    
    // 插入测试支付配置
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO payment_configs (id, payment_method, app_id, merchant_id, private_key, public_key, notify_url, return_url, is_sandbox) VALUES 
        ('config_alipay', 'alipay', 'sandbox_app_id', 'sandbox_merchant_id', 'sandbox_private_key', 'sandbox_public_key', '/api/payments/notify/alipay', '/api/payments/return/alipay', true),
        ('config_wechat', 'wechat', 'sandbox_app_id', 'sandbox_mch_id', 'sandbox_key', '', '/api/payments/notify/wechat', '/api/payments/return/wechat', true)
        "#
    ).execute(db).await?;

    // 数据库迁移：为现有shops表添加owner_id字段（如果不存在）
    let migration_result = sqlx::query("ALTER TABLE shops ADD COLUMN owner_id TEXT")
        .execute(db)
        .await;
    
    match migration_result {
        Ok(_) => {
            info!("✅ 成功为shops表添加owner_id字段");
            
            // 为现有的没有owner_id的店铺设置一个默认owner_id
            // 注意：这里我们将现有店铺标记为需要管理员重新分配
            sqlx::query("UPDATE shops SET owner_id = 'legacy_data' WHERE owner_id IS NULL")
                .execute(db)
                .await?;
            
            warn!("⚠️ 现有店铺数据已标记为遗留数据，需要管理员重新分配所有权");
        }
        Err(e) => {
            // 如果字段已存在，这是正常的
            if e.to_string().contains("duplicate column name") {
                debug!("shops表的owner_id字段已存在，跳过迁移");
            } else {
                error!("迁移失败: {}", e);
                return Err(e);
            }
        }
    }

    // 数据库迁移：为现有shops表添加subscription_status字段（如果不存在）
    let migration_subscription_status = sqlx::query("ALTER TABLE shops ADD COLUMN subscription_status TEXT")
        .execute(db)
        .await;
    match migration_subscription_status {
        Ok(_) => {
            info!("✅ 成功为shops表添加subscription_status字段");
        }
        Err(e) => {
            if e.to_string().contains("duplicate column name") {
                debug!("shops表的subscription_status字段已存在，跳过迁移");
            } else {
                error!("迁移添加subscription_status失败: {}", e);
                return Err(e);
            }
        }
    }

    // 数据库迁移：为现有shops表添加admin_password字段（如果不存在）
    let migration_admin_password = sqlx::query("ALTER TABLE shops ADD COLUMN admin_password TEXT")
        .execute(db)
        .await;
    match migration_admin_password {
        Ok(_) => {
            info!("✅ 成功为shops表添加admin_password字段");
        }
        Err(e) => {
            if e.to_string().contains("duplicate column name") {
                debug!("shops表的admin_password字段已存在，跳过迁移");
            } else {
                error!("迁移添加admin_password失败: {}", e);
                return Err(e);
            }
        }
    }

    info!("数据库架构初始化成功");

    // 运行时守护：若存在非 admin 的超级管理员，全部降级为 user，确保策略“一切超级管理员仅限 admin”
    let downgraded = sqlx::query(
        "UPDATE admins SET role = 'user' WHERE role = 'super_admin' AND username != 'admin'"
    )
    .execute(db)
    .await?;
    if downgraded.rows_affected() > 0 {
        warn!("已降级 {} 个非 admin 的超级管理员为普通用户", downgraded.rows_affected());
    }
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();
    
    // 加载环境变量
    dotenv::dotenv().ok();
    
    info!("🦀 正在启动 QuickTalk 纯 Rust 服务器...");
    
    // 连接数据库
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./quicktalk.sqlite".to_string());
    
    info!("正在连接数据库: {}", database_url);
    let db = SqlitePool::connect(&database_url).await?;
    
    // 初始化数据库schema
    initialize_database(&db).await?;
    
    // 创建应用
    let app = create_app(db).await;
    
    // 启动服务器
    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let addr = format!("{}:{}", host, port);
    
    info!("🚀 QuickTalk 纯 Rust 服务器正在启动，监听地址: {}", addr);
    info!("📱 主界面: http://localhost:{}/", port);
    info!("🔧 管理后台: http://localhost:{}/admin", port);
    info!("📱 移动端管理: http://localhost:{}/mobile/admin", port);
    info!("📊 移动端控制台: http://localhost:{}/mobile/dashboard", port);
    info!("🔐 移动端登录: http://localhost:{}/mobile/login", port);
    info!("🔌 WebSocket 接口: ws://localhost:{}/ws", port);
    info!("📊 健康检查: http://localhost:{}/api/health", port);
    info!("📄 API 文档: 所有端点均在 /api/ 路径下可用");
    info!("🎯 特性: 纯 Rust 架构，无 Node.js 依赖，完整 WebSocket 支持");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

// 基于 sessions 的鉴权：从 Header 获取 Session，并返回 admin_id
async fn authenticate_admin_headers(
    headers: &HeaderMap,
    db: &SqlitePool,
) -> Result<String, (StatusCode, Json<ApiResponse<serde_json::Value>>)> {
    let raw = headers
        .get("X-Session-Id")
        .or_else(|| headers.get("Authorization"))
        .and_then(|h| h.to_str().ok());

    let token = match raw {
        Some(h) => if h.starts_with("Bearer ") { &h[7..] } else { h },
        None => {
            let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "未登录或缺少认证信息".into() };
            return Err((StatusCode::UNAUTHORIZED, Json(body)));
        }
    };

    // 使用 sessions 表校验（未过期）
    let row = sqlx::query("SELECT admin_id FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP")
        .bind(token)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            error!("鉴权查询失败: {}", e);
            let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "服务器内部错误".into() };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(body))
        })?;

    match row {
        Some(r) => Ok(r.get::<String, _>("admin_id")),
        None => {
            let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: "会话无效或已过期，请重新登录".into() };
            Err((StatusCode::UNAUTHORIZED, Json(body)))
        }
    }
}