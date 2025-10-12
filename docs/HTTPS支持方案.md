# HTTPS 支持方案 - 独立模块化实现

> **目标**: 为现有项目添加独立的HTTPS支持模块  
> **环境**: Windows 11 开发 + Ubuntu 交叉编译  
> **特点**: 可选启用、零破坏性集成、生产就绪  
> **更新时间**: 2025年10月12日

## 🎯 设计原则

### 1. **独立模块设计**
- HTTPS作为可选功能模块
- 不影响现有HTTP功能
- 运行时动态选择协议

### 2. **零破坏性集成**
- 现有代码无需修改
- 配置驱动的协议选择
- 向后兼容HTTP部署

### 3. **交叉编译兼容**
- 避免OpenSSL依赖问题
- 使用Rust原生TLS实现
- Windows到Ubuntu编译无障碍

## 🛠️ 技术方案

### 方案A: Rustls (推荐)
```toml
# backend/Cargo.toml 新增依赖
[dependencies]
# HTTPS 模块依赖
rustls = "0.21"
rustls-pemfile = "1.0"
axum-server = { version = "0.5", features = ["tls-rustls"] }
tower = "0.4"
tower-http = { version = "0.4", features = ["cors", "fs"] }

# 现有依赖保持不变
axum = "0.6"
tokio = { version = "1.0", features = ["full"] }
sqlx = { version = "0.7", features = ["sqlite", "chrono", "uuid", "macros"], default-features = false }
libsqlite3-sys = { version = "0.27", features = ["bundled"] }
```

### 方案B: native-tls (备选)
```toml
# 如果需要系统TLS支持
axum-server = { version = "0.5", features = ["tls-native-tls"] }
native-tls = "0.2"
```

## 📁 项目结构调整

```
backend/src/
├── main.rs              # 主入口，协议选择逻辑
├── server/
│   ├── mod.rs           # 服务器模块导出
│   ├── http.rs          # HTTP 服务器 (现有)
│   ├── https.rs         # HTTPS 服务器 (新增)
│   └── config.rs        # 服务器配置
├── tls/
│   ├── mod.rs           # TLS模块导出
│   ├── cert_manager.rs  # 证书管理
│   ├── config.rs        # TLS配置
│   └── utils.rs         # TLS工具函数
└── ...                  # 现有模块保持不变
```

## 🔧 实现步骤

### 步骤1: 添加TLS模块

创建 `backend/src/tls/mod.rs`:
```rust
pub mod cert_manager;
pub mod config;
pub mod utils;

pub use cert_manager::*;
pub use config::*;
pub use utils::*;
```

创建 `backend/src/tls/config.rs`:
```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    pub enabled: bool,
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    pub port: u16,
    pub redirect_http: bool,
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cert_path: "cert.pem".into(),
            key_path: "key.pem".into(),
            port: 8443,
            redirect_http: true,
        }
    }
}

impl TlsConfig {
    pub fn from_env() -> Self {
        Self {
            enabled: std::env::var("TLS_ENABLED")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            cert_path: std::env::var("TLS_CERT_PATH")
                .unwrap_or_else(|_| "cert.pem".to_string())
                .into(),
            key_path: std::env::var("TLS_KEY_PATH")
                .unwrap_or_else(|_| "key.pem".to_string())
                .into(),
            port: std::env::var("TLS_PORT")
                .unwrap_or_else(|_| "8443".to_string())
                .parse()
                .unwrap_or(8443),
            redirect_http: std::env::var("TLS_REDIRECT_HTTP")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        }
    }
}
```

