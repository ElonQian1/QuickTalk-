// 对话领域实体
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// 对话状态枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConversationStatus {
    Active,
    Closed,
    Pending,
    Archived,
}

/// 对话实体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub agent_id: Option<String>,
    pub status: ConversationStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
}

/// 对话摘要值对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: String,
    pub customer_name: String,
    pub last_message: Option<String>,
    pub last_message_time: Option<DateTime<Utc>>,
    pub unread_count: u64,
    pub status: ConversationStatus,
}

impl Conversation {
    pub fn new(shop_id: String, customer_id: String) -> Self {
        let now = Utc::now();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            shop_id,
            customer_id,
            agent_id: None,
            status: ConversationStatus::Active,
            created_at: now,
            updated_at: now,
            closed_at: None,
        }
    }

    pub fn assign_agent(&mut self, agent_id: String) {
        self.agent_id = Some(agent_id);
        self.updated_at = Utc::now();
    }

    pub fn close(&mut self) {
        self.status = ConversationStatus::Closed;
        self.closed_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    pub fn reopen(&mut self) {
        self.status = ConversationStatus::Active;
        self.closed_at = None;
        self.updated_at = Utc::now();
    }

    pub fn archive(&mut self) {
        self.status = ConversationStatus::Archived;
        self.updated_at = Utc::now();
    }

    pub fn is_active(&self) -> bool {
        matches!(self.status, ConversationStatus::Active)
    }

    pub fn is_closed(&self) -> bool {
        matches!(self.status, ConversationStatus::Closed)
    }

    pub fn touch(&mut self) {
        self.updated_at = Utc::now();
    }
}