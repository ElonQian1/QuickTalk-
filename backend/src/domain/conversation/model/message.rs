use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use crate::domain::shared::ids::{MessageId, ConversationId, CustomerId};
use crate::domain::shared::errors::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SenderType { Customer, Agent }
impl SenderType { pub fn from_str(s: &str) -> Option<Self> { match s { "customer"=>Some(Self::Customer), "agent"=>Some(Self::Agent), _=>None } } }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: MessageId,
    pub conversation_id: ConversationId,
    pub sender_id: String,
    pub sender_type: SenderType,
    pub content: String,
    pub message_type: String,
    pub created_at: DateTime<Utc>,
}
impl Message {
    pub fn new(id: MessageId, conversation_id: ConversationId, sender_id: String, sender_type: SenderType, content: String, message_type: String, created_at: DateTime<Utc>) -> Result<Self, DomainError> {
        if content.trim().is_empty() { return Err(DomainError::EmptyMessage); }
        Ok(Self { id, conversation_id, sender_id, sender_type, content, message_type, created_at })
    }
}
