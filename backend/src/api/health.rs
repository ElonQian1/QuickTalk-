use axum::{extract::{State, Path}, response::Json};
use std::sync::Arc;
use chrono::Utc;
use sqlx::Row;

use crate::{AppState, ApiResponse, EmbedConfig, EmbedTheme, EmbedLimits, EmbedSecurity};

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
) -> Json<ApiResponse<EmbedConfig>> {
    let shop_name: String = match sqlx::query("SELECT name FROM shops WHERE id = ?")
        .bind(&shop_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => row.get("name"),
        Err(_) => "QuickTalk Shop".to_string(),
    };

    let cfg = EmbedConfig {
        version: "2.0.0".into(),
        shop_id: shop_id.clone(),
        shop_name,
        websocket_url: "ws://localhost:3030/ws".into(),
        features: vec!["chat".into(), "typing".into(), "reconnect".into()],
        theme: EmbedTheme { color: Some("#667eea".into()) },
        limits: EmbedLimits { max_messages_per_minute: Some(120) },
        security: EmbedSecurity { domain_whitelist: Some(vec!["localhost".into()]) },
    };

    Json(ApiResponse { success: true, data: Some(cfg), message: "ok".into() })
}
