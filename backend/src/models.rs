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
#[serde(rename_all = "camelCase")]
pub struct WebSocketMessage {
    pub message_type: String, // 事件名：auth_success/new_message/typing/system
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSocketIncomingMessage {
    pub message_type: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub session_id: Option<i64>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub file_url: Option<String>,
    #[serde(default)]
    pub file_name: Option<String>,
    #[serde(default)]
    pub file_size: Option<i64>,
    #[serde(default)]
    pub media_duration: Option<f64>,
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

impl From<crate::entities::users::Model> for UserPublic {
    fn from(user: crate::entities::users::Model) -> Self {
        UserPublic {
            id: user.id as i64,
            username: user.username,
            email: user.email,
            phone: user.phone,
            avatar_url: user.avatar_url,
        }
    }
}

impl From<crate::entities::sessions::Model> for Session {
    fn from(session: crate::entities::sessions::Model) -> Self {
        Session {
            id: session.id as i64,
            shop_id: session.shop_id as i64,
            customer_id: session.customer_id as i64,
            staff_id: session.staff_id.map(|id| id as i64),
            session_status: session.status,
            created_at: session.created_at.and_utc(),
            closed_at: session.closed_at.map(|dt| dt.and_utc()),
            last_message_at: session.last_message_at.unwrap_or(session.created_at).and_utc(),
        }
    }
}

impl From<crate::entities::customers::Model> for Customer {
    fn from(customer: crate::entities::customers::Model) -> Self {
        Customer {
            id: customer.id as i64,
            shop_id: customer.shop_id as i64,
            customer_id: customer.customer_id,
            customer_name: customer.name,
            customer_email: customer.email,
            customer_avatar: customer.avatar_url,
            ip_address: customer.ip_address,
            user_agent: customer.user_agent,
            first_visit_at: customer.first_visit_at.map(|dt| dt.and_utc()).unwrap_or_else(|| chrono::Utc::now()),
            last_active_at: customer.last_active_at.map(|dt| dt.and_utc()).unwrap_or_else(|| chrono::Utc::now()),
            status: customer.status.unwrap_or(1), // 默认状态为1 (active)
        }
    }
}

impl From<crate::entities::messages::Model> for Message {
    fn from(message: crate::entities::messages::Model) -> Self {
        // 调试日志：打印原始消息内容
        eprintln!("🔍 转换消息模型: id={}, content='{}'", message.id, message.content);
        
        // file_url 可能存储在 metadata 中
        let file_url = message.metadata.as_ref()
            .and_then(|m| m.get("file_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        // sender_id 在数据库中是TEXT，需要解析为i64
        let sender_id = message.sender_id
            .and_then(|s| s.parse::<i64>().ok());
        
        let result = Message {
            id: message.id as i64,
            session_id: message.session_id as i64,
            sender_type: message.sender_type,
            sender_id, // 从String解析为i64
            content: message.content.clone(),
            message_type: message.message_type,
            file_url, // 从 metadata 提取
            status: if message.is_deleted { "deleted".to_string() } else { "active".to_string() },
            created_at: message.created_at.and_utc(),
        };
        
        eprintln!("✅ 转换后的消息: id={}, content='{}'", result.id, result.content);
        result
    }
}

// 输入 DTO：用于创建/更新客户信息（减少函数参数个数）
#[derive(Debug, Clone, Default, Serialize)]
pub struct CustomerUpsert<'a> {
    pub name: Option<&'a str>,
    pub email: Option<&'a str>,
    pub avatar: Option<&'a str>,
    pub ip: Option<&'a str>,
    pub user_agent: Option<&'a str>,
}

// 用户资料更新请求
#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
}

// 修改密码请求
#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}
