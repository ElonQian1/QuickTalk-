use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// 用户模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub status: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// 店铺模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Shop {
    pub id: i64,
    pub owner_id: i64,
    pub shop_name: String,
    pub shop_url: Option<String>,
    pub api_key: String,
    pub status: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// 客户模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Customer {
    pub id: i64,
    pub shop_id: i64,
    pub customer_id: String,
    pub customer_name: Option<String>,
    pub customer_email: Option<String>,
    pub customer_avatar: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub first_visit_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub status: i32,
}

// 会话模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: i64,
    pub shop_id: i64,
    pub customer_id: i64,
    pub staff_id: Option<i64>,
    pub session_status: String,
    pub created_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub last_message_at: DateTime<Utc>,
}

// 消息模型
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: i64,
    pub session_id: i64,
    pub sender_type: String,
    pub sender_id: Option<i64>,
    pub content: String,
    pub message_type: String,
    pub file_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

// 未读消息统计
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UnreadCount {
    pub id: i64,
    pub shop_id: i64,
    pub customer_id: i64,
    pub unread_count: i32,
    pub last_read_message_id: Option<i64>,
    pub updated_at: DateTime<Utc>,
}

// WebSocket 消息格式
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub content: Option<String>,
    pub session_id: Option<i64>,
    pub sender_id: Option<i64>,
    pub sender_type: Option<String>,
    pub timestamp: Option<DateTime<Utc>>,
    pub metadata: Option<serde_json::Value>,
}

// API 请求/响应模型
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserPublic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPublic {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateShopRequest {
    pub shop_name: String,
    pub shop_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ShopWithUnreadCount {
    pub shop: Shop,
    pub unread_count: i32,
}

#[derive(Debug, Serialize)]
pub struct CustomerWithSession {
    pub customer: Customer,
    pub session: Option<Session>,
    pub last_message: Option<Message>,
    pub unread_count: i32,
}

#[derive(Debug, Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub message_type: Option<String>,
    pub file_url: Option<String>,
}

impl From<User> for UserPublic {
    fn from(user: User) -> Self {
        UserPublic {
            id: user.id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            avatar_url: user.avatar_url,
        }
    }
}