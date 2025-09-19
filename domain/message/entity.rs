// 消息领域实体
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 消息类型枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text,
    Image,
    File,
    Audio,
    Video,
    Emoji,
}

/// 发送者类型枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SenderType {
    Customer,
    Agent,
    System,
}

/// 消息实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: SenderType,
    pub content: String,
    pub message_type: MessageType,
    pub file_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<u64>,
    pub timestamp: DateTime<Utc>,
    pub shop_id: String,
}

/// 消息内容值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContent {
    pub text: String,
    pub message_type: MessageType,
    pub file_info: Option<FileInfo>,
}

/// 文件信息值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub url: String,
    pub name: String,
    pub size: u64,
    pub mime_type: String,
}

impl Message {
    pub fn new_text_message(
        conversation_id: String,
        sender_id: String,
        sender_type: SenderType,
        content: String,
        shop_id: String,
    ) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            conversation_id,
            sender_id,
            sender_type,
            content,
            message_type: MessageType::Text,
            file_url: None,
            file_name: None,
            file_size: None,
            timestamp: Utc::now(),
            shop_id,
        }
    }

    pub fn new_file_message(
        conversation_id: String,
        sender_id: String,
        sender_type: SenderType,
        file_info: FileInfo,
        shop_id: String,
    ) -> Self {
        let message_type = match file_info.mime_type.as_str() {
            t if t.starts_with("image/") => MessageType::Image,
            t if t.starts_with("audio/") => MessageType::Audio,
            t if t.starts_with("video/") => MessageType::Video,
            _ => MessageType::File,
        };

        Self {
            id: uuid::Uuid::new_v4().to_string(),
            conversation_id,
            sender_id,
            sender_type,
            content: file_info.name.clone(),
            message_type,
            file_url: Some(file_info.url),
            file_name: Some(file_info.name),
            file_size: Some(file_info.size),
            timestamp: Utc::now(),
            shop_id,
        }
    }

    pub fn is_from_customer(&self) -> bool {
        matches!(self.sender_type, SenderType::Customer)
    }

    pub fn is_multimedia(&self) -> bool {
        matches!(
            self.message_type,
            MessageType::Image | MessageType::Audio | MessageType::Video | MessageType::File
        )
    }
}