创建 `backend/src/tls/cert_manager.rs`:
```rust
use crate::error::AppError;
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;

pub struct CertManager;

impl CertManager {
    /// 从PEM文件加载TLS配置
    pub fn load_tls_config<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
    ) -> Result<Arc<ServerConfig>, AppError> {
        // 读取证书文件
        let cert_file = File::open(&cert_path)
            .map_err(|e| AppError::Internal(&format!("无法打开证书文件: {}", e)))?;
        let mut cert_reader = BufReader::new(cert_file);
        
        let cert_chain = certs(&mut cert_reader)
            .map_err(|e| AppError::Internal(&format!("无法解析证书: {}", e)))?
            .into_iter()
            .map(Certificate)
            .collect();

        // 读取私钥文件
        let key_file = File::open(&key_path)
            .map_err(|e| AppError::Internal(&format!("无法打开私钥文件: {}", e)))?;
        let mut key_reader = BufReader::new(key_file);
        
        let mut keys = pkcs8_private_keys(&mut key_reader)
            .map_err(|e| AppError::Internal(&format!("无法解析私钥: {}", e)))?;

        if keys.is_empty() {
            return Err(AppError::Internal("未找到有效的私钥"));
        }

        let private_key = PrivateKey(keys.remove(0));

        // 创建TLS配置
        let config = ServerConfig::builder()
            .with_safe_defaults()
            .with_no_client_auth()
            .with_single_cert(cert_chain, private_key)
            .map_err(|e| AppError::Internal(&format!("TLS配置错误: {}", e)))?;

        Ok(Arc::new(config))
    }

    /// 生成自签名证书 (开发环境)
    pub fn generate_self_signed_cert<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
        domain: &str,
    ) -> Result<(), AppError> {
        // 这里可以集成 rcgen 库来生成自签名证书
        // 为简化示例，暂时提供手动生成指引
        
        println!("📋 生成自签名证书 (开发环境):");
        println!("openssl req -x509 -newkey rsa:4096 -keyout {} -out {} -days 365 -nodes -subj '/CN={}'", 
            key_path.as_ref().display(), 
            cert_path.as_ref().display(), 
            domain
        );
        
        Err(AppError::Internal("请手动生成证书或使用现有证书"))
    }
}
```

### 步骤2: 创建HTTPS服务器模块

创建 `backend/src/server/mod.rs`:
```rust
pub mod http;
pub mod https;
pub mod config;

pub use http::*;
pub use https::*;
pub use config::*;
```

创建 `backend/src/server/https.rs`:
```rust
use crate::tls::{CertManager, TlsConfig};
use crate::error::AppError;
use axum::Router;
use axum_server::tls_rustls::RustlsConfig;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::cors::CorsLayer;

pub struct HttpsServer {
    config: TlsConfig,
}

impl HttpsServer {
    pub fn new(config: TlsConfig) -> Self {
        Self { config }
    }

    pub async fn serve(
        &self,
        app: Router,
        addr: SocketAddr,
    ) -> Result<(), AppError> {
        if !self.config.enabled {
            return Err(AppError::Internal("HTTPS未启用"));
        }

        println!("🔒 启动HTTPS服务器...");
        println!("📋 证书文件: {}", self.config.cert_path.display());
        println!("🔑 私钥文件: {}", self.config.key_path.display());

        // 加载TLS配置
        let tls_config = CertManager::load_tls_config(
            &self.config.cert_path,
            &self.config.key_path,
        )?;

        let rustls_config = RustlsConfig::from_config(tls_config);

        // 添加CORS和其他中间件
        let app = app.layer(
            ServiceBuilder::new()
                .layer(CorsLayer::permissive())
                .into_inner()
        );

        println!("🚀 HTTPS服务器启动在: https://{}", addr);

        // 启动HTTPS服务器
        axum_server::bind_rustls(addr, rustls_config)
            .serve(app.into_make_service())
            .await
            .map_err(|e| AppError::Internal(&format!("HTTPS服务器启动失败: {}", e)))?;

        Ok(())
    }
}
```

### 步骤3: 更新主服务器入口

修改 `backend/src/main.rs`:
```rust
mod server;
mod tls;
// ... 其他现有模块

use server::{HttpServer, HttpsServer};
use tls::TlsConfig;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 现有的初始化代码...
    let app_state = create_app_state().await?;
    let app = create_router(app_state);

    // TLS配置
    let tls_config = TlsConfig::from_env();
    
    if tls_config.enabled {
        // HTTPS模式
        let addr = format!("{}:{}", 
            std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            tls_config.port
        ).parse()?;

        let https_server = HttpsServer::new(tls_config.clone());
        
        // 可选：同时启动HTTP重定向服务器
        if tls_config.redirect_http {
            tokio::spawn(start_http_redirect(tls_config.port));
        }

        https_server.serve(app, addr).await?;
    } else {
        // HTTP模式 (现有逻辑)
        let addr = format!("{}:{}", 
            std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string())
        ).parse()?;

        println!("🌐 HTTP服务器启动在: http://{}", addr);
        
        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await?;
    }

    Ok(())
}

// HTTP到HTTPS重定向服务器
async fn start_http_redirect(https_port: u16) {
    use axum::{http::StatusCode, response::Redirect, routing::get};
    
    let redirect_app = Router::new()
        .fallback(|uri: axum::http::Uri| async move {
            let https_url = format!("https://localhost:{}{}", https_port, uri.path_and_query().map(|x| x.as_str()).unwrap_or(""));
            Redirect::permanent(&https_url)
        });

    let addr = "0.0.0.0:8080".parse().unwrap();
    println!("🔄 HTTP重定向服务器启动在: http://{}", addr);
    
    if let Err(e) = axum::Server::bind(&addr)
        .serve(redirect_app.into_make_service())
        .await
    {
        eprintln!("HTTP重定向服务器错误: {}", e);
    }
}
```

