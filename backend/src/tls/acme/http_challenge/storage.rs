// backend/src/tls/acme/http_challenge/storage.rs
// Challenge Token Storage
// Purpose: Thread-safe storage for HTTP-01 challenge tokens
// Input: Token-KeyAuth pairs
// Output: Challenge responses for ACME validation
// Errors: None (uses in-memory HashMap)

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use anyhow::Result;

use super::HttpChallengeHandler;

/// In-memory storage for HTTP-01 challenge tokens
#[derive(Clone)]
pub struct ChallengeStorage {
    challenges: Arc<RwLock<HashMap<String, String>>>,
}

impl ChallengeStorage {
    /// Create new challenge storage
    pub fn new() -> Self {
        Self {
            challenges: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for ChallengeStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl HttpChallengeHandler for ChallengeStorage {
    async fn set_challenge(&self, token: &str, key_auth: &str) -> Result<()> {
        let mut challenges = self.challenges.write().await;
        challenges.insert(token.to_string(), key_auth.to_string());
        tracing::debug!("存储 HTTP-01 挑战: token={}", token);
        Ok(())
    }
    
    async fn get_challenge(&self, token: &str) -> Option<String> {
        let challenges = self.challenges.read().await;
        challenges.get(token).cloned()
    }
    
    async fn remove_challenge(&self, token: &str) -> Result<()> {
        let mut challenges = self.challenges.write().await;
        challenges.remove(token);
        tracing::debug!("移除 HTTP-01 挑战: token={}", token);
        Ok(())
    }
    
    async fn clear_challenges(&self) -> Result<()> {
        let mut challenges = self.challenges.write().await;
        let count = challenges.len();
        challenges.clear();
        tracing::debug!("清理所有 HTTP-01 挑战: count={}", count);
        Ok(())
    }
}
