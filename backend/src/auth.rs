use crate::jwt::{decode_token, Claims, JwtError};

const JWT_SECRET: &[u8] = b"your-secret-key";

pub fn verify_token(token: &str) -> Result<Claims, JwtError> {
    decode_token(token, JWT_SECRET)
}
