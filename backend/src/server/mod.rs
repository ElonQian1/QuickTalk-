// 服务器模块 - HTTP和HTTPS服务器管理
// Purpose: 统一的服务器接口和协议选择
// Input: 应用路由、服务器配置
// Output: 启动的HTTP/HTTPS服务器
// Errors: 服务器启动失败、端口绑定错误

pub mod https;

pub use https::*;
use axum::Router;
use std::net::SocketAddr;

/// 服务器类型枚举
#[derive(Debug, Clone)]
pub enum ServerType {
    Http,
    Https,
    Auto, // 智能模式：优先HTTPS，失败时回退到HTTP
}

/// 服务器配置
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub http_port: u16,
    pub https_port: u16,
    pub server_type: ServerType,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            http_port: 8080,
            https_port: 8443,
            server_type: ServerType::Http,
        }
    }
}

impl ServerConfig {
    /// 从环境变量创建服务器配置
    pub fn from_env() -> Self {
        let host = std::env::var("SERVER_HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_string());
        
        let http_port = std::env::var("SERVER_PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse()
            .unwrap_or(8080);

        let https_port = std::env::var("TLS_PORT")
            .unwrap_or_else(|_| "8443".to_string())
            .parse()
            .unwrap_or(8443);

        let tls_mode = std::env::var("TLS_MODE")
            .unwrap_or_else(|_| "auto".to_string())
            .to_lowercase();

        let server_type = match tls_mode.as_str() {
            "true" | "https" | "force" => ServerType::Https,
            "false" | "http" | "disabled" => ServerType::Http,
            "auto" | "smart" | _ => ServerType::Auto,
        };

        Self {
            host,
            http_port,
            https_port,
            server_type,
        }
    }

    /// 获取HTTP地址
    pub fn http_addr(&self) -> String {
        format!("{}:{}", self.host, self.http_port)
    }

    /// 获取HTTPS地址
    pub fn https_addr(&self) -> String {
        format!("{}:{}", self.host, self.https_port)
    }

    /// 打印服务器配置信息
    pub fn print_info(&self) {
        println!("🚀 服务器配置:");
        println!("  🌐 主机: {}", self.host);
        match self.server_type {
            ServerType::Http => {
                println!("  📡 HTTP端口: {}", self.http_port);
                println!("  🔓 协议: HTTP");
            }
            ServerType::Https => {
                println!("  📡 HTTPS端口: {}", self.https_port);
                println!("  🔒 协议: HTTPS");
            }
            ServerType::Auto => {
                println!("  📡 HTTP端口: {} (备用)", self.http_port);
                println!("  📡 HTTPS端口: {} (优先)", self.https_port);
                println!("  🤖 协议: 智能模式 (优先HTTPS，失败时回退HTTP)");
            }
        }
    }
}

/// HTTP到HTTPS重定向服务器
#[cfg(feature = "https")]
pub async fn start_http_redirect(https_port: u16, http_port: u16) -> Result<(), crate::error::AppError> {
    use axum::{response::Redirect, routing::any, extract::Request};
    use tracing::info;
    
    let redirect_app = Router::new()
        .fallback(any(move |request: Request| async move {
            let host = request.headers()
                .get("host")
                .and_then(|h| h.to_str().ok())
                .unwrap_or("localhost");
            
            // 移除端口号，只保留主机名
            let host = host.split(':').next().unwrap_or("localhost");
            
            let redirect_url = format!("https://{}:{}{}", 
                host,
                https_port,
                request.uri().path_and_query().map(|pq| pq.as_str()).unwrap_or("/")
            );
            
            info!("🔄 HTTP请求重定向: {} -> {}", request.uri(), redirect_url);
            Redirect::permanent(&redirect_url)
        }));
    
    let addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    info!("🔄 HTTP重定向服务器启动在: http://{}", addr);
    info!("   所有HTTP请求将重定向到: https://localhost:{}", https_port);
    
    axum_server::bind(addr)
        .serve(redirect_app.into_make_service())
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("HTTP重定向服务器失败: {}", e)))?;
    
    Ok(())
}

#[cfg(not(feature = "https"))]
pub async fn start_http_redirect(_https_port: u16, _http_port: u16) -> Result<(), crate::error::AppError> {
    Err(crate::error::AppError::Internal("HTTPS功能未启用，无法启动重定向服务器".to_string()))
}