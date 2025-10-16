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
            tracing::info!("   TXT 记录: _acme-challenge.{} = {}", domain, &txt_value_base64);
            tracing::info!("   💡 提示: 您可以在另一个终端验证 TXT 记录:");
            tracing::info!("      dig _acme-challenge.{} TXT +short", domain);
            sleep(Duration::from_secs(wait_secs)).await;

            // Additional wait for Let's Encrypt validators across different regions
            tracing::info!("⏳ 额外等待 30 秒以确保全球 DNS 传播...");
            sleep(Duration::from_secs(30)).await;

            // Validate challenge
            tracing::info!("✓ 验证 DNS-01 挑战...");
            tracing::info!("   挑战 URL: {}", &challenge.url);
            order
                .set_challenge_ready(&challenge.url)
                .await
                .context("提交挑战验证失败")?;
            
            tracing::info!("✅ DNS-01 挑战已提交，等待 Let's Encrypt 验证...");
        }

        // 4. Poll order status until ready
        tracing::info!("⏳ 等待订单就绪...");
        let mut tries = 0;
        let max_tries = 30;

        loop {
            sleep(Duration::from_secs(2)).await;
            order.refresh().await.context("刷新订单状态失败")?;

            let status = order.state().status;
            match status {
                OrderStatus::Ready => {
                    tracing::info!("✅ 订单就绪，准备签发证书");
                    break;
                }
                OrderStatus::Invalid => {
                    let state = order.state();
                    tracing::error!("❌ ACME 订单验证失败:");
                    tracing::error!("   状态: {:?}", state.status);
                    
                    // 输出每个授权的详细错误信息
                    for (i, auth_url) in state.authorizations.iter().enumerate() {
                        tracing::error!("   授权 {}: {}", i + 1, auth_url);
                    }
                    
                    // 输出错误详情
                    if let Some(ref error) = state.error {
                        tracing::error!("   错误类型: {}", error.r#type.as_deref().unwrap_or("unknown"));
                        tracing::error!("   错误详情: {}", error.detail.as_deref().unwrap_or("无详细信息"));
                    }
                    
                    anyhow::bail!("ACME 订单验证失败，请检查日志获取详细信息");
                }
                OrderStatus::Processing => {
                    tracing::debug!("订单处理中... (尝试 {}/{})", tries + 1, max_tries);
                }
                OrderStatus::Pending => {
                    tracing::debug!("订单等待验证... (尝试 {}/{})", tries + 1, max_tries);
                }
                _ => {
                    tracing::debug!("订单状态: {:?} (尝试 {}/{})", status, tries + 1, max_tries);
                }
            }

            tries += 1;
            if tries >= max_tries {
                tracing::error!("❌ 等待订单就绪超时 ({}次尝试，共{}秒)", max_tries, max_tries * 2);
                tracing::error!("   最终状态: {:?}", order.state().status);
                tracing::error!("   建议: 检查 DNS TXT 记录是否正确设置");
                anyhow::bail!("等待订单就绪超时，DNS 验证可能失败");
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

        // 9. Clear DNS TXT records (cleanup)
        for domain in domains {
            let record_name = format!("_acme-challenge.{}", domain);
            if let Err(e) = self.dns_provider.clear_txt_record(&record_name).await {
                tracing::warn!("清除 DNS TXT 记录失败 ({}): {}", record_name, e);
            } else {
                tracing::info!("🧹 已清除 DNS TXT 记录: {}", record_name);
            }
        }

        Ok((cert_chain, private_key_pem))
    }
}
