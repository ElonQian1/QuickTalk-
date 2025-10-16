// DuckDNS Provider for DNS-01 Challenge
// Purpose: Implement DNS-01 challenge validation using DuckDNS API
// Input: DuckDNS domain and token from environment
// Output: TXT record updates for _acme-challenge
// Errors: API failures, invalid token, network errors

use super::DnsProvider;
use anyhow::{Context, Result};
use reqwest::Client;

/// DuckDNS DNS Provider
pub struct DuckDnsProvider {
    /// DuckDNS domain (without .duckdns.org suffix)
    domain: String,
    /// DuckDNS API token
    token: String,
    /// HTTP client
    client: Client,
}

impl DuckDnsProvider {
    /// Create new DuckDNS provider
    pub fn new(domain: String, token: String) -> Self {
        Self {
            domain,
            token,
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .unwrap_or_default(),
        }
    }

    /// Create from environment variables
    pub fn from_env() -> Result<Self> {
        let domain = std::env::var("DUCKDNS_DOMAIN")
            .context("缺少环境变量 DUCKDNS_DOMAIN")?;
        let token = std::env::var("DUCKDNS_TOKEN")
            .context("缺少环境变量 DUCKDNS_TOKEN")?;
        Ok(Self::new(domain, token))
    }
}

impl DnsProvider for DuckDnsProvider {
    async fn set_txt_record(&self, _record_name: &str, record_value: &str) -> Result<()> {
        // DuckDNS API: https://www.duckdns.org/update?domains={domain}&token={token}&txt={value}
        let url = format!(
            "https://www.duckdns.org/update?domains={}&token={}&txt={}",
            self.domain, self.token, record_value
        );

        tracing::info!(
            "🔐 设置 DuckDNS TXT 记录: {} (domain={})",
            record_value,
            self.domain
        );

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("DuckDNS API 请求失败")?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if !status.is_success() || body.trim() != "OK" {
            anyhow::bail!("DuckDNS API 返回错误: {} - {}", status, body);
        }

        tracing::info!("✅ DuckDNS TXT 记录设置成功");
        Ok(())
    }

    async fn clear_txt_record(&self, _record_name: &str) -> Result<()> {
        // DuckDNS API: https://www.duckdns.org/update?domains={domain}&token={token}&txt=&clear=true
        let url = format!(
            "https://www.duckdns.org/update?domains={}&token={}&txt=&clear=true",
            self.domain, self.token
        );

        tracing::info!("🧹 清理 DuckDNS TXT 记录: {}", self.domain);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .context("DuckDNS API 清理请求失败")?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        if !status.is_success() || body.trim() != "OK" {
            tracing::warn!("DuckDNS TXT 清理警告: {} - {}", status, body);
        } else {
            tracing::info!("✅ DuckDNS TXT 记录已清理");
        }

        Ok(())
    }

    fn propagation_wait_secs(&self) -> u64 {
        // DuckDNS typically propagates very quickly, but wait 60s to be safe
        60
    }
}
