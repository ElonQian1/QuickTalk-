// 客户领域实体
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 客户实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// 客户值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerProfile {
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
}

impl Customer {
    pub fn new(name: String, email: Option<String>, phone: Option<String>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            email,
            phone,
            avatar: None,
            created_at: Utc::now(),
        }
    }

    pub fn update_profile(&mut self, profile: CustomerProfile) {
        self.name = profile.name;
        self.email = profile.email;
        self.phone = profile.phone;
    }
}