## 🔑 证书管理

### 开发环境 - 自签名证书
```bash
# 生成自签名证书
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'
```

### 生产环境 - Let's Encrypt
```bash
# 使用 certbot 获取免费证书
sudo certbot certonly --standalone -d yourdomain.com
```

### 证书更新脚本
创建 `scripts/renew-cert.sh`:
```bash
#!/bin/bash
# 自动更新Let's Encrypt证书
certbot renew --quiet
systemctl restart customer-service-backend
```

## ⚙️ 配置管理

### 环境变量配置
```bash
# .env 文件
TLS_ENABLED=true
TLS_CERT_PATH=/path/to/cert.pem
TLS_KEY_PATH=/path/to/key.pem
TLS_PORT=8443
TLS_REDIRECT_HTTP=true
```

### 配置文件方式
创建 `config/tls.toml`:
```toml
[tls]
enabled = true
cert_path = "cert.pem"
key_path = "key.pem"
port = 8443
redirect_http = true
```

## 🔨 编译配置

### 更新 Cargo.toml
```toml
[dependencies]
# HTTPS模块 (可选特性)
rustls = { version = "0.21", optional = true }
rustls-pemfile = { version = "1.0", optional = true }
axum-server = { version = "0.5", features = ["tls-rustls"], optional = true }

[features]
default = []
https = ["rustls", "rustls-pemfile", "axum-server"]
```

### 交叉编译命令
```powershell
# 编译HTTP版本 (默认)
cargo zigbuild --release --target x86_64-unknown-linux-musl

# 编译HTTPS版本
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
```

## 🚀 部署方案

### Docker部署
```dockerfile
# Dockerfile
FROM ubuntu:22.04
COPY target/x86_64-unknown-linux-musl/release/customer-service-backend /app/
COPY cert.pem key.pem /app/
WORKDIR /app
EXPOSE 8080 8443
CMD ["./customer-service-backend"]
```

### 系统服务
```ini
# /etc/systemd/system/customer-service-https.service
[Unit]
Description=Customer Service HTTPS Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/customer-service
ExecStart=/opt/customer-service/customer-service-backend
Environment=TLS_ENABLED=true
Environment=TLS_CERT_PATH=/etc/ssl/certs/customer-service.pem
Environment=TLS_KEY_PATH=/etc/ssl/private/customer-service.key
Restart=always

[Install]
WantedBy=multi-user.target
```

## 📋 迁移检查清单

- [ ] 添加TLS模块依赖
- [ ] 创建TLS配置结构
- [ ] 实现证书管理器
- [ ] 创建HTTPS服务器模块
- [ ] 更新主服务器入口
- [ ] 配置环境变量
- [ ] 获取SSL证书
- [ ] 测试HTTPS连接
- [ ] 配置HTTP重定向
- [ ] 更新部署脚本

## 🎯 验证步骤

### 1. **快速开始 (开发环境)**
```powershell
# 1. 生成自签名证书
scripts\generate-cert.bat

# 2. 启动 HTTPS 服务器
start-https.bat

# 3. 测试访问
# HTTP:  http://localhost:8080
# HTTPS: https://localhost:8443
```

### 2. **手动配置**
```powershell
# 1. 设置环境变量
$env:TLS_ENABLED="true"
$env:TLS_CERT_PATH="cert.pem"
$env:TLS_KEY_PATH="key.pem"

# 2. 编译和运行
cd backend
cargo run --features https
```

### 3. **功能测试**
打开测试页面验证所有功能：
```
http://localhost:8080/test-https.html  (会重定向到 HTTPS)
https://localhost:8443/test-https.html (直接 HTTPS 访问)
```

