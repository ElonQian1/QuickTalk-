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
use tracing::{error, info, warn};

mod auth;
mod constants;
mod database;
mod database_orm;
mod entities;
mod error;
mod handlers;
mod jwt;
mod migration;
mod models;
mod repositories;
mod server;
mod services;
mod tls;
mod websocket;

use database::Database;
use models::{Customer, Session, WebSocketIncomingMessage, WebSocketMessage};
use server::{HttpsServer, ServerConfig, ServerType, start_http_redirect};
use services::chat::ChatService;
use tls::TlsConfig;
use websocket::ConnectionManager;
use websocket::{handle_customer_ws_message, handle_staff_ws_message, CustomerWsCtx};

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
    tracing_subscriber::fmt::init();

    // 加载 .env（如果存在）
    let _ = dotenvy::dotenv();
    
    // 初始化数据库
    let db_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./customer_service.db".to_string());
    
    // 🔥 方式1: 使用旧的 sqlx Database（向后兼容）
    let db = Database::new(&db_url).await?;
    
    // 🚀 方式2: 使用新的 Sea-ORM Database
    info!("🔌 Initializing Sea-ORM connection...");
    let db_orm = database_orm::Database::new(&db_url).await?;
    
    // 🔄 数据库迁移处理 - 支持完全跳过
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
    
    let connections = Arc::new(Mutex::new(ConnectionManager::new()));

    // 创建 Services 实例 - 使用 Sea-ORM DatabaseConnection
    let user_service = services::UserService::new(db_orm.get_connection().clone());
    let shop_service = services::ShopService::new(db_orm.get_connection().clone());
    let customer_service = services::CustomerService::new(db_orm.get_connection().clone());
    let session_service = services::SessionService::new(db_orm.get_connection().clone());
    let message_service = services::MessageService::new(db_orm.get_connection().clone());

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

    // 打印配置信息
    server_config.print_info();

    // 根据配置启动对应的服务器
    match server_config.server_type {
        ServerType::Https => {
            // 强制HTTPS模式
            start_https_server(app, &server_config, &tls_config).await?;
        }
        ServerType::Http => {
            // 强制HTTP模式
            start_http_server(app, &server_config).await?;
        }
        ServerType::Auto => {
            // 智能模式：优先HTTPS，失败时回退到HTTP
            start_auto_server(app, &server_config, &tls_config).await?;
        }
    }

    Ok(())
}

/// 创建应用路由
fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(handlers::static_files::serve_index))
        .route("/health", get(|| async { axum::Json(serde_json::json!({"status":"ok"})) }))
        .route("/api/auth/login", post(handlers::auth::login))
        .route("/api/auth/register", post(handlers::auth::register))
        .route("/api/shops", get(handlers::shop::get_shops))
        .route("/api/shops", post(handlers::shop::create_shop))
    .route("/api/staff/shops", get(handlers::shop::get_staff_shops))
        .route(
            "/api/shops/:shop_id/customers",
            get(handlers::customer::get_customers),
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
        .route("/api/sdk/version", get(handlers::config::get_sdk_version))
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

    while let Some(result) = receiver.next().await {
        match result {
            Ok(Message::Text(text)) => match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                Ok(incoming) => {
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
                        warn!("Staff WS error: {err:?}");
                    }
                }
                Err(err) => warn!("Invalid staff payload: {err}"),
            },
            Ok(Message::Close(_)) => {
                info!("Staff connection closed");
                break;
            }
            Ok(_) => {}
            Err(err) => {
                warn!("Staff connection error: {err}");
                break;
            }
        }
    }

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
            Ok(Message::Text(text)) => match serde_json::from_str::<WebSocketIncomingMessage>(&text) {
                Ok(incoming) => {
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
                        warn!("Customer WS error: {err:?}");
                    }
                }
                Err(err) => warn!("Invalid customer payload: {err}"),
            },
            Ok(Message::Close(_)) => {
                info!("Customer connection {} closed", connection_id);
                break;
            }
            Ok(_) => {}
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
    if let Err(e) = https_server.serve(app, https_addr).await {
        return Err(anyhow::anyhow!("HTTPS服务器启动失败: {:?}", e));
    }
    
    Ok(())
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
