use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, State,
    },
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, delete, put},
    Json, Router,
};
use chrono::Utc;
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::{
    net::SocketAddr,
    sync::{Arc, Mutex},
};
use tokio::sync::mpsc;
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn};

mod auth;
mod constants;
mod database;
mod database_orm;
mod entities;
mod error;
mod handlers;
mod jwt;
mod models;
mod repositories;
mod server;
mod services;
mod tls;
mod websocket;

use database::Database;
use models::{Customer, Session, WebSocketIncomingMessage, WebSocketMessage};
use server::{HttpsServer, ServerConfig, start_http_redirect};
use services::chat::ChatService;
use tls::TlsConfig;
use websocket::ConnectionManager;
use websocket::{handle_customer_ws_message, handle_staff_ws_message, CustomerWsCtx};

/// 终止旧的程序进程
async fn terminate_old_processes() {
    info!("🔍 检查并终止旧的客服系统进程...");
    
    // 在Linux上查找并终止旧进程
    if cfg!(target_os = "linux") {
        // 获取当前进程ID，避免自杀
        let current_pid = std::process::id();
        info!("当前进程ID: {}", current_pid);
        
        // 先用pgrep查找所有匹配的进程
        match std::process::Command::new("pgrep")
            .arg("-f")
            .arg("customer-service-backend")
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    let pids_str = String::from_utf8_lossy(&output.stdout);
                    let mut terminated_count = 0;
                    
                    for line in pids_str.lines() {
                        if let Ok(pid) = line.trim().parse::<u32>() {
                            if pid != current_pid {
                                info!("发现旧进程: {}, 正在终止...", pid);
                                match std::process::Command::new("kill")
                                    .arg(&pid.to_string())
                                    .output()
                                {
                                    Ok(_) => {
                                        terminated_count += 1;
                                        info!("✅ 已终止进程: {}", pid);
                                    }
                                    Err(e) => {
                                        warn!("⚠️  无法终止进程 {}: {}", pid, e);
                                    }
                                }
                            } else {
                                info!("🔒 跳过当前进程: {} (避免自杀)", pid);
                            }
                        }
                    }
                    
                    if terminated_count > 0 {
                        info!("✅ 已终止 {} 个旧进程", terminated_count);
                    } else {
                        info!("ℹ️  没有找到需要终止的旧进程");
                    }
                } else {
                    info!("ℹ️  没有找到匹配的进程");
                }
            }
            Err(e) => {
                warn!("⚠️  无法执行pgrep命令: {}", e);
            }
        }
        
        // 额外检查HTTPS端口占用
        match std::process::Command::new("lsof")
            .arg("-ti:8443")
            .output()
        {
            Ok(output) => {
                if !output.stdout.is_empty() {
                    let pids = String::from_utf8_lossy(&output.stdout);
                    for pid_str in pids.trim().lines() {
                        if let Ok(pid) = pid_str.trim().parse::<u32>() {
                            if pid != current_pid {
                                info!("🔄 终止占用8443端口的进程: {}", pid);
                                let _ = std::process::Command::new("kill")
                                    .arg("-9")
                                    .arg(&pid.to_string())
                                    .output();
                            } else {
                                info!("🔒 跳过当前进程: {} (端口8443)", pid);
                            }
                        }
                    }
                }
            }
            Err(_) => {
                debug!("无法检查端口占用情况");
            }
        }
        
        // 也检查HTTP端口
        match std::process::Command::new("lsof")
            .arg("-ti:8080")
            .output()
        {
            Ok(output) => {
                if !output.stdout.is_empty() {
                    let pids = String::from_utf8_lossy(&output.stdout);
                    for pid_str in pids.trim().lines() {
                        if let Ok(pid) = pid_str.trim().parse::<u32>() {
                            if pid != current_pid {
                                info!("🔄 终止占用8080端口的进程: {}", pid);
                                let _ = std::process::Command::new("kill")
                                    .arg("-9")
                                    .arg(&pid.to_string())
                                    .output();
                            } else {
                                info!("🔒 跳过当前进程: {} (端口8080)", pid);
                            }
                        }
                    }
                }
            }
            Err(_) => {
                debug!("无法检查8080端口占用情况");
            }
        }
    }
    
    // 等待一秒确保进程完全终止
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
}

