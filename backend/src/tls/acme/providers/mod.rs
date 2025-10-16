// DNS Providers for ACME DNS-01 Challenge
// Purpose: Abstract DNS provider interface for different DNS services
// Input: Domain, TXT record name and value
// Output: Result indicating success or failure
// Errors: Network failures, API errors, authentication failures

#[cfg(feature = "https")]
pub mod duckdns;

#[cfg(feature = "https")]
pub use duckdns::DuckDnsProvider;

use anyhow::Result;

/// DNS Provider trait for DNS-01 challenge
#[cfg(feature = "https")]
pub trait DnsProvider {
    /// Set TXT record for ACME challenge
    async fn set_txt_record(&self, record_name: &str, record_value: &str) -> Result<()>;
    
    /// Clear TXT record after challenge
    async fn clear_txt_record(&self, record_name: &str) -> Result<()>;
    
    /// Get propagation wait time in seconds
    fn propagation_wait_secs(&self) -> u64 {
        60 // Default 60 seconds
    }
}