### 4. **API 端点测试**
```bash
# 健康检查
curl -k https://localhost:8443/health

# WebSocket 测试 (需要实际客户端)
# wss://localhost:8443/ws/staff/1

# 静态文件访问
curl -k https://localhost:8443/static/index.html
```

### 5. **证书验证**
```bash
# 检查证书信息
openssl x509 -in cert.pem -text -noout

# 验证证书和私钥匹配
openssl x509 -noout -modulus -in cert.pem | openssl md5
openssl rsa -noout -modulus -in key.pem | openssl md5
```

## ⚠️ 开发环境注意事项

1. **自签名证书警告**: 浏览器会显示"不安全"警告，点击"高级" → "继续访问"
2. **防火墙设置**: 确保端口 8443 未被防火墙阻止
3. **证书路径**: 确保证书文件路径正确且可读
4. **端口冲突**: 确保 8443 端口未被其他程序占用

## 🚀 生产环境部署

### 使用 Let's Encrypt (推荐)
```bash
# 1. 安装 certbot
sudo apt-get update
sudo apt-get install certbot

# 2. 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 3. 配置环境变量
export TLS_ENABLED=true
export TLS_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
export TLS_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
export TLS_PORT=443
export TLS_DOMAIN=yourdomain.com

# 4. 编译和部署
cargo zigbuild --release --target x86_64-unknown-linux-musl --features https
```

### 证书自动更新
```bash
# 创建更新脚本
sudo crontab -e

# 添加定时任务 (每月1号凌晨2点检查更新)
0 2 1 * * /usr/bin/certbot renew --quiet && systemctl restart customer-service-backend
```

## 💡 最佳实践

1. **证书管理**: 使用自动更新脚本
2. **配置分离**: 生产和开发环境分离
3. **监控**: 证书到期监控
4. **备份**: 定期备份证书和配置
5. **测试**: 定期验证HTTPS功能

---

**总结**: 这个方案提供了完整的HTTPS支持，同时保持了模块化设计和交叉编译兼容性。您可以根据需要逐步实施或选择性启用功能。toml
[dependencies]
# 现有依赖...
rustls = "0.21"
rustls-pemfile = "1.0"
tokio-rustls = "0.24"
```

### 2. 生成自签名证书（开发环境）
```bash
# 在 backend/ 目录下运行
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=localhost"
```

### 3. 修改Rust后端代码
在 `backend/src/main.rs` 中添加HTTPS支持：

```rust
use axum_server::tls_rustls::RustlsConfig;
use std::net::SocketAddr;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 现有的HTTP服务器 (端口8080)
    let http_app = create_app().await;
    let http_addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    
    // HTTPS服务器 (端口8443)
    let https_app = create_app().await;
    let https_addr = SocketAddr::from(([127, 0, 0, 1], 8443));
    
    // 加载TLS配置
    let tls_config = RustlsConfig::from_pem_file("cert.pem", "key.pem").await?;
    
    // 同时启动HTTP和HTTPS服务器
    let http_server = tokio::spawn(async move {
        axum::Server::bind(&http_addr)
            .serve(http_app.into_make_service())
            .await
            .unwrap();
    });
    
    let https_server = tokio::spawn(async move {
        axum_server::bind_rustls(https_addr, tls_config)
            .serve(https_app.into_make_service())
            .await
            .unwrap();
    });
    
    println!("🌐 HTTP服务器启动: http://localhost:8080");
    println!("🔒 HTTPS服务器启动: https://localhost:8443");
    
    // 等待任一服务器完成
    tokio::select! {
        _ = http_server => {},
        _ = https_server => {},
    }
    
    Ok(())
}
```

### 4. 更新SDK配置
让SDK自动选择合适的协议：

```typescript
const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
const port = protocol === 'https:' ? '8443' : '8080';
const apiUrl = `${protocol}//localhost:${port}`;
```

## 优缺点分析

### ✅ 优点：
- 完全解决Mixed Content问题
- 支持从任何环境访问
- 更安全的通信

### ❌ 缺点：
- 需要证书管理
- 增加配置复杂度
- 自签名证书会有浏览器警告

## 建议
对于开发阶段，**推荐继续使用智能协议适配方案**，它更简单且有效。
等到生产部署时，再考虑配置真正的HTTPS证书。