// ACME Client Implementation
// Purpose: Complete ACME protocol flow for certificate issuance and renewal
// Input: Account config, domain names, DNS provider
// Output: PEM-encoded certificate chain and private key
// Errors: ACME protocol errors, DNS failures, network issues

use anyhow::{Context, Result};
use instant_acme::{
    Account, AccountCredentials, ChallengeType, Identifier, LetsEncrypt, NewAccount, NewOrder,
    OrderStatus,
};
use rcgen::CertificateParams;
use std::time::Duration;
use tokio::time::sleep;

use super::providers::DnsProvider;

/// ACME Client for Let's Encrypt
pub struct AcmeClient<P: DnsProvider> {
    /// DNS provider for DNS-01 challenge
    dns_provider: P,
    /// ACME directory URL (production or staging)
    directory_url: String,
    /// Contact email
    email: String,
    /// Account credentials (persisted)
    account_credentials: Option<AccountCredentials>,
}

impl<P: DnsProvider> AcmeClient<P> {
    /// Create new ACME client
    pub fn new(dns_provider: P, directory_url: String, email: String) -> Self {
        Self {
            dns_provider,
            directory_url,
            email,
            account_credentials: None,
        }
    }

    /// Create or load ACME account
    async fn get_or_create_account(&mut self) -> Result<Account> {
        // For simplicity, always create new account for now
        // TODO: Persist and reload credentials from disk
        tracing::info!("📝 创建 ACME 账户...");
        
        let url = if self.directory_url.contains("staging") {
            LetsEncrypt::Staging.url()
        } else {
            LetsEncrypt::Production.url()
        };

        let (account, _credentials) = Account::create(
            &NewAccount {
                contact: &[&format!("mailto:{}", self.email)],
                terms_of_service_agreed: true,
                only_return_existing: false,
            },
            url,
            None,
        )
        .await
        .context("创建 ACME 账户失败")?;

        tracing::info!("✅ ACME 账户创建成功");
        
        // TODO: Persist credentials to disk for reuse
        // self.account_credentials = Some(credentials);
        
        Ok(account)
    }

    /// Issue certificate for domains
    pub async fn issue_certificate(&mut self, domains: &[String]) -> Result<(String, String)> {
        tracing::info!("🔐 开始 ACME 证书签发流程...");
        tracing::info!("📋 域名: {:?}", domains);

        // 1. Create or get ACME account
        let mut account = self.get_or_create_account().await?;

        // 2. Create new order
        let identifiers: Vec<Identifier> = domains
            .iter()
            .map(|d| Identifier::Dns(d.clone()))
            .collect();

        let mut order = account
            .new_order(&NewOrder {
                identifiers: &identifiers,
            })
            .await
            .context("创建 ACME 订单失败")?;

        tracing::info!("📦 ACME 订单创建成功");

        // 3. Get authorizations and complete DNS-01 challenges
        let authorizations = order
            .authorizations()
            .await
            .context("获取授权列表失败")?;

        for authz in &authorizations {
            let domain = match &authz.identifier {
                Identifier::Dns(d) => d,
            };

            tracing::info!("🔍 处理域名授权: {}", domain);

            // Find DNS-01 challenge
            let challenge = authz
                .challenges
                .iter()
                .find(|c| c.r#type == ChallengeType::Dns01)
                .context(format!("未找到 DNS-01 挑战: {}", domain))?;

            // Get DNS challenge value (key authorization)
            let key_auth = order.key_authorization(challenge);
            
            // Compute SHA256 digest for DNS TXT value
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(key_auth.as_str().as_bytes());
            let txt_value = hasher.finalize();
            
            // Base64 URL-safe encoding (new base64 crate API)
            use base64::engine::Engine;
            let txt_value_base64 = base64::engine::general_purpose::URL_SAFE_NO_PAD
                .encode(&txt_value);

            // Set TXT record
            let record_name = format!("_acme-challenge.{}", domain);
            self.dns_provider
                .set_txt_record(&record_name, &txt_value_base64)
                .await
                .context("设置 DNS TXT 记录失败")?;

            // Wait for DNS propagation
            let wait_secs = self.dns_provider.propagation_wait_secs();
            tracing::info!("⏳ 等待 DNS 传播 ({} 秒)...", wait_secs);
            sleep(Duration::from_secs(wait_secs)).await;

            // Validate challenge
            tracing::info!("✓ 验证 DNS-01 挑战...");
            order
                .set_challenge_ready(&challenge.url)
                .await
                .context("验证挑战失败")?;

            // Clear TXT record (optional, best practice)
            let _ = self.dns_provider.clear_txt_record(&record_name).await;
        }

        // 4. Poll order status until ready
        tracing::info!("⏳ 等待订单就绪...");
        let mut tries = 0;
        let max_tries = 30;

        loop {
            sleep(Duration::from_secs(2)).await;
            order.refresh().await.context("刷新订单状态失败")?;

            match order.state().status {
                OrderStatus::Ready => {
                    tracing::info!("✅ 订单就绪，准备签发证书");
                    break;
                }
                OrderStatus::Invalid => {
                    anyhow::bail!("ACME 订单失败: {:?}", order.state());
                }
                OrderStatus::Processing => {
                    tracing::debug!("订单处理中...");
                }
                _ => {
                    tracing::debug!("订单状态: {:?}", order.state().status);
                }
            }

            tries += 1;
            if tries >= max_tries {
                anyhow::bail!("等待订单就绪超时");
            }
        }

        // 5. Generate private key and CSR
        tracing::info!("🔑 生成私钥和 CSR...");
        let mut params = CertificateParams::new(domains.to_vec())
            .context("生成证书参数失败")?;
        params.distinguished_name = rcgen::DistinguishedName::new();
        
        // Generate key pair
        let key_pair = rcgen::KeyPair::generate()
            .context("生成密钥对失败")?;
        
        // Serialize CSR
        let csr = params
            .serialize_request(&key_pair)
            .context("生成 CSR 失败")?;
        
        let csr_der = csr.der().to_vec();

        // Store key_pair for later use
        let private_key_pem = key_pair.serialize_pem();

        // 6. Finalize order (submit CSR)
        order
            .finalize(&csr_der)
            .await
            .context("提交 CSR 失败")?;

        // 7. Poll for certificate
        tracing::info!("⏳ 等待证书签发...");
        let mut tries = 0;
        loop {
            sleep(Duration::from_secs(2)).await;
            order.refresh().await.context("刷新订单状态失败")?;

            match order.state().status {
                OrderStatus::Valid => {
                    tracing::info!("✅ 证书签发成功");
                    break;
                }
                OrderStatus::Invalid => {
                    anyhow::bail!("证书签发失败: {:?}", order.state());
                }
                _ => {
                    tracing::debug!("等待证书...");
                }
            }

            tries += 1;
            if tries >= max_tries {
                anyhow::bail!("等待证书签发超时");
            }
        }

        // 8. Download certificate
        let cert_chain = order
            .certificate()
            .await
            .context("下载证书失败")?
            .context("证书链为空")?;

        tracing::info!("🎉 证书获取成功！");

        Ok((cert_chain, private_key_pem))
    }
}