#[derive(Clone)]
pub struct AppState {
    pub db: Database, // Legacy database - 将在 Phase 4 清理
    pub db_orm: database_orm::Database, // Sea-ORM 连接
    pub db_connection: sea_orm::DatabaseConnection, // Sea-ORM 连接直接访问
    pub connections: Arc<Mutex<ConnectionManager>>,
    // 新的 Services 层
    pub user_service: services::UserService,
    pub shop_service: services::ShopService,
    pub customer_service: services::CustomerService,
    pub session_service: services::SessionService,
    pub message_service: services::MessageService,
}

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志系统，强制显示详细信息
    tracing_subscriber::fmt()
        .with_env_filter("debug")
        .with_target(true)
        .with_thread_ids(true)
        .with_file(true)
        .with_line_number(true)
        .init();

    info!("🚀 客服系统启动中...");
    
    // 在启动时终止旧进程
    info!("🔍 检查并终止旧进程...");
    terminate_old_processes().await;
    info!("✅ 进程检查完成");

    // 加载 .env（如果存在）
    info!("📁 加载环境变量文件 (.env)...");
    let _ = dotenvy::dotenv();
    info!("✅ .env 文件处理完成");
    
    // 检查是否为开发模式
    info!("🔍 检查运行模式...");
    let is_dev_mode = std::env::var("NODE_ENV")
        .or_else(|_| std::env::var("RUST_ENV"))
        .map(|v| v.to_lowercase() == "development")
        .unwrap_or(false);
    info!("ℹ️  is_dev_mode = {}", is_dev_mode);
    info!("ℹ️  is_dev_mode = {}", is_dev_mode);
    
    // 检查是否强制禁用HTTPS
    info!("🔍 检查 FORCE_HTTP 设置...");
    let force_http = std::env::var("FORCE_HTTP")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);
    info!("ℹ️  force_http = {}", force_http);
    
    // 检查是否显式设置了TLS_MODE
    info!("🔍 检查 TLS_MODE 设置...");
    let explicit_tls_mode = std::env::var("TLS_MODE").is_ok();
    info!("ℹ️  explicit_tls_mode = {}", explicit_tls_mode);
    
    if force_http || (is_dev_mode && !explicit_tls_mode) {
        info!("🔓 开发模式: 允许HTTP协议");
        std::env::set_var("TLS_MODE", "disabled");
    } else if explicit_tls_mode {
        info!("🔧 使用显式设置的TLS_MODE环境变量");
    } else {
        // 强制启用HTTPS模式（生产环境）
        std::env::set_var("SERVER_TYPE", "https");
        std::env::set_var("ENABLE_HTTP_REDIRECT", "true");
        info!("🔒 生产模式: 强制启用HTTPS");
    }
    info!("✅ TLS 模式配置完成");
    
    
    // 初始化数据库
    info!("🔌 开始初始化数据库连接...");
    let db_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./customer_service.db".to_string());
    
    info!("📦 数据库URL: {}", db_url);
    
    // 🔥 方式1: 使用旧的 sqlx Database（向后兼容）
    info!("🔌 正在连接 sqlx Database...");
    let db = Database::new(&db_url).await?;
    info!("✅ sqlx Database 连接成功");

    // 🚀 方式2: 使用新的 Sea-ORM Database
    info!("🔌 Initializing Sea-ORM connection...");
    let db_orm = database_orm::Database::new(&db_url).await?;
    info!("✅ Sea-ORM 连接成功");    // 🔄 数据库迁移处理 - 支持完全跳过
    let skip_migration = std::env::var("DISABLE_MIGRATION")
        .or_else(|_| std::env::var("SKIP_DATABASE_MIGRATION"))
        .or_else(|_| std::env::var("NO_MIGRATION"))
        .or_else(|_| std::env::var("DATABASE_SKIP_MIGRATION"))
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    if skip_migration {
        warn!("⚠️  Migration 完全跳过 (环境变量设置)");
        info!("📊 验证数据库连接...");
        
        // 简单验证数据库连接是否正常
        match db_orm.get_connection().ping().await {
            Ok(_) => info!("✅ 数据库连接验证成功"),
            Err(e) => {
                error!(error=?e, "❌ 数据库连接失败");
                return Err(anyhow::anyhow!("数据库连接失败: {}", e));
            }
        }
    } else {
        // 正常的迁移流程
        info!("🔄 Running Sea-ORM migrations...");
        if let Err(e) = database_orm::run_migrations(db_orm.get_connection()).await {
            error!(error=?e, "❌ Sea-ORM migration failed");
            // 回退到旧的迁移系统
            warn!("⚠️  Falling back to legacy migration...");
            if let Err(e2) = db.migrate().await {
                error!(error=?e2, "❌ Legacy migration also failed");
                return Err(e2);
            }
        }
        info!("✅ Database migrations completed successfully");
    }
    
    info!("🔗 初始化 WebSocket 连接管理器...");
    let connections = Arc::new(Mutex::new(ConnectionManager::new()));
    info!("✅ 连接管理器初始化完成");

    // 创建 Services 实例 - 使用 Sea-ORM DatabaseConnection
    info!("🏗️  正在创建服务层实例...");
    let user_service = services::UserService::new(db_orm.get_connection().clone());
    let shop_service = services::ShopService::new(db_orm.get_connection().clone());
    let customer_service = services::CustomerService::new(db_orm.get_connection().clone());
    let session_service = services::SessionService::new(db_orm.get_connection().clone());
    let message_service = services::MessageService::new(db_orm.get_connection().clone());
    info!("✅ 服务层实例创建完成");

    info!("📦 构建应用状态...");
    let state = AppState { 
        db, 
        db_orm: db_orm.clone(),
        db_connection: db_orm.clone_connection(),
        connections,
        user_service,
        shop_service,
        customer_service,
        session_service,
        message_service,
    };

    // 创建应用路由
    let app = create_router(state);

    // 获取服务器配置
    let server_config = ServerConfig::from_env();
    let tls_config = TlsConfig::from_env();
    info!("✅ 服务器配置读取完成");

    // 打印配置信息
    info!("📋 打印服务器配置信息...");
    server_config.print_info();
    info!("✅ 配置信息打印完成");
    
    // 检查是否使用HTTP模式
    info!("🔍 检查 TLS 模式... (enabled: {})", tls_config.enabled);
    if tls_config.enabled {
        info!("🔒 启动HTTPS服务器");
        
        // 验证HTTPS配置
        let https_server = HttpsServer::new(tls_config.clone());
        if let Err(e) = https_server.validate_config() {
            error!("❌ HTTPS配置验证失败: {:?}", e);
            error!("🚨 系统要求必须使用HTTPS，请检查证书配置！");
            https_server.print_cert_help();
            return Err(anyhow::anyhow!("HTTPS配置验证失败，系统要求强制HTTPS"));
        }
        
        info!("✅ HTTPS配置验证成功");
        
        // 启动服务器并等待
        info!("🔧 准备启动 HTTPS 服务器...");
        let result = start_https_server(app, &server_config, &tls_config).await;
        
        match result {
            Ok(_) => {
                info!("✅ 服务器正常关闭");
                Ok(())
            }
            Err(e) => {
                error!("❌ 服务器错误: {:?}", e);
                Err(e)
            }
        }
    } else {
        info!("🔓 启动HTTP服务器 (开发模式)");
        start_http_server(app, &server_config).await
    }
}

