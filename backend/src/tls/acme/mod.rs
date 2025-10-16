// ACME (Let's Encrypt) Complete Implementation
// Purpose: Automatic certificate issuance and renewal using DNS-01 challenge
// Input: env-config (email, domains, challenge, duckdns token)
// Output: Ensured cert/key files on disk; return whether changed
// Errors: network failures, rate limits, invalid config

#[cfg(feature = "https")]
mod client;
#[cfg(feature = "https")]
mod providers;
#[cfg(feature = "https")]
mod expiry;

#[cfg(feature = "https")]
pub use client::AcmeClient as AcmeClientImpl;
#[cfg(feature = "https")]
pub use providers::{DnsProvider, DuckDnsProvider};
#[cfg(feature = "https")]
pub use expiry::{check_cert_expiry, needs_renewal};

use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct AcmeConfig {
    pub enabled: bool,
    pub directory_url: String,
    pub email: String,
    pub domains: Vec<String>,
    pub challenge: String, // "dns-01" | "http-01" | "tls-alpn-01"
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    pub renew_before_days: u32,
}

impl AcmeConfig {
    pub fn from_env() -> Self {
        let enabled = std::env::var("ACME_ENABLED").unwrap_or_else(|_| "false".into()) == "true";
        let directory_url = std::env::var("ACME_DIRECTORY_URL")
            .unwrap_or_else(|_| "https://acme-v02.api.letsencrypt.org/directory".into());
        let email = std::env::var("ACME_EMAIL").unwrap_or_default();
        let domains = std::env::var("ACME_DOMAINS").unwrap_or_default();
        let domains: Vec<String> = domains
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim().to_string())
            .collect();
        let challenge = std::env::var("ACME_CHALLENGE").unwrap_or_else(|_| "dns-01".into());
        let cert_path = std::env::var("TLS_CERT_PATH")
            .unwrap_or_else(|_| "certs/server.crt".into())
            .into();
        let key_path = std::env::var("TLS_KEY_PATH")
            .unwrap_or_else(|_| "certs/server.key".into())
            .into();
        let renew_before_days = std::env::var("RENEW_BEFORE_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);
        Self {
            enabled,
            directory_url,
            email,
            domains,
            challenge,
            cert_path,
            key_path,
            renew_before_days,
        }
    }

    /// Validate configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if !self.enabled {
            return Ok(());
        }

        if self.email.is_empty() {
            anyhow::bail!("ACME_EMAIL 未配置");
        }

        if self.domains.is_empty() {
            anyhow::bail!("ACME_DOMAINS 未配置");
        }

        if self.challenge != "dns-01" {
            anyhow::bail!("当前仅支持 DNS-01 挑战类型");
        }

        Ok(())
    }
}

pub struct AcmeClient;

impl AcmeClient {
    /// Ensure certificates exist and are valid long enough; returns true if files were (re)issued
    #[cfg(feature = "https")]
    pub async fn ensure(cfg: &AcmeConfig, _timeout: Option<Duration>) -> anyhow::Result<bool> {
        use anyhow::Context;

        if !cfg.enabled {
            return Ok(false);
        }

        tracing::info!("🔐 ACME 证书检查启动");

        // Validate configuration
        cfg.validate()?;

        // Check if renewal is needed
        let needs_renew = needs_renewal(&cfg.cert_path, cfg.renew_before_days)?;

        if !needs_renew {
            tracing::info!("✅ 证书有效，无需续期");
            return Ok(false);
        }

        tracing::info!("🔄 开始证书签发/续期流程...");

        // Create DNS provider (only DuckDNS supported for now)
        let dns_provider = DuckDnsProvider::from_env()
            .context("创建 DNS provider 失败，请检查 DUCKDNS_DOMAIN 和 DUCKDNS_TOKEN 环境变量")?;

        // Create ACME client
        let mut acme_client = AcmeClientImpl::new(
            dns_provider,
            cfg.directory_url.clone(),
            cfg.email.clone(),
        );

        // Issue certificate
        let (cert_pem, key_pem) = acme_client
            .issue_certificate(&cfg.domains)
            .await
            .context("ACME 证书签发失败")?;

        // Ensure directory exists
        if let Some(parent) = cfg.cert_path.parent() {
            std::fs::create_dir_all(parent)
                .context(format!("创建证书目录失败: {}", parent.display()))?;
        }

        // Write certificate and key to disk
        std::fs::write(&cfg.cert_path, cert_pem)
            .context(format!("写入证书文件失败: {}", cfg.cert_path.display()))?;

        std::fs::write(&cfg.key_path, key_pem)
            .context(format!("写入私钥文件失败: {}", cfg.key_path.display()))?;

        // Set appropriate permissions (Unix-like systems)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let cert_perms = std::fs::Permissions::from_mode(0o644);
            let key_perms = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&cfg.cert_path, cert_perms)?;
            std::fs::set_permissions(&cfg.key_path, key_perms)?;
        }

        tracing::info!("✅ 证书已写入:");
        tracing::info!("   📄 证书: {}", cfg.cert_path.display());
        tracing::info!("   🔑 私钥: {}", cfg.key_path.display());

        Ok(true)
    }

    /// Fallback for non-https builds
    #[cfg(not(feature = "https"))]
    pub async fn ensure(_cfg: &AcmeConfig, _timeout: Option<Duration>) -> anyhow::Result<bool> {
        Ok(false)
    }
}
