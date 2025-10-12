// 证书管理器
// Purpose: 证书加载、验证和自签名证书生成
// Input: 证书文件路径、私钥路径
// Output: TLS服务器配置
// Errors: 文件读取失败、证书解析错误、TLS配置错误

use crate::error::AppError;
use std::fs::File;
use std::path::Path;

#[cfg(feature = "https")]
use rustls::{Certificate, PrivateKey, ServerConfig};
#[cfg(feature = "https")]
use rustls_pemfile::{certs, pkcs8_private_keys};
#[cfg(feature = "https")]
use std::io::BufReader;
#[cfg(feature = "https")]
use std::sync::Arc;

/// 证书管理器
pub struct CertManager;

impl CertManager {
    /// 从PEM文件加载TLS配置
    #[cfg(feature = "https")]
    pub fn load_tls_config<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
    ) -> Result<Arc<ServerConfig>, AppError> {
        // 读取证书文件
        let cert_file = File::open(&cert_path)
            .map_err(|e| AppError::Internal(format!("无法打开证书文件 {}: {}", cert_path.as_ref().display(), e)))?;
        let mut cert_reader = BufReader::new(cert_file);
        
        let cert_chain = certs(&mut cert_reader)
            .map_err(|e| AppError::Internal(format!("无法解析证书文件: {}", e)))?
            .into_iter()
            .map(Certificate)
            .collect();

        // 读取私钥文件
        let key_file = File::open(&key_path)
            .map_err(|e| AppError::Internal(format!("无法打开私钥文件 {}: {}", key_path.as_ref().display(), e)))?;
        let mut key_reader = BufReader::new(key_file);
        
        let mut keys = pkcs8_private_keys(&mut key_reader)
            .map_err(|e| AppError::Internal(format!("无法解析私钥文件: {}", e)))?;

        if keys.is_empty() {
            return Err(AppError::Internal("私钥文件中未找到有效的PKCS8私钥".to_string()));
        }

        let private_key = PrivateKey(keys.remove(0));

        // 创建TLS配置
        let config = ServerConfig::builder()
            .with_safe_defaults()
            .with_no_client_auth()
            .with_single_cert(cert_chain, private_key)
            .map_err(|e| AppError::Internal(format!("TLS配置创建失败: {}", e)))?;

        println!("✅ TLS配置加载成功");
        Ok(Arc::new(config))
    }

    /// 当HTTPS功能未启用时的占位方法
    #[cfg(not(feature = "https"))]
    pub fn load_tls_config<P: AsRef<Path>>(
        _cert_path: P,
        _key_path: P,
    ) -> Result<(), AppError> {
        Err(AppError::Internal("HTTPS功能未启用，请使用 --features https 编译".to_string()))
    }

    /// 验证证书文件是否有效
    pub fn validate_cert_files<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
    ) -> Result<(), AppError> {
        let cert_path = cert_path.as_ref();
        let key_path = key_path.as_ref();

        // 检查文件是否存在
        if !cert_path.exists() {
            return Err(AppError::Internal(format!("证书文件不存在: {}", cert_path.display())));
        }
        if !key_path.exists() {
            return Err(AppError::Internal(format!("私钥文件不存在: {}", key_path.display())));
        }

        // 检查文件是否可读
        File::open(cert_path)
            .map_err(|e| AppError::Internal(format!("无法读取证书文件: {}", e)))?;
        File::open(key_path)
            .map_err(|e| AppError::Internal(format!("无法读取私钥文件: {}", e)))?;

        println!("✅ 证书文件验证通过");
        Ok(())
    }

    /// 打印自签名证书生成指令 (开发环境)
    pub fn print_self_signed_cert_command<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
        domain: &str,
    ) {
        println!("📋 生成自签名证书 (开发环境):");
        println!("openssl req -x509 -newkey rsa:4096 -keyout {} -out {} -days 365 -nodes -subj '/CN={}'", 
            key_path.as_ref().display(), 
            cert_path.as_ref().display(), 
            domain
        );
        println!();
        println!("或者使用简化命令:");
        println!("openssl req -x509 -newkey rsa:2048 -keyout {} -out {} -days 365 -nodes -subj '/CN=localhost'",
            key_path.as_ref().display(),
            cert_path.as_ref().display()
        );
    }

    /// 检查证书是否即将过期 (30天内) - 简化版本
    #[cfg(feature = "https")]
    pub fn check_cert_expiry<P: AsRef<Path>>(cert_path: P) -> Result<bool, AppError> {
        // 简化版本：只检查文件是否存在
        if !cert_path.as_ref().exists() {
            return Err(AppError::Internal("证书文件不存在".to_string()));
        }
        
        // 提示用户手动检查证书过期时间
        println!("💡 提示: 使用以下命令检查证书过期时间:");
        println!("openssl x509 -in {} -text -noout | grep -A2 'Validity'", cert_path.as_ref().display());
        
        // 默认返回false (未过期)
        Ok(false)
    }

    /// 当HTTPS功能未启用时的证书过期检查占位方法
    #[cfg(not(feature = "https"))]
    pub fn check_cert_expiry<P: AsRef<Path>>(_cert_path: P) -> Result<bool, AppError> {
        Err(AppError::Internal("HTTPS功能未启用".to_string()))
    }

    /// 自动生成自签名证书 (占位方法 - 建议手动生成)
    pub fn generate_self_signed_cert<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
        domain: &str,
    ) -> Result<(), AppError> {
        println!("� 建议手动生成自签名证书:");
        Self::print_self_signed_cert_command(&cert_path, &key_path, domain);
        Err(AppError::Internal("请手动生成证书或使用现有证书".to_string()))
    }

    /// 智能证书检查 - 简化版本
    pub fn ensure_certificates<P: AsRef<Path>>(
        cert_path: P,
        key_path: P,
        domain: &str,
        auto_generate: bool,
    ) -> Result<(), AppError> {
        let cert_path = cert_path.as_ref();
        let key_path = key_path.as_ref();

        // 检查证书是否存在
        if cert_path.exists() && key_path.exists() {
            // 验证现有证书
            match Self::validate_cert_files(cert_path, key_path) {
                Ok(_) => {
                    println!("✅ 使用现有证书: {}", cert_path.display());
                    return Ok(());
                }
                Err(e) => {
                    println!("⚠️  现有证书验证失败: {:?}", e);
                    if !auto_generate {
                        return Err(e);
                    }
                }
            }
        }

        if auto_generate {
            // 尝试生成证书 (实际上只会打印命令)
            println!("🔧 证书不存在或无效，需要生成新证书...");
            Self::generate_self_signed_cert(cert_path, key_path, domain)?;
        } else {
            // 只提供生成命令提示
            Self::print_self_signed_cert_command(cert_path, key_path, domain);
            return Err(AppError::Internal("证书文件不存在，请先生成证书".to_string()));
        }

        Ok(())
    }
}