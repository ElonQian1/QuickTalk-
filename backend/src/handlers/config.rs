use axum::{
    extract::{ConnectInfo, State},
    response::Json,
    http::HeaderMap,
};
use serde_json::{json, Value};
use std::net::SocketAddr;

use crate::AppState;

/// 获取服务器配置信息
/// 返回当前服务器的地址信息，供前端自动配置使用
pub async fn get_server_config(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    State(_state): State<AppState>,
) -> Json<Value> {
    // 获取环境变量配置
    let server_host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "localhost".to_string());
    let server_port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    
    // 尝试从请求头获取实际的主机信息
    let host_from_header = headers
        .get("host")
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_string());
    
    // 尝试从X-Forwarded-Host获取代理后的主机信息
    let forwarded_host = headers
        .get("x-forwarded-host")
        .and_then(|h| h.to_str().ok())
        .map(|h| h.to_string());
    
    // 获取协议信息
    let protocol = if headers
        .get("x-forwarded-proto")
        .and_then(|h| h.to_str().ok())
        .map(|p| p == "https")
        .unwrap_or(false)
    {
        "https"
    } else {
        "http"
    };
    
    // 智能推断最佳服务器地址
    let best_server_url = if let Some(ref forwarded) = forwarded_host {
        // 如果有代理转发的主机信息，优先使用
        format!("{}://{}", protocol, forwarded)
    } else if let Some(ref host) = host_from_header {
        // 使用请求头中的主机信息
        format!("{}://{}", protocol, host)
    } else if server_host == "0.0.0.0" {
        // 如果配置的是0.0.0.0，根据实际情况推断
        let actual_host = if addr.ip().is_loopback() {
            "localhost"
        } else {
            &server_host
        };
        format!("{}://{}:{}", protocol, actual_host, server_port)
    } else {
        // 使用配置的主机和端口
        format!("{}://{}:{}", protocol, server_host, server_port)
    };
    
    // 生成WebSocket URL
    let ws_protocol = if protocol == "https" { "wss" } else { "ws" };
    let ws_url = best_server_url.replace(protocol, ws_protocol);
    
    Json(json!({
        "version": "1.2.0",
        "serverUrl": best_server_url,
        "wsUrl": ws_url,
        "config": {
            "protocol": protocol,
            "wsProtocol": ws_protocol,
            "configuredHost": server_host,
            "configuredPort": server_port,
            "detectedHost": host_from_header,
            "forwardedHost": forwarded_host,
            "clientIp": addr.ip().to_string()
        },
        "endpoints": {
            "api": format!("{}/api", best_server_url),
            "websocket": {
                "customer": format!("{}/ws/customer", ws_url),
                "staff": format!("{}/ws/staff", ws_url)
            },
            "upload": format!("{}/api/customer/upload", best_server_url)
        },
        "timestamp": chrono::Utc::now().timestamp()
    }))
}

/// 获取SDK版本信息（兼容现有版本检查）
pub async fn get_sdk_version() -> Json<Value> {
    Json(json!({
        "version": "1.2.0",
        "buildTime": chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        "features": [
            "auto-server-detection",
            "multi-protocol-support",
            "proxy-aware",
            "voice-messages",
            "file-upload"
        ]
    }))
}