/// 创建应用路由
fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(handlers::static_files::serve_index))
        .route("/health", get(|| async { 
            tracing::info!("📊 健康检查请求收到");
            axum::Json(serde_json::json!({"status":"ok"})) 
        }))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/register", post(handlers::auth::register))
    .route("/api/shops", get(handlers::shop::get_shops))
    .route("/api/shops/paged", get(handlers::shop::get_shops_paged))
        .route("/api/shops", post(handlers::shop::create_shop))
    .route("/api/staff/shops", get(handlers::shop::get_staff_shops))
        .route("/api/staff/shops/paged", get(handlers::shop::get_staff_shops_paged))
        .route(
            "/api/shops/:shop_id/customers",
            get(handlers::customer::get_customers),
        )
        .route(
            "/api/shops/:shop_id/customers/paged",
            get(handlers::customer::get_customers_paged),
        )
        .route(
            "/api/shops/:shop_id/customers/:customer_id/read",
            post(handlers::customer::reset_unread),
        )
        .route(
            "/api/shops/:shop_id/customers/read_all",
            post(handlers::customer::reset_unread_all),
        )
        .route(
            "/api/shops/:shop_id/staff",
            get(handlers::staff::list_staff),
        )
        .route(
            "/api/shops/:shop_id/staff",
            post(handlers::staff::add_staff),
        )
        .route(
            "/api/shops/:shop_id/staff/:user_id",
            delete(handlers::staff::remove_staff),
        )
        .route(
            "/api/sessions/:session_id/messages",
            get(handlers::message::get_messages),
        )
        .route(
            "/api/sessions/:session_id/messages",
            post(handlers::message::send_message),
        )
        .route(
            "/api/sessions/:session_id",
            get(handlers::session::get_session),
        )
        .route("/api/upload", post(handlers::upload::handle_upload))
        .route("/api/customer/upload", post(handlers::upload::handle_customer_upload))
        .route("/api/sdk/version", get(handlers::sdk_version::get_latest_version))
        .route("/api/sdk/version/:version", get(handlers::sdk_version::get_specific_version))
        .route("/api/config", get(handlers::config::get_server_config))
        .route(
            "/api/dashboard/stats",
            get(handlers::stats::get_dashboard_stats),
        )
        .route("/api/user/profile", put(handlers::user::update_profile))
        .route("/api/user/password", put(handlers::user::change_password))
        .route("/ws/staff/:user_id", get(websocket_handler_staff))
        .route(
            "/ws/customer/:shop_ref/:customer_id",
            get(websocket_handler_customer),
        )
        .route("/static/*file_path", get(handlers::static_files::serve_static_file))
        .route("/favicon.ico", get(handlers::static_files::serve_favicon))
        .route("/favicon.svg", get(handlers::static_files::serve_favicon_svg))
        .route("/robots.txt", get(handlers::static_files::serve_robots))
        .route("/manifest.json", get(handlers::static_files::serve_manifest))
        // 添加通用静态文件路由作为后备
        .fallback(handlers::static_files::serve_spa_fallback)
        .layer(
            tower::ServiceBuilder::new()
                .layer(tower_http::trace::TraceLayer::new_for_http()
                    .make_span_with(|request: &axum::http::Request<_>| {
                        tracing::info_span!(
                            "http_request",
                            method = %request.method(),
                            uri = %request.uri(),
                            version = ?request.version(),
                        )
                    })
                    .on_request(|_request: &axum::http::Request<_>, _span: &tracing::Span| {
                        tracing::info!("🌐 收到请求");
                    })
                    .on_response(|_response: &axum::http::Response<_>, _latency: std::time::Duration, _span: &tracing::Span| {
                        tracing::info!("✅ 请求完成");
                    })
                )
        )
        .layer(CorsLayer::permissive())
        .with_state(state)
}

