use axum::{extract::{State, Path}, response::Json, http::HeaderMap};
use std::sync::Arc;
use chrono::Utc;
use sqlx::Row;

use crate::bootstrap::app_state::AppState;
use crate::types::ApiResponse;
use crate::types::dto::embed::{EmbedConfig, EmbedTheme, EmbedLimits, EmbedSecurity};

pub async fn health_check() -> Json<ApiResponse<serde_json::Value>> {
    Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({
            "status": "ok",
            "timestamp": Utc::now(),
        })),
        message: "healthy".into(),
    })
}

pub async fn get_embed_config(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    headers: HeaderMap,
) -> Json<ApiResponse<EmbedConfig>> {
    // 读取店铺名称与域名
    let (shop_name, shop_domain): (String, Option<String>) = match sqlx::query("SELECT name, domain FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => (row.get("name"), row.try_get("domain").ok()),
        Err(_) => ("QuickTalk Shop".to_string(), None),
    };

    // 构造域名白名单：包含店铺域名（如有）与 localhost
    let mut whitelist = vec!["localhost".to_string()];
    if let Some(d) = shop_domain.as_ref() {
        if !d.trim().is_empty() { whitelist.push(d.trim().to_string()); }
    }

    // 推断 server_origin 与 websocket_path
    let host = headers.get("x-forwarded-host").and_then(|v| v.to_str().ok())
        .or_else(|| headers.get("host").and_then(|v| v.to_str().ok()))
        .unwrap_or("localhost:3030");
    let proto = headers.get("x-forwarded-proto").and_then(|v| v.to_str().ok())
        .unwrap_or("http");
    let server_origin = Some(format!("{}://{}", proto, host));
    let websocket_path = Some("/ws".to_string());

    let cfg = EmbedConfig {
        version: "2.0.0".into(),
        shop_id: shop_id.clone(),
        shop_name,
        websocket_url: "".into(), // 由前端自动推导，或由 server 侧注入
        server_origin,
        websocket_path,
        features: vec!["chat".into(), "typing".into(), "reconnect".into()],
        theme: EmbedTheme { color: Some("#667eea".into()) },
        limits: EmbedLimits { max_messages_per_minute: Some(120) },
        security: EmbedSecurity { domain_whitelist: Some(whitelist) },
    };

    Json(ApiResponse { success: true, data: Some(cfg), message: "ok".into() })
}
