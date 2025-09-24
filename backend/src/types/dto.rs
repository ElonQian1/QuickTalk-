use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

// 请求 DTO
#[derive(Deserialize, Debug, Clone)]
pub struct CreateConversationRequest { pub shop_id: String, pub customer_id: String }
#[derive(Deserialize, Debug, Clone)]
pub struct CreateMessageRequest { pub conversation_id: String, pub sender_id: String, pub sender_type: String, pub content: String, pub message_type: String }
#[derive(Deserialize)] pub struct UpdateMessageRequest { pub content: String }
#[derive(Deserialize)] pub struct UpdateConversationStatusRequest { pub status: String }
#[derive(Deserialize, Debug, Clone)] pub struct CreateShopRequest { pub name: String, pub domain: String, pub owner_id: Option<String> }
#[derive(Deserialize, Debug, Clone)] pub struct ShopLoginRequest { pub domain: String, pub password: String }
#[derive(Deserialize, Debug, Clone)] pub struct CreatePaymentOrderRequest { pub shop_id: String, pub payment_method: String, pub subscription_type: String, pub subscription_duration: i32, pub amount: f64, pub currency: Option<String> }
#[derive(Deserialize, Debug, Clone)] pub struct ActivationPaymentRequest { pub payment_method: String }
#[derive(Deserialize, Debug, Clone)] pub struct AddEmployeeRequest { pub email: String, pub role: String }
#[derive(Deserialize)] pub struct UpdateEmployeeRequest { pub role: String }
#[derive(Deserialize, Debug, Clone)] pub struct InviteEmployeeRequest { pub email: String, pub role: String, pub message: String }
#[derive(Deserialize, Debug, Clone, Default)] pub struct UpdateShopRequest { pub name: Option<String>, pub domain: Option<String>, pub plan: Option<String> }
#[derive(Deserialize, Debug, Clone)] pub struct GenerateCodeRequest { pub platform: String, pub customization: Option<HashMap<String,String>> }
#[derive(Deserialize, Debug, Clone)] pub struct LoginRequest { pub username: String, pub password: String }
#[derive(Deserialize, Debug, Clone)] pub struct RegisterRequest { pub username: String, pub email: String, pub password: String }
#[derive(Deserialize, Debug, Clone)] pub struct NewPayment { pub shop_id: String, pub amount: f64, pub currency: String }

// 响应 DTO
#[derive(Serialize, Debug)] pub struct GenerateCodeResponse { pub platform: String, pub code: String, pub instructions: String }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct ActivationOrderResponse { pub order_id: String, pub shop_id: String, pub shop_name: String, pub order_number: String, pub amount: f64, pub currency: String, pub expires_at: DateTime<Utc> }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct ActivationQRResponse { pub order_id: String, pub qr_code_url: String, pub amount: f64, pub payment_method: String }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct ActivationOrderStatusResponse { pub order: crate::types::entities::ActivationOrder }

// 其他结构
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct User { pub id: String, pub username: String, pub email: String, pub name: String, pub phone: Option<String>, pub avatar: Option<String>, pub role: String, pub status: String, pub created_at: String }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct EmployeeInvitation { pub id: String, pub shop_id: String, pub inviter_id: String, pub invitee_email: String, pub invitee_id: Option<String>, pub role: String, pub message: Option<String>, pub token: String, pub status: String, pub expires_at: DateTime<Utc>, pub created_at: DateTime<Utc>, pub responded_at: Option<DateTime<Utc>> }

// 嵌入配置
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct EmbedConfig { pub version: String, pub shop_id: String, pub shop_name: String, pub websocket_url: String, pub features: Vec<String>, pub theme: EmbedTheme, pub limits: EmbedLimits, pub security: EmbedSecurity }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct EmbedTheme { pub color: Option<String> }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct EmbedLimits { pub max_messages_per_minute: Option<u32> }
#[derive(Serialize, Deserialize, Debug, Clone)] pub struct EmbedSecurity { pub domain_whitelist: Option<Vec<String>> }
