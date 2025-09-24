use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use crate::domain::shared::ids::{ConversationId, CustomerId, ShopId, MessageId};
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::events::{DomainEvent, DomainEventKind};
use super::message::{Message};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConversationStatus { Active, Closed, Pending, Archived }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: ConversationId,
    pub shop_id: ShopId,
    pub customer_id: CustomerId,
    pub agent_id: Option<String>,
    pub status: ConversationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub messages: Vec<Message>,
    #[serde(skip)]
    pending_events: Vec<DomainEvent>,
}

impl Conversation {
    pub fn new(shop_id: ShopId, customer_id: CustomerId) -> Self {
        let now = Utc::now();
        Self { id: ConversationId::new(), shop_id, customer_id, agent_id: None, status: ConversationStatus::Active, created_at: now, updated_at: now, closed_at: None, messages: Vec::new(), pending_events: Vec::new() }
    }

    pub fn append_message(&mut self, msg: Message) -> Result<(), DomainError> {
        // 不变式：会话必须是激活状态才能发送消息
        if !matches!(self.status, ConversationStatus::Active) { return Err(DomainError::InvalidState); }
        self.updated_at = Utc::now();
        let event = DomainEvent::message_appended(self.id.clone(), msg.id.clone());
        self.messages.push(msg);
        self.pending_events.push(event);
        Ok(())
    }

    pub fn close(&mut self) { self.status = ConversationStatus::Closed; self.closed_at = Some(Utc::now()); self.updated_at = Utc::now(); }
    pub fn reopen(&mut self) { self.status = ConversationStatus::Active; self.closed_at=None; self.updated_at = Utc::now(); }

    pub fn take_events(&mut self) -> Vec<DomainEvent> { std::mem::take(&mut self.pending_events) }
}
