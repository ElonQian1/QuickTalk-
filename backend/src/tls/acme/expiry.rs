// Certificate Expiry Checker
// Purpose: Parse X.509 certificates and check expiration dates
// Input: PEM-encoded certificate file
// Output: Days until expiration
// Errors: Parse failures, file I/O errors

use anyhow::{Context, Result};
use std::path::Path;
use x509_parser::prelude::*;

/// Check certificate expiration
pub fn check_cert_expiry<P: AsRef<Path>>(cert_path: P) -> Result<chrono::Duration> {
    let cert_pem = std::fs::read_to_string(cert_path.as_ref())
        .context("读取证书文件失败")?;

    // Parse PEM
    let (_rem, pem) = parse_x509_pem(cert_pem.as_bytes())
        .map_err(|e| anyhow::anyhow!("解析 PEM 失败: {:?}", e))?;

    // Parse X.509 certificate
    let cert = pem.parse_x509()
        .map_err(|e| anyhow::anyhow!("解析 X.509 证书失败: {:?}", e))?;

    // Get not_after timestamp
    let not_after = cert.validity().not_after;
    let not_after_timestamp = not_after.timestamp();

    // Calculate remaining days
    let now = chrono::Utc::now().timestamp();
    let remaining_secs = not_after_timestamp - now;
    let remaining_duration = chrono::Duration::seconds(remaining_secs);

    tracing::debug!(
        "📅 证书到期时间: {} (剩余 {} 天)",
        not_after,
        remaining_duration.num_days()
    );

    Ok(remaining_duration)
}

/// Check if certificate needs renewal
pub fn needs_renewal<P: AsRef<Path>>(cert_path: P, renew_before_days: u32) -> Result<bool> {
    if !cert_path.as_ref().exists() {
        return Ok(true); // File doesn't exist, needs issuance
    }

    match check_cert_expiry(&cert_path) {
        Ok(remaining) => {
            let days_left = remaining.num_days();
            let needs_renew = days_left <= renew_before_days as i64;
            
            if needs_renew {
                tracing::warn!(
                    "⚠️  证书即将到期 (剩余 {} 天 <= {} 天阈值)",
                    days_left,
                    renew_before_days
                );
            } else {
                tracing::info!(
                    "✅ 证书有效期充足 (剩余 {} 天)",
                    days_left
                );
            }
            
            Ok(needs_renew)
        }
        Err(e) => {
            tracing::warn!("⚠️  检查证书到期失败: {}, 将尝试续期", e);
            Ok(true) // Parse error, assume needs renewal
        }
    }
}
