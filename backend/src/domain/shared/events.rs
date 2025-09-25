use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use crate::domain::shared::ids::{ConversationId, MessageId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DomainEventKind {
    ConversationMessageAppended,
    ConversationClosed,
    ConversationReopened,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    pub kind: DomainEventKind,
    pub conversation_id: ConversationId,
    pub message_id: Option<MessageId>,
    pub occurred_at: DateTime<Utc>,
}

impl DomainEvent {
    pub fn message_appended(conversation_id: ConversationId, message_id: MessageId) -> Self {
        Self { kind: DomainEventKind::ConversationMessageAppended, conversation_id, message_id: Some(message_id), occurred_at: Utc::now() }
    }
    pub fn conversation_closed(conversation_id: ConversationId) -> Self {
        Self { kind: DomainEventKind::ConversationClosed, conversation_id, message_id: None, occurred_at: Utc::now() }
    }
    pub fn conversation_reopened(conversation_id: ConversationId) -> Self {
        Self { kind: DomainEventKind::ConversationReopened, conversation_id, message_id: None, occurred_at: Utc::now() }
    }
}
