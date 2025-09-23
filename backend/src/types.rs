use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

// WebSocket 连接管理
pub type WebSocketConnections = Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>;

// 通用API响应
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: String,
}

// 应用全局状态
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    pub ws_connections: WebSocketConnections,
    pub message_sender: broadcast::Sender<String>,
}

// 基础实体与DTO
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
    #[serde(rename = "type")]
    pub plan_type: String,
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

#[derive(Deserialize, Debug, Default)]
pub struct UpdateShopRequest {
    pub name: Option<String>,
    pub domain: Option<String>,
    pub plan: Option<String>,
}

#[derive(Deserialize)]
pub struct AddEmployeeRequest {
    pub email: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateEmployeeRequest {
    pub role: String,
}

#[derive(Deserialize)]
pub struct GenerateCodeRequest {
    pub platform: String, // "html", "react", "php", "python"
    pub customization: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
pub struct GenerateCodeResponse {
    pub platform: String,
    pub code: String,
    pub instructions: String,
}

// 用户与邀请
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub name: String,
    pub phone: Option<String>,
    pub avatar: Option<String>,
    pub role: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmployeeInvitation {
    pub id: String,
    pub shop_id: String,
    pub inviter_id: String,
    pub invitee_email: String,
    pub invitee_id: Option<String>,
    pub role: String,
    pub message: Option<String>,
    pub token: String,
    pub status: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
}

// 员工邀请请求
#[derive(Deserialize, Debug, Clone)]
pub struct InviteEmployeeRequest {
    pub email: String,
    pub role: String,
    pub message: String,
}

// Activation 相关响应
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationOrderResponse {
    pub order_id: String,
    pub shop_id: String,
    pub shop_name: String,
    pub order_number: String,
    pub amount: f64,
    pub currency: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct ActivationPaymentRequest {
    pub payment_method: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationQRResponse {
    pub order_id: String,
    pub qr_code_url: String,
    pub amount: f64,
    pub payment_method: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivationOrderStatusResponse {
    pub order: ActivationOrder,
}

// 会话/消息
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

#[derive(Deserialize, Debug, Clone)]
pub struct CreateConversationRequest {
    pub shop_id: String,
    pub customer_id: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct CreateMessageRequest {
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub content: String,
    pub message_type: String,
}

#[derive(Deserialize)]
pub struct UpdateMessageRequest {
    pub content: String,
}

#[derive(Deserialize)]
pub struct UpdateConversationStatusRequest {
    pub status: String,
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

// 店铺创建请求
#[derive(Deserialize, Debug, Clone)]
pub struct CreateShopRequest {
    pub name: String,
    pub domain: String,
    pub owner_id: Option<String>,
}

// 店铺登录请求
#[derive(Deserialize, Debug, Clone)]
pub struct ShopLoginRequest {
    pub domain: String,
    pub password: String,
}

// 支付订单创建请求
#[derive(Deserialize, Debug, Clone)]
pub struct CreatePaymentOrderRequest {
    pub shop_id: String,
    pub payment_method: String,
    pub subscription_type: String,
    pub subscription_duration: i32,
    pub amount: f64,
    pub currency: Option<String>,
}

// Embed 配置
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedConfig {
    pub version: String,
    pub shop_id: String,
    pub shop_name: String,
    pub websocket_url: String,
    pub features: Vec<String>,
    pub theme: EmbedTheme,
    pub limits: EmbedLimits,
    pub security: EmbedSecurity,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedTheme { pub color: Option<String> }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedLimits { pub max_messages_per_minute: Option<u32> }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmbedSecurity { pub domain_whitelist: Option<Vec<String>> }

// 管理认证
#[derive(Deserialize, Debug, Clone)]
pub struct LoginRequest { pub username: String, pub password: String }

#[derive(Deserialize, Debug, Clone)]
pub struct RegisterRequest { pub username: String, pub email: String, pub password: String }

// WebSocket 消息
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WebSocketMessage {
    #[serde(rename = "type")]
    pub r#type: String,
    pub session_id: Option<String>,
    pub conversation_id: Option<String>,
    pub sender_id: Option<String>,
    pub content: Option<String>,
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

#[derive(Deserialize, Debug, Clone)]
pub struct NewPayment {
    pub shop_id: String,
    pub amount: f64,
    pub currency: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum PaymentPeriod {
    Monthly,
    Yearly,
}
