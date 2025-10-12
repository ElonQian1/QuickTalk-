// TLS 配置管理
// Purpose: 环境变量驱动的TLS配置
// Input: 环境变量或默认值
// Output: TlsConfig 结构体
// Errors: 环境变量解析错误

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// TLS配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    /// 是否启用HTTPS
    pub enabled: bool,
    /// 证书文件路径
    pub cert_path: PathBuf,
    /// 私钥文件路径  
    pub key_path: PathBuf,
    /// HTTPS端口
    pub port: u16,
    /// 是否启用HTTP到HTTPS重定向
    pub redirect_http: bool,
    /// 域名 (用于自签名证书)
    pub domain: String,
    /// 是否自动生成证书 (开发环境)
    pub auto_generate_cert: bool,
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cert_path: "cert.pem".into(),
            key_path: "key.pem".into(),
            port: 8443,
            redirect_http: true,
            domain: "localhost".to_string(),
            auto_generate_cert: true,
        }
    }
}

impl TlsConfig {
    /// 从环境变量创建TLS配置
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
            domain: std::env::var("TLS_DOMAIN")
                .unwrap_or_else(|_| "localhost".to_string()),
            auto_generate_cert: std::env::var("TLS_AUTO_GENERATE_CERT")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
        }
    }

    /// 验证配置有效性 (宽松模式，支持自动生成)
    pub fn validate(&self) -> Result<(), String> {
        if self.enabled {
            if self.port < 1024 && cfg!(unix) {
                return Err("端口 < 1024 需要管理员权限".to_string());
            }
            
            // 如果不自动生成，才严格检查证书文件
            if !self.auto_generate_cert {
                if !self.cert_path.exists() {
                    return Err(format!("证书文件不存在: {}", self.cert_path.display()));
                }
                if !self.key_path.exists() {
                    return Err(format!("私钥文件不存在: {}", self.key_path.display()));
                }
            }
        }
        Ok(())
    }

    /// 打印配置信息
    pub fn print_info(&self) {
        if self.enabled {
            println!("🔒 HTTPS配置:");
            println!("  📋 证书: {}", self.cert_path.display());
            println!("  🔑 私钥: {}", self.key_path.display());
            println!("  🌐 端口: {}", self.port);
            println!("  🔄 HTTP重定向: {}", if self.redirect_http { "启用" } else { "禁用" });
            println!("  🏷️  域名: {}", self.domain);
            println!("  🔧 自动生成证书: {}", if self.auto_generate_cert { "启用" } else { "禁用" });
        } else {
            println!("🌐 HTTPS: 未启用");
        }
    }
}