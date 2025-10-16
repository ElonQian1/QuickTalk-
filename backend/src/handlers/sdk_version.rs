// SDK版本管理API
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
pub struct SDKVersion {
    pub version: String,
    pub release_date: String,
    pub download_url: String,
    pub features: Vec<String>,
    pub breaking: Option<bool>,
}

#[derive(Serialize, Clone)]
pub struct VersionResponse {
    pub version: String,
    pub release_date: String,
    pub download_url: String,
    pub features: Vec<String>,
    pub breaking: bool,
    pub current_url: String,
}

pub fn sdk_version_routes() -> Router {
    Router::new()
        .route("/api/sdk/version", axum::routing::get(get_latest_version))
        .route("/api/sdk/version/:version", axum::routing::get(get_specific_version))
}

/// 获取最新SDK版本信息
pub async fn get_latest_version() -> Result<Json<VersionResponse>, StatusCode> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    // 在实际环境中，这些信息可能来自数据库或配置文件
    let version_info = VersionResponse {
        version: "2.1.0".to_string(), // 硬编码为我们刚更新的版本
        release_date: "2025-10-16".to_string(),
        download_url: "/static/embed/service-standalone.js".to_string(),
        features: vec![
            "智能服务器地址检测".to_string(),
            "自动重连和心跳机制".to_string(),
            "自动版本更新".to_string(),
            "改进的文件名显示".to_string(),
        ],
        breaking: false, // 非破坏性更新
        current_url: "/static/embed/service-standalone.js".to_string(),
    };

    Ok(Json(version_info))
}

/// 获取特定版本信息
pub async fn get_specific_version(
    Path(version): Path<String>,
) -> Result<Json<VersionResponse>, StatusCode> {
    // 版本历史记录（实际应用中可能存储在数据库中）
    let versions = get_version_history();
    
    if let Some(version_info) = versions.get(&version) {
        Ok(Json(version_info.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// 获取版本历史记录
fn get_version_history() -> HashMap<String, VersionResponse> {
    let mut versions = HashMap::new();
    
    // 当前版本
    versions.insert("2.1.0".to_string(), VersionResponse {
        version: "2.1.0".to_string(),
        release_date: "2025-10-16".to_string(),
        download_url: "/static/embed/service-standalone.js".to_string(),
        features: vec![
            "智能服务器地址检测".to_string(),
            "自动重连和心跳机制".to_string(),
            "自动版本更新".to_string(),
            "改进的文件名显示".to_string(),
        ],
        breaking: false,
        current_url: "/static/embed/service-standalone.js".to_string(),
    });
    
    // 历史版本
    versions.insert("2.0.0".to_string(), VersionResponse {
        version: "2.0.0".to_string(),
        release_date: "2025-10-15".to_string(),
        download_url: "/static/embed/service-standalone.js".to_string(),
        features: vec![
            "WebSocket连接稳定性改进".to_string(),
            "消息类型处理优化".to_string(),
        ],
        breaking: false,
        current_url: "/static/embed/service-standalone.js".to_string(),
    });
    
    versions
}