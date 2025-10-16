// backend/src/tls/acme/http_client.rs
// ACME HTTP-01 Client
// Purpose: Issue certificates using HTTP-01 challenge
// Input: Domains, email, ACME directory URL
// Output: PEM-encoded certificate and private key
// Errors: Network failures, validation errors, ACME protocol errors

use anyhow::{Context, Result};
use instant_acme::{
    Account, AccountCredentials, ChallengeType, Identifier, LetsEncrypt,
    NewAccount, NewOrder, OrderStatus,
};
use rcgen::{CertificateParams, DistinguishedName, KeyPair};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

use super::http_challenge::{ChallengeStorage, HttpChallengeHandler};

/// ACME Client for HTTP-01 challenge
pub struct HttpAcmeClient {
    storage: Arc<ChallengeStorage>,
    directory_url: String,
    email: String,
}

impl HttpAcmeClient {
    /// Create new HTTP-01 ACME client
    pub fn new(storage: ChallengeStorage, directory_url: String, email: String) -> Self {
        Self {
            storage: Arc::new(storage),
            directory_url,
            email,
        }
    }
    
    /// Issue certificate using HTTP-01 challenge
    pub async fn issue_certificate(&mut self, domains: &[String]) -> Result<(String, String)> {
        tracing::info!("🔐 开始 ACME HTTP-01 证书签发流程");
        tracing::info!("   域名: {:?}", domains);
        tracing::info!("   ACME 目录: {}", self.directory_url);
        
        // 1. Create or load ACME account
        tracing::info!("📝 创建 ACME 账户...");
        let account = self.create_account().await?;
        
        // 2. Create new order
        tracing::info!("📋 创建证书订单...");
        let identifiers: Vec<Identifier> = domains
            .iter()
            .map(|d| Identifier::Dns(d.clone()))
            .collect();
        
        let mut order = account
            .new_order(&NewOrder { identifiers: &identifiers })
            .await
            .context("创建订单失败")?;
        
        // 3. Process HTTP-01 challenges
        tracing::info!("🔍 处理 HTTP-01 挑战...");
        let authorizations = order
            .authorizations()
            .await
            .context("获取授权列表失败")?;
        
        for authz in &authorizations {
            let domain = match &authz.identifier {
                Identifier::Dns(d) => d,
            };
            
            tracing::info!("🔍 处理域名授权: {}", domain);
            
            // Find HTTP-01 challenge
            let challenge = authz
                .challenges
                .iter()
                .find(|c| c.r#type == ChallengeType::Http01)
                .context(format!("未找到 HTTP-01 挑战: {}", domain))?;
            
            // Get key authorization
            let key_auth = order.key_authorization(challenge);
            
            // Store challenge in storage (HTTP server will serve it)
            self.storage
                .set_challenge(&challenge.token, key_auth.as_str())
                .await
                .context("存储挑战 token 失败")?;
            
            tracing::info!("✅ HTTP-01 挑战已准备:");
            tracing::info!("   Token: {}", challenge.token);
            tracing::info!("   URL: http://{}/.well-known/acme-challenge/{}", domain, challenge.token);
            tracing::info!("   💡 提示: 确保 80 端口已启动 HTTP 挑战服务器");
            
            // Let's Encrypt needs time to access the challenge
            tracing::info!("⏳ 等待 5 秒确保 HTTP 服务器就绪...");
            sleep(Duration::from_secs(5)).await;
            
            // Notify ACME server that challenge is ready
            tracing::info!("✓ 提交 HTTP-01 挑战验证...");
            order
                .set_challenge_ready(&challenge.url)
                .await
                .context("提交挑战验证失败")?;
            
            tracing::info!("✅ HTTP-01 挑战已提交，等待 Let's Encrypt 验证...");
        }
        
        // 4. Poll order status until ready
        tracing::info!("⏳ 等待订单就绪...");
        let max_tries = 30; // 60 seconds (30 * 2s)
        let mut tries = 0;
        
        loop {
            sleep(Duration::from_secs(2)).await;
            
            let state = order.refresh().await.context("刷新订单状态失败")?;
            let status = state.status;
            
            match status {
                OrderStatus::Ready => {
                    tracing::info!("✅ 订单就绪，准备签发证书");
                    break;
                }
                OrderStatus::Invalid => {
                    let state = order.state();
                    tracing::error!("❌ ACME 订单验证失败:");
                    tracing::error!("   状态: {:?}", state.status);
                    
                    for (i, auth_url) in state.authorizations.iter().enumerate() {
                        tracing::error!("   授权 {}: {}", i + 1, auth_url);
                    }
                    
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
                anyhow::bail!("等待订单就绪超时（60秒）");
            }
        }
        
        // 5. Generate CSR and finalize order
        tracing::info!("📝 生成 CSR...");
        let mut params = CertificateParams::new(domains.to_vec())?;
        params.distinguished_name = DistinguishedName::new();
        
        let key_pair = KeyPair::generate()?;
        let csr_der = params.serialize_request(&key_pair)?;
        
        tracing::info!("📤 提交 CSR...");
        order.finalize(csr_der.der()).await.context("提交 CSR 失败")?;
        
        // 6. Download certificate
        tracing::info!("📥 下载证书...");
        let cert_chain_pem = loop {
            match order.certificate().await.context("下载证书失败")? {
                Some(cert) => break cert,
                None => {
                    sleep(Duration::from_secs(1)).await;
                }
            }
        };
        
        let private_key_pem = key_pair.serialize_pem();
        
        // 7. Clear challenges
        tracing::info!("🧹 清理 HTTP-01 挑战 tokens...");
        self.storage.clear_challenges().await?;
        
        tracing::info!("✅ ACME HTTP-01 证书签发成功！");
        
        Ok((cert_chain_pem, private_key_pem))
    }
    
    /// Create or load ACME account
    async fn create_account(&self) -> Result<Account> {
        let directory_url = if self.directory_url.contains("letsencrypt.org") {
            if self.directory_url.contains("staging") {
                LetsEncrypt::Staging.url()
            } else {
                LetsEncrypt::Production.url()
            }
        } else {
            &self.directory_url
        };
        
        let (account, _credentials) = Account::create(
            &NewAccount {
                contact: &[&format!("mailto:{}", self.email)],
                terms_of_service_agreed: true,
                only_return_existing: false,
            },
            directory_url,
            None,
        )
        .await
        .context("创建 ACME 账户失败")?;
        
        tracing::info!("✅ ACME 账户创建成功");
        Ok(account)
    }
}