// WebSocket: staff upgrade handler
async fn websocket_handler_staff(
    Path(user_id): Path<i64>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Staff WebSocket connection from: {}", addr);
    ws.on_upgrade(move |socket| handle_staff_socket(socket, state, user_id))
}

// WebSocket: customer upgrade handler (shop_ref can be id or api key)
async fn websocket_handler_customer(
    Path((shop_ref, customer_code)): Path<(String, String)>,
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    info!("Customer WebSocket connection from: {}", addr);
    match resolve_shop_id(&state, &shop_ref).await {
        Ok(shop_id) => {
            let st = state.clone();
            ws.on_upgrade(move |socket| handle_customer_socket(socket, st, shop_id, customer_code))
        }
        Err(resp) => resp,
    }
}

async fn resolve_shop_id(state: &AppState, shop_ref: &str) -> Result<i64, Response> {
    match services::shop_utils::resolve_shop_id(&state.db_connection, shop_ref).await {
        Ok(Some(id)) => Ok(id),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(json!({"error":"shop_not_found","message":"No shop matches the provided identifier"})),
        )
            .into_response()),
        Err(err) => {
            error!("Failed to resolve shop identifier {}: {:?}", shop_ref, err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":"shop_lookup_failed","message":"Unable to resolve shop identifier"})),
            )
                .into_response())
        }
    }
}

async fn handle_staff_socket(socket: WebSocket, state: AppState, user_id: i64) {
    info!("🔌 开始处理 Staff WebSocket，用户 ID: {}", user_id);
    
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(msg).await.is_err() {
                break;
            }
        }
    });

    let chat_service = ChatService::new(&state);
    let mut connection_id: Option<String> = None;
    let mut active_shop: Option<i64> = None;

    info!("✅ Staff WebSocket 初始化完成，开始监听消息");

    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                debug!("📨 收到 Staff 文本消息: {}", &text[..text.len().min(100)]);
                match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                    Ok(incoming) => {
                        debug!("✅ 解析成功，消息类型: {}", incoming.message_type);
                        if let Err(err) = handle_staff_ws_message(
                            &state,
                            &chat_service,
                            user_id,
                            &tx,
                            &mut connection_id,
                            &mut active_shop,
                            incoming,
                        )
                        .await
                        {
                            warn!("⚠️ Staff WS 处理错误: {err:?}");
                        }
                    }
                    Err(err) => warn!("❌ 解析 Staff payload 失败: {err}"),
                }
            },
            Ok(Message::Close(_)) => {
                info!("👋 Staff 连接正常关闭");
                break;
            }
            Ok(msg) => {
                debug!("📬 收到其他类型消息: {:?}", msg);
            }
            Err(err) => {
                warn!("❌ Staff 连接错误: {err}");
                break;
            }
        }
    }
    
    info!("🔄 清理 Staff WebSocket 连接");

    if let Some(id) = connection_id {
        let mut manager = state.connections.lock().unwrap();
        manager.remove_connection(&id);
    }

    drop(tx);
    let _ = send_task.await;
}

