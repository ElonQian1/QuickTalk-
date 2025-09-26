use axum::{ http::{StatusCode, HeaderMap}, response::Json };
use sqlx::{SqlitePool, Row};
use tracing::{info, error};
mod bootstrap;
mod web; mod ws; mod api; mod types; use types::*;
mod domain; // expose domain module inside binary
mod db;     // expose db (conversation repo)
mod application; // new application layer (use cases)
mod auth;
use bootstrap::settings::Settings;
// 复用 web.rs 中的探测逻辑（重新实现轻量版，避免循环依赖）
async fn probe_static(pages: &[(&str,&[&str])]) {
    for (label, candidates) in pages {
        for p in *candidates {
            if tokio::fs::metadata(p).await.is_ok() { info!(target="startup", page=%label, path=%p, "static page located"); break; }
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();
    
    // 加载环境变量
    dotenv::dotenv().ok();
    
    info!("🦀 正在启动 QuickTalk 纯 Rust 服务器...");
    
    // 加载配置
    let settings = Settings::load();
    info!(?settings, "加载配置完成");

    // 连接数据库
    info!("正在连接数据库: {}", settings.database_url);
    let db = SqlitePool::connect(&settings.database_url).await?;

    // CLI 维护命令：--purge-shops 仅用于本地一次性清空历史店铺
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|a| a == "--purge-shops") {
        info!("⚠️ 执行维护操作: 级联清空与 shops 相关业务数据 (messages -> conversations -> payment_orders -> activation_orders -> shops)");
        let mut tx = db.begin().await?;
        // 按外键依赖顺序删除，避免 FOREIGN KEY constraint failed
        let deleted_messages = sqlx::query("DELETE FROM messages").execute(&mut *tx).await?.rows_affected();
        let deleted_conversations = sqlx::query("DELETE FROM conversations").execute(&mut *tx).await?.rows_affected();
        let deleted_payment_orders = sqlx::query("DELETE FROM payment_orders").execute(&mut *tx).await?.rows_affected();
        let deleted_activation_orders = sqlx::query("DELETE FROM activation_orders").execute(&mut *tx).await?.rows_affected();
        let deleted_shops = sqlx::query("DELETE FROM shops").execute(&mut *tx).await?.rows_affected();
        tx.commit().await?;
        info!(deleted_messages, deleted_conversations, deleted_payment_orders, deleted_activation_orders, deleted_shops, "完成关联数据与 shops 清空");
        info!("✅ 清理完成：可安全重新创建店铺，历史污染数据已移除");
        return Ok(()); // 不继续启动服务器
    }
    
    // 初始化数据库 schema
    bootstrap::migrations::run_migrations(&db).await?;
    
    // 构建应用（通过 bootstrap 模块）
    let app = bootstrap::router::build_app(db).await;

    // 启动前调试：记录关键静态页面解析路径
    #[cfg(debug_assertions)]
    probe_static(&[
        ("mobile-login", &["presentation/static/mobile-login.html", "../presentation/static/mobile-login.html", "./static/mobile-login.html"][..]),
        ("mobile-dashboard", &["presentation/static/mobile-dashboard.html", "../presentation/static/mobile-dashboard.html", "./static/mobile-dashboard.html"][..]),
        ("mobile-admin", &["presentation/static/mobile-admin.html", "../presentation/static/mobile-admin.html", "./static/mobile-admin.html"][..]),
    ]).await;
    
    // 启动服务器
    let addr = format!("{}:{}", settings.host, settings.port);
    
    info!("🚀 QuickTalk 纯 Rust 服务器正在启动，监听地址: {}", addr);
    let port_display = settings.port;
    info!("📱 主界面: http://localhost:{}/", port_display);
    info!("🔧 管理后台: http://localhost:{}/admin", port_display);
    info!("📱 移动端管理: http://localhost:{}/mobile/admin", port_display);
    info!("📊 移动端控制台: http://localhost:{}/mobile/dashboard", port_display);
    info!("🔐 移动端登录: http://localhost:{}/mobile/login", port_display);
    info!("🔌 WebSocket 接口: ws://localhost:{}/ws", port_display);
    info!("📊 健康检查: http://localhost:{}/api/health", port_display);
    info!("📄 API 文档: 所有端点均在 /api/ 路径下可用");
    info!("🎯 特性: 纯 Rust 架构，无 Node.js 依赖，完整 WebSocket 支持");
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

// 基于 sessions 的鉴权：从 Header 获取 Session，并返回 admin_id
#[allow(dead_code)]
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