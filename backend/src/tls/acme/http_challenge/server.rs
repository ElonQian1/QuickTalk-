// backend/src/tls/acme/http_challenge/server.rs
// HTTP-01 Challenge Server
// Purpose: Lightweight HTTP server for ACME HTTP-01 validation on port 80
// Input: Challenge tokens via shared storage
// Output: HTTP responses to /.well-known/acme-challenge/{token}
// Errors: Port binding failures, server startup errors

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use std::sync::Arc;
use tokio::net::TcpListener;
use anyhow::{Context, Result};

use super::{ChallengeStorage, HttpChallengeHandler};

/// HTTP-01 Challenge Server
pub struct HttpChallengeServer {
    storage: Arc<ChallengeStorage>,
    port: u16,
}

impl HttpChallengeServer {
    /// Create new HTTP challenge server
    pub fn new(storage: ChallengeStorage, port: u16) -> Self {
        Self {
            storage: Arc::new(storage),
            port,
        }
    }
    
    /// Start the HTTP challenge server
    /// This will run in the background and handle ACME HTTP-01 challenges
    pub async fn start(self) -> Result<()> {
        let app = Router::new()
            .route("/.well-known/acme-challenge/:token", get(handle_challenge))
            .route("/.well-known/pki-validation/:file", get(handle_tencent_validation))
            .with_state(self.storage.clone());
        
        let addr = format!("0.0.0.0:{}", self.port);
        tracing::info!("🌐 HTTP-01 挑战服务器启动在: {}", addr);
        tracing::info!("   支持路径:");
        tracing::info!("   - /.well-known/acme-challenge/{{token}}  (ACME HTTP-01)");
        tracing::info!("   - /.well-known/pki-validation/{{file}}   (腾讯云文件验证)");
        
        let listener = TcpListener::bind(&addr)
            .await
            .context(format!("绑定端口 {} 失败，请确保端口未被占用且有权限", self.port))?;
        
        axum::serve(listener, app)
            .await
            .context("HTTP-01 服务器运行失败")?;
        
        Ok(())
    }
    
    /// Start the server in background (non-blocking)
    pub fn start_background(self) -> tokio::task::JoinHandle<Result<()>> {
        tokio::spawn(async move {
            self.start().await
        })
    }
}

/// Handle ACME HTTP-01 challenge request
async fn handle_challenge(
    Path(token): Path<String>,
    State(storage): State<Arc<ChallengeStorage>>,
) -> impl IntoResponse {
    tracing::debug!("收到 HTTP-01 挑战请求: token={}", token);
    
    match storage.get_challenge(&token).await {
        Some(key_auth) => {
            tracing::info!("✅ 返回 HTTP-01 挑战响应: token={}", token);
            (StatusCode::OK, key_auth)
        }
        None => {
            tracing::warn!("❌ 未找到 HTTP-01 挑战: token={}", token);
            (StatusCode::NOT_FOUND, "Challenge not found".to_string())
        }
    }
}

/// Handle Tencent Cloud file validation (optional feature)
async fn handle_tencent_validation(
    Path(filename): Path<String>,
) -> impl IntoResponse {
    tracing::debug!("收到腾讯云文件验证请求: file={}", filename);
    
    // Try to read from pki-validation directory
    let file_path = format!("./pki-validation/{}", filename);
    
    match tokio::fs::read_to_string(&file_path).await {
        Ok(content) => {
            tracing::info!("✅ 返回腾讯云验证文件: {}", filename);
            (StatusCode::OK, content)
        }
        Err(_) => {
            tracing::warn!("❌ 未找到腾讯云验证文件: {}", filename);
            (StatusCode::NOT_FOUND, "File not found".to_string())
        }
    }
}
