// 商店领域实体
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 商店状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ShopStatus {
    Active,
    Inactive, 
    Suspended,
    PendingApproval,
}

/// 商店实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shop {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub api_key: String,
    pub status: ShopStatus,
    pub created_at: DateTime<Utc>,
}

/// 商店配置值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopConfig {
    pub name: String,
    pub domain: String,
}

impl Shop {
    pub fn new(name: String, domain: String) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            domain,
            api_key: uuid::Uuid::new_v4().to_string(),
            status: ShopStatus::PendingApproval,
            created_at: Utc::now(),
        }
    }

    pub fn activate(&mut self) {
        self.status = ShopStatus::Active;
    }

    pub fn suspend(&mut self) {
        self.status = ShopStatus::Suspended;
    }

    pub fn is_active(&self) -> bool {
        matches!(self.status, ShopStatus::Active)
    }
}