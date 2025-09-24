use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
pub struct LoginRequest { pub username: String, pub password: String }

#[derive(Deserialize, Debug, Clone)]
pub struct RegisterRequest { pub username: String, pub email: String, pub password: String }
