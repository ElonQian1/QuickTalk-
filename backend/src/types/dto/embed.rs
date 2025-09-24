use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GenerateCodeResponse { pub platform: String, pub code: String, pub instructions: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedConfig { pub version: String, pub shop_id: String, pub shop_name: String, pub websocket_url: String, pub features: Vec<String>, pub theme: EmbedTheme, pub limits: EmbedLimits, pub security: EmbedSecurity }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedTheme { pub color: Option<String> }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedLimits { pub max_messages_per_minute: Option<u32> }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedSecurity { pub domain_whitelist: Option<Vec<String>> }
