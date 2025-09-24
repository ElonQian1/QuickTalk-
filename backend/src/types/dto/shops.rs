use serde::Deserialize;
use std::collections::HashMap;

// CreateShopRequest: 目前 API create_shop 已临时改为使用 UpdateShopRequest 逻辑，保留供后续恢复严格创建校验
#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct CreateShopRequest { pub name: String, pub domain: String, pub owner_id: Option<String> }

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct ShopLoginRequest { pub domain: String, pub password: String }

#[derive(Deserialize, Debug, Clone, Default)]
pub struct UpdateShopRequest { pub name: Option<String>, pub domain: Option<String>, pub plan: Option<String> }

#[allow(dead_code)]
#[derive(Deserialize, Debug, Clone)]
pub struct GenerateCodeRequest { pub platform: String, pub customization: Option<HashMap<String,String>> }
