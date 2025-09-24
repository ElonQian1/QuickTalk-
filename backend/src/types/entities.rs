use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone, sqlx::FromRow)]
pub struct Conversation {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone, sqlx::FromRow)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: DateTime<Utc>,
    #[sqlx(default)]
    pub shop_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, sqlx::FromRow)]
pub struct ConversationSummary {
    pub id: String,
    pub shop_id: String,
    pub customer_name: String,
    pub last_message: String,
    pub updated_at: DateTime<Utc>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Shop {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub api_key: String,
    pub owner_id: String,
    pub status: String,
    pub created_at: String,
    pub payment_status: Option<String>,
    pub subscription_type: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_expires_at: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub contact_info: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SubscriptionPlan {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")] pub plan_type: String,
    pub price: f64,
    pub duration: i32,
    pub max_customers: Option<i32>,
    pub max_agents: Option<i32>,
    pub features: String,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PaymentOrder {
    pub id: String,
    pub shop_id: String,
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    pub payment_method: String,
    pub payment_status: String,
    pub qr_code_url: Option<String>,
    pub payment_url: Option<String>,
    pub third_party_order_id: Option<String>,
    pub subscription_type: String,
    pub subscription_duration: i32,
    pub expires_at: DateTime<Utc>,
    pub paid_at: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationOrder {
    pub id: String,
    pub shop_id: String,
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub payment_method: Option<String>,
    pub qr_code_url: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub paid_at: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Employee {
    pub id: String,
    pub shop_id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone, sqlx::FromRow)]
pub struct Payment {
    pub id: String,
    pub shop_id: String,
    pub amount: f64,
    pub currency: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum PaymentPeriod { Monthly, Yearly }
