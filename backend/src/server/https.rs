use crate::error::AppError;
use crate::tls::{CertManager, TlsConfig};
use axum::Router;
use std::net::SocketAddr;
use tracing::info;

#[cfg(feature = "https")]
use axum_server::tls_rustls::RustlsConfig;

pub struct HttpsServer {
    config: TlsConfig,
}

impl HttpsServer {
    pub fn new(config: TlsConfig) -> Self {
        Self { config }
    }

    #[cfg(feature = "https")]
    pub async fn serve(&self, app: Router, addr: SocketAddr) -> Result<(), AppError> {
        if !self.config.enabled {
            return Err(AppError::Internal("HTTPS未启用".to_string()));
        }

        info!("🔒 正在启动HTTPS服务器...");
        self.config.print_info();

        // 验证配置
        self.validate_config()?;

        // 使用CertManager确保证书存在（自动生成或验证）
        CertManager::ensure_certificates(
            &self.config.cert_path,
            &self.config.key_path,
            &self.config.domain,
            self.config.auto_generate_cert,
        )?;

        // 使用CertManager加载TLS配置
        let tls_config = CertManager::load_tls_config(
            &self.config.cert_path,
            &self.config.key_path,
        )?;

        let rustls_config = RustlsConfig::from_config(tls_config);

        info!("🚀 HTTPS服务器启动在: https://{}", addr);
        info!("🔗 可以通过以下地址访问:");
        info!("   https://localhost:{}", addr.port());
        if addr.ip().to_string() != "127.0.0.1" && addr.ip().to_string() != "localhost" {
            info!("   https://{}", addr);
        }

        // 启动HTTPS服务器
        axum_server::bind_rustls(addr, rustls_config)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .await
            .map_err(|e| AppError::Internal(format!("HTTPS服务器运行失败: {}", e)))?;

        Ok(())
    }

    #[cfg(not(feature = "https"))]
    pub async fn serve(&self, _app: Router, _addr: SocketAddr) -> Result<(), AppError> {
        Err(AppError::Internal(
            "HTTPS功能未启用。请使用以下命令重新编译:\ncargo build --features https".to_string()
        ))
    }
    
    pub fn validate_config(&self) -> Result<(), AppError> {
        if !self.config.enabled {
            return Ok(());
        }
        self.config.validate().map_err(|e| AppError::Internal(format!("TLS配置验证失败: {}", e)))?;
        Ok(())
    }
    
    pub fn print_cert_help(&self) {
        if !self.config.enabled {
            return;
        }
        println!();
        println!("🔧 HTTPS证书配置帮助:");
        println!("  证书文件: {:?}", self.config.cert_path);
        println!("  私钥文件: {:?}", self.config.key_path);
        println!();
        println!("💡 开发环境生成自签名证书:");
        #[cfg(windows)]
        println!("   ./generate-cert.bat");
        #[cfg(not(windows))]
        println!("   ./generate-cert.sh");
        println!();
        println!("🌐 生产环境获取SSL证书:");
        println!("   1. Let's Encrypt (免费): https://letsencrypt.org/");
        println!("   2. 购买商业SSL证书");
        println!("   3. 云服务商提供的SSL证书");
    }

    /// 检查证书健康状态 (生产环境监控)
    pub fn check_certificate_health(&self) -> String {
        if !self.config.enabled {
            return "HTTPS未启用".to_string();
        }

        // 验证证书文件存在
        if let Err(e) = CertManager::validate_cert_files(&self.config.cert_path, &self.config.key_path) {
            return format!("证书文件错误: {:?}", e);
        }

        // 检查证书过期状态
        match CertManager::check_cert_expiry(&self.config.cert_path) {
            Ok(expiring_soon) => {
                if expiring_soon {
                    "警告: 证书即将过期".to_string()
                } else {
                    "证书状态正常".to_string()
                }
            }
            Err(e) => format!("证书过期检查失败: {:?}", e),
        }
    }

}
