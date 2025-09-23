use axum::{
    http::{StatusCode, HeaderMap},
    response::Json,
    routing::{get, post, delete, put},
    Router,
};
use crate::api::admin::{admin_login, admin_register, get_account_stats, recover_super_admin};
use crate::api::conversations::{get_conversations, get_messages, search_conversations, create_conversation, get_conversation_details, update_conversation_status, get_conversation_summary, send_message, update_message, delete_message};
use crate::api::uploads::{upload_file, list_uploaded_files};
use crate::api::employees::{
    get_employees, add_employee, remove_employee, update_employee_role, search_users,
    get_user_profile, invite_employee, get_employee_invitations, accept_invitation,
    reject_invitation,
};
use crate::api::integrations::generate_integration_code;
use crate::api::payments::{generate_activation_payment_qr, get_activation_order_status, mock_activation_payment_success};
use crate::api::shops::{
    search_shops, check_domain, delete_shop, rotate_api_key, get_shops, create_shop, update_shop, get_shop_details,
    approve_shop, reject_shop, activate_shop, deactivate_shop, create_shop_activation_order
};
use crate::api::system::{fix_shop_owners, validate_shop_data_integrity, clean_test_data, force_clean_shops, reset_database, create_test_user};
use sqlx::{SqlitePool, Row};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing::{info, warn, error, debug};
use tokio::sync::broadcast;

// 模块化拆分：网页渲染与嵌入资源、WebSocket 处理
mod web;
mod ws;
mod api;
mod types;
use types::*;

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
    .route("/", get(web::serve_index))
    .route("/admin", get(web::serve_admin))
    .route("/mobile/admin", get(web::serve_mobile_admin))
    .route("/mobile/dashboard", get(web::serve_mobile_dashboard))
    .route("/mobile/login", get(web::serve_mobile_login))
        
        // WebSocket
    .route("/ws", get(ws::websocket_handler))
        
        // API 路由 - 健康检查
    .route("/api/health", get(api::health::health_check))
        
        // Embed系统 API
    .route("/embed/config/:shop_id", get(api::health::get_embed_config))
    .route("/embed/service.js", get(web::serve_embed_service))
    .route("/embed/styles.css", get(web::serve_embed_styles))
        
        // 商店管理 API
    .route("/api/shops", get(get_shops).post(create_shop))
    .route("/api/shops/search", get(search_shops))
    .route("/api/shops/check-domain", get(check_domain))
        .route("/api/shops/:id", get(get_shop_details).put(update_shop).delete(delete_shop))
    .route("/api/shops/:id/rotate-api-key", post(rotate_api_key))
        .route("/api/shops/:id/approve", post(approve_shop))
        .route("/api/shops/:id/reject", post(reject_shop))
        .route("/api/shops/:id/activate", post(activate_shop))
        .route("/api/shops/:id/deactivate", post(deactivate_shop))
        .route("/api/shops/:id/activation-order", post(create_shop_activation_order))
        .route("/api/shops/:shop_id/employees", get(get_employees).post(add_employee))
        .route("/api/shops/:shop_id/employees/:employee_id", delete(remove_employee).put(update_employee_role))
        .route("/api/users/search", get(search_users))
        .route("/api/users/:user_id", get(get_user_profile))
        .route("/api/shops/:shop_id/invitations", get(get_employee_invitations).post(invite_employee))
        .route("/api/invitations/:token/accept", post(accept_invitation))
        .route("/api/invitations/:token/reject", post(reject_invitation))
        
        // 集成代码生成
        .route("/api/integrations/generate", post(generate_integration_code))

        // 支付API
        .route("/api/payments/activation/qr", post(generate_activation_payment_qr))
        .route("/api/payments/activation/status", get(get_activation_order_status))
        .route("/api/payments/activation/mock-success", post(mock_activation_payment_success))

        // 对话 API
        .route("/api/conversations", get(get_conversations).post(create_conversation))
        .route("/api/conversations/search", get(search_conversations))
        .route("/api/conversations/:id", get(get_conversation_details))
        .route("/api/conversations/:id/messages", get(get_messages).post(send_message))
        .route("/api/conversations/:id/messages/:message_id", put(update_message).delete(delete_message))
        .route("/api/conversations/:id/status", put(update_conversation_status))
        .route("/api/conversations/:id/summary", get(get_conversation_summary))

        // 文件上传 API
        .route("/api/upload", post(upload_file))
        .route("/api/uploads", get(list_uploaded_files))

        // 管理员认证与系统管理 API
        .route("/api/admin/login", post(admin_login))
        .route("/api/admin/register", post(admin_register))
        .route("/api/admin/stats", get(get_account_stats))
        .route("/api/admin/recover-super-admin", post(recover_super_admin))
        .route("/api/system/fix-owners", post(fix_shop_owners))
        .route("/api/system/validate", get(validate_shop_data_integrity))
        .route("/api/system/clean-test-data", post(clean_test_data))
        .route("/api/system/force-clean-shops", post(force_clean_shops))
        .route("/api/system/reset-database", post(reset_database))
        .route("/api/system/create-test-user", post(create_test_user))
        .route("/api/auth/login", post(admin_login))
        .route("/api/auth/register", post(admin_register))
        
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
    
    // 创建管理员表（role 支持：super_admin/admin/owner 等）
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