async fn handle_customer_socket(
    socket: WebSocket,
    state: AppState,
    shop_id: i64,
    customer_code: String,
) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    let connection_id = {
        let mut manager = state.connections.lock().unwrap();
        manager.add_customer_connection(shop_id, &customer_code, tx.clone())
    };

    info!(
        "Customer connection established: {} (shop: {}, customer: {})",
        connection_id, shop_id, customer_code
    );

    let welcome = WebSocketMessage {
        message_type: crate::constants::ws_events::SYSTEM.to_string(),
        content: Some("欢迎使用客服系统！客服人员将为您服务。".to_string()),
        session_id: None,
        sender_id: None,
        sender_type: None,
        timestamp: Some(Utc::now()),
        metadata: None,
        file_url: None,
        file_name: None,
        file_size: None,
        media_duration: None,
    };
    if let Ok(payload) = serde_json::to_string(&welcome) {
        let _ = tx.send(Message::Text(payload));
    }

    let send_task = tokio::spawn(async move {
        while let Some(message) = rx.recv().await {
            if sender.send(message).await.is_err() {
                break;
            }
        }
    });

    let chat_service = ChatService::new(&state);
    let mut customer: Option<Customer> = None;
    let mut session: Option<Session> = None;

    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                eprintln!("📥 [Customer WS Loop] 收到文本消息: {}", &text[..text.len().min(100)]);
                eprintln!("🔍 [Customer WS Loop] 完整原始JSON: {}", text);
                match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                    Ok(incoming) => {
                        eprintln!("✅ [Customer WS Loop] 消息解析成功: type={}", incoming.message_type);
                        eprintln!("📋 [Customer WS Loop] 消息详情: content={:?}, metadata={:?}", 
                                incoming.content, incoming.metadata);
                        eprintln!("🎯 [Customer WS Loop] content字段长度: {}", 
                                incoming.content.as_ref().map(|c| c.len()).unwrap_or(0));
                        let mut ctx = CustomerWsCtx {
                            state: &state,
                            chat: &chat_service,
                            shop_id,
                            customer_code: &customer_code,
                            outbound: &tx,
                            customer: &mut customer,
                            session: &mut session,
                        };
                        if let Err(err) = handle_customer_ws_message(&mut ctx, incoming).await {
                            warn!("❌ Customer WS error: {err:?}");
                        }
                    }
                    Err(err) => {
                        warn!("❌ Invalid customer payload: {err}");
                        eprintln!("❌ [Customer WS Loop] 消息解析失败: {:?}, 原始消息: {}", err, text);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("Customer connection {} closed", connection_id);
                break;
            }
            Ok(msg) => {
                eprintln!("📥 [Customer WS Loop] 收到非文本消息: {:?}", msg);
            }
            Err(err) => {
                warn!("Customer connection error: {err}");
                break;
            }
        }
    }

    {
        let mut manager = state.connections.lock().unwrap();
        manager.remove_connection(&connection_id);
    }

    drop(tx);
    let _ = send_task.await;
}

/// 启动HTTPS服务器
async fn start_https_server(app: Router, server_config: &ServerConfig, tls_config: &TlsConfig) -> Result<()> {
    tls_config.print_info();
    
    let https_server = HttpsServer::new(tls_config.clone());
    
    // 验证HTTPS配置
    if let Err(e) = https_server.validate_config() {
        error!("HTTPS配置验证失败: {:?}", e);
        https_server.print_cert_help();
        return Err(anyhow::anyhow!("HTTPS配置验证失败: {:?}", e));
    }

    let https_addr: SocketAddr = server_config.https_addr().parse()
        .expect("Invalid HTTPS address");

    // 可选：启动HTTP到HTTPS重定向服务器
    if tls_config.redirect_http {
        let http_port = server_config.http_port;
        let https_port = server_config.https_port;
        tokio::spawn(async move {
            info!("🔄 启动HTTP到HTTPS重定向服务器...");
            if let Err(e) = start_http_redirect(https_port, http_port).await {
                error!("HTTP重定向服务器失败: {:?}", e);
            }
        });
    }

    // 启动HTTPS服务器
    info!("📡 正在绑定地址并启动服务器...");
    match https_server.serve(app, https_addr).await {
        Ok(_) => {
            info!("✅ HTTPS服务器正常退出");
            Ok(())
        }
        Err(e) => {
            error!("❌ HTTPS服务器启动失败: {:?}", e);
            Err(anyhow::anyhow!("HTTPS服务器启动失败: {:?}", e))
        }
    }
}

