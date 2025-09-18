use axum::{
    extract::{State, WebSocketUpgrade, Multipart},
    http::{StatusCode, Uri},
    response::{Json, Html, Response},
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

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub node_client: reqwest::Client,
    pub node_url: String,
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

#[derive(Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct NodeJsRequest {
    pub action: String,
    pub data: serde_json::Value,
}

// 主页路由
pub async fn serve_index() -> Html<String> {
    match tokio::fs::read_to_string("../static/index.html").await {
        Ok(content) => Html(content),
        Err(_) => Html("<h1>Welcome to QuickTalk</h1><p>Frontend files not found</p>".to_string()),
    }
}

// 管理后台路由
pub async fn serve_admin() -> Html<String> {
    match tokio::fs::read_to_string("../static/admin-mobile.html").await {
        Ok(content) => Html(content),
        Err(_) => Html("<h1>Admin Panel</h1><p>Admin files not found</p>".to_string()),
    }
}

// 移动端管理后台
pub async fn serve_mobile_admin() -> Html<String> {
    match tokio::fs::read_to_string("../static/mobile/admin.html").await {
        Ok(content) => Html(content),
        Err(_) => {
            // 如果没有专门的移动端文件，使用通用管理页面
            serve_admin().await
        }
    }
}

// WebSocket 处理
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    
    info!("New WebSocket connection established");
    
    // 发送欢迎消息
    if sender.send(axum::extract::ws::Message::Text(
        serde_json::json!({
            "type": "welcome",
            "message": "Connected to QuickTalk Rust Server",
            "timestamp": chrono::Utc::now()
        }).to_string()
    )).await.is_err() {
        return;
    }
    
    // 处理接收到的消息
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(axum::extract::ws::Message::Text(text)) => {
                info!("Received WebSocket message: {}", text);
                
                // 尝试解析消息
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(json) => {
                        // 转发到Node.js服务处理复杂的WebSocket逻辑
                        if let Err(e) = forward_to_nodejs(&state, &json).await {
                            warn!("Failed to forward to Node.js: {}", e);
                        }
                        
                        // 回显确认
                        let response = serde_json::json!({
                            "type": "ack",
                            "original": json,
                            "processed_by": "rust_server",
                            "timestamp": chrono::Utc::now()
                        });
                        
                        if sender.send(axum::extract::ws::Message::Text(response.to_string())).await.is_err() {
                            break;
                        }
                    }
                    Err(_) => {
                        warn!("Invalid JSON message received");
                    }
                }
            }
            Ok(axum::extract::ws::Message::Close(_)) => {
                info!("WebSocket connection closed");
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

// 转发请求到Node.js服务
async fn forward_to_nodejs(state: &AppState, data: &serde_json::Value) -> Result<(), Box<dyn std::error::Error>> {
    let request = NodeJsRequest {
        action: "websocket_message".to_string(),
        data: data.clone(),
    };
    
    let response = state.node_client
        .post(&format!("{}/internal/websocket", state.node_url))
        .json(&request)
        .send()
        .await?;
        
    if !response.status().is_success() {
        warn!("Node.js service returned error: {}", response.status());
    }
    
    Ok(())
}

// API Routes
pub async fn health_check() -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "server": "rust",
            "version": "0.1.0",
            "status": "running",
            "timestamp": chrono::Utc::now()
        })),
        message: "Rust server is running".to_string(),
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

// 代理到Node.js的API路由
pub async fn proxy_to_nodejs(
    uri: Uri,
    State(state): State<Arc<AppState>>,
) -> Result<Response, StatusCode> {
    let path = uri.path();
    let query = uri.query().unwrap_or("");
    
    let url = if query.is_empty() {
        format!("{}{}", state.node_url, path)
    } else {
        format!("{}{}?{}", state.node_url, path, query)
    };
    
    match state.node_client.get(&url).send().await {
        Ok(response) => {
            let status = response.status();
            let body = response.bytes().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            Ok(Response::builder()
                .status(status.as_u16())
                .body(axum::body::Body::from(body))
                .unwrap())
        }
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE)
    }
}

// 文件上传处理
pub async fn upload_file(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();
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

pub async fn create_app(db: SqlitePool) -> Router {
    let node_url = std::env::var("NODE_SERVER_URL")
        .unwrap_or_else(|_| "http://localhost:3031".to_string());
    
    let state = Arc::new(AppState { 
        db,
        node_client: reqwest::Client::new(),
        node_url,
    });

    Router::new()
        // 主要页面路由
        .route("/", get(serve_index))
        .route("/admin", get(serve_admin))
        .route("/mobile/admin", get(serve_mobile_admin))
        
        // WebSocket
        .route("/ws", get(websocket_handler))
        
        // API 路由
        .route("/api/health", get(health_check))
        .route("/api/shops", get(get_shops))
        .route("/api/upload", post(upload_file))
        
        // 代理其他API到Node.js
        .route("/api/*path", any(proxy_to_nodejs))
        
        // 静态文件服务
        .nest_service("/static", ServeDir::new("../static"))
        .nest_service("/uploads", ServeDir::new("../uploads"))
        
        // CORS和追踪
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();
    
    // 加载环境变量
    dotenv::dotenv().ok();
    
    // 连接数据库
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:../data/database.sqlite".to_string());
    
    let db = SqlitePool::connect(&database_url).await?;
    
    // 创建应用
    let app = create_app(db).await;
    
    // 启动服务器 - 使用原来的3030端口
    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    info!("🦀 QuickTalk Rust Server starting on {}", addr);
    info!("📱 Admin Panel: http://localhost:{}/admin", port);
    info!("📱 Mobile Admin: http://localhost:{}/mobile/admin", port);
    info!("🔌 WebSocket: ws://localhost:{}/ws", port);
    info!("📊 Health Check: http://localhost:{}/api/health", port);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}