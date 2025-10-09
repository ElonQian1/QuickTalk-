use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, TimeZone, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use thiserror::Error;

pub type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Debug, Error)]
pub enum JwtError {
    #[error("invalid token format")]
    InvalidFormat,
    #[error("signature verification failed")]
    InvalidSignature,
    #[error("token expired at {0}")]
    Expired(DateTime<Utc>),
    #[error("encoding error: {0}")]
    Encoding(String),
    #[error("decoding error: {0}")]
    Decoding(String),
}

pub fn encode_token(claims: &Claims, secret: &[u8]) -> Result<String, JwtError> {
    let header = serde_json::json!({
        "alg": "HS256",
        "typ": "JWT"
    });

    let header_json =
        serde_json::to_string(&header).map_err(|e| JwtError::Encoding(e.to_string()))?;
    let payload_json =
        serde_json::to_string(claims).map_err(|e| JwtError::Encoding(e.to_string()))?;

    let header_b64 = URL_SAFE_NO_PAD.encode(header_json);
    let payload_b64 = URL_SAFE_NO_PAD.encode(payload_json);
    let signing_input = format!("{}.{}", header_b64, payload_b64);

    let mut mac =
        HmacSha256::new_from_slice(secret).map_err(|e| JwtError::Encoding(e.to_string()))?;
    mac.update(signing_input.as_bytes());
    let signature = mac.finalize().into_bytes();
    let signature_b64 = URL_SAFE_NO_PAD.encode(signature);

    Ok(format!("{}.{}", signing_input, signature_b64))
}

pub fn decode_token(token: &str, secret: &[u8]) -> Result<Claims, JwtError> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(JwtError::InvalidFormat);
    }

    let signing_input = format!("{}.{}", parts[0], parts[1]);

    let signature = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|e| JwtError::Decoding(e.to_string()))?;
    let mut mac =
        HmacSha256::new_from_slice(secret).map_err(|e| JwtError::Decoding(e.to_string()))?;
    mac.update(signing_input.as_bytes());
    mac.verify_slice(&signature)
        .map_err(|_| JwtError::InvalidSignature)?;

    let payload_json = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|e| JwtError::Decoding(e.to_string()))?;
    let claims: Claims =
        serde_json::from_slice(&payload_json).map_err(|e| JwtError::Decoding(e.to_string()))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| JwtError::Decoding(e.to_string()))?
        .as_secs() as usize;

    if claims.exp < now {
        let exp_time = Utc
            .timestamp_opt(claims.exp as i64, 0)
            .single()
            .unwrap_or_else(Utc::now);
        return Err(JwtError::Expired(exp_time));
    }

    Ok(claims)
}