/// 启动HTTP服务器
async fn start_http_server(app: Router, server_config: &ServerConfig) -> Result<()> {
    let http_addr: SocketAddr = server_config.http_addr().parse()
        .expect("Invalid HTTP address");
    
    info!("🌐 HTTP服务器启动在: http://{}", http_addr);
    let listener = tokio::net::TcpListener::bind(http_addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    
    Ok(())
}

/// 智能启动服务器：优先尝试HTTPS，失败时回退到HTTP
async fn start_auto_server(app: Router, server_config: &ServerConfig, tls_config: &TlsConfig) -> Result<()> {
    info!("🤖 智能服务器模式：优先尝试HTTPS，失败时回退到HTTP");
    
    // 首先检查是否启用了HTTPS功能
    #[cfg(not(feature = "https"))]
    {
        warn!("🚨 HTTPS功能未启用，直接启动HTTP服务器");
        warn!("💡 如需HTTPS支持，请使用: cargo run --features https");
        start_http_server(app, server_config).await
    }
    
    #[cfg(feature = "https")]
    {
        // 首先尝试HTTPS
        info!("🔒 尝试启动HTTPS服务器...");
        
        // 检查证书文件是否存在
        let cert_exists = std::path::Path::new(&tls_config.cert_path).exists();
        let key_exists = std::path::Path::new(&tls_config.key_path).exists();
    
        info!("🔍 证书文件检查:");
        info!("  证书文件 {}: {}", tls_config.cert_path.display(), if cert_exists { "✅ 存在" } else { "❌ 不存在" });
        info!("  私钥文件 {}: {}", tls_config.key_path.display(), if key_exists { "✅ 存在" } else { "❌ 不存在" });
        
        if !cert_exists || !key_exists {
            warn!("🚨 证书文件不存在，回退到HTTP模式");
            return start_http_server(app, server_config).await;
        }
        
        // 尝试创建HTTPS服务器
        let https_server = HttpsServer::new(tls_config.clone());
        
        // 验证HTTPS配置
        if let Err(e) = https_server.validate_config() {
            warn!("🚨 HTTPS配置验证失败: {:?}", e);
            warn!("⬇️  回退到HTTP模式");
            return start_http_server(app, server_config).await;
        }
        
        let https_addr: SocketAddr = server_config.https_addr().parse()
            .expect("Invalid HTTPS address");
        
        // 尝试绑定HTTPS端口
        match tokio::net::TcpListener::bind(https_addr).await {
            Ok(_) => {
                info!("✅ HTTPS端口可用，继续启动HTTPS服务器");
                tls_config.print_info();
                
                // 启动HTTP到HTTPS重定向服务器
                if tls_config.redirect_http {
                    let http_port = server_config.http_port;
                    let https_port = server_config.https_port;
                    tokio::spawn(async move {
                        info!("🔄 启动HTTP到HTTPS重定向服务器...");
                        if let Err(e) = start_http_redirect(https_port, http_port).await {
                            error!("HTTP重定向服务器失败: {:?}", e);
                        }
                    });
                }
                
                // 启动HTTPS服务器
                match https_server.serve(app, https_addr).await {
                    Ok(_) => return Ok(()),
                    Err(e) => {
                        error!("HTTPS服务器运行失败: {:?}", e);
                        warn!("⬇️  HTTPS失败，回退到HTTP模式");
                        // 注意：app 已被移动，无法回退到HTTP。在生产环境中应该退出。
                        return Err(anyhow::anyhow!("HTTPS服务器启动失败: {:?}", e));
                    }
                }
            }
            Err(e) => {
                warn!("🚨 HTTPS端口绑定失败: {:?}", e);
                warn!("⬇️  回退到HTTP模式");
                return start_http_server(app, server_config).await;
            }
        }
    } // 关闭 #[cfg(feature = "https")] 块
}

// Note: helper functions for WS handling now live in `websocket.rs`
