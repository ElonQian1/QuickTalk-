// backend/src/tls/acme/http_challenge/mod.rs
// HTTP-01 Challenge Handler Module
// Purpose: Provide HTTP-01 challenge verification for ACME
// Input: Challenge tokens from ACME server
// Output: HTTP responses on port 80 for validation
// Errors: Port binding failures, storage errors

#[cfg(feature = "https")]
pub mod server;
#[cfg(feature = "https")]
pub mod storage;

#[cfg(feature = "https")]
pub use server::HttpChallengeServer;
#[cfg(feature = "https")]
pub use storage::ChallengeStorage;

use anyhow::Result;

/// HTTP-01 Challenge Handler trait
#[cfg(feature = "https")]
#[async_trait::async_trait]
pub trait HttpChallengeHandler: Send + Sync {
    /// Store a challenge token and its response
    async fn set_challenge(&self, token: &str, key_auth: &str) -> Result<()>;
    
    /// Get challenge response for a token
    async fn get_challenge(&self, token: &str) -> Option<String>;
    
    /// Remove a challenge token
    async fn remove_challenge(&self, token: &str) -> Result<()>;
    
    /// Clear all challenges
    async fn clear_challenges(&self) -> Result<()>;
}
