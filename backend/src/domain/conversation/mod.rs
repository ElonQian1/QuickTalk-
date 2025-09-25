use chrono::{DateTime, Utc};

// Strongly typed IDs
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct ConversationId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct MessageId(pub String);

impl From<String> for ConversationId { fn from(s: String) -> Self { Self(s) } }
impl From<&str> for ConversationId { fn from(s: &str) -> Self { Self(s.to_string()) } }
impl From<ConversationId> for String { fn from(v: ConversationId) -> Self { v.0 } }
impl AsRef<str> for ConversationId { fn as_ref(&self) -> &str { &self.0 } }

impl From<String> for MessageId { fn from(s: String) -> Self { Self(s) } }
impl From<&str> for MessageId { fn from(s: &str) -> Self { Self(s.to_string()) } }
impl From<MessageId> for String { fn from(v: MessageId) -> Self { v.0 } }
impl AsRef<str> for MessageId { fn as_ref(&self) -> &str { &self.0 } }

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SenderType { Customer, Agent }

impl SenderType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "customer" => Some(SenderType::Customer),
            "agent" | "admin" => Some(SenderType::Agent),
            _ => None,
        }
    }
    pub fn as_str(&self) -> &'static str { match self { SenderType::Customer => "customer", SenderType::Agent => "agent" } }
}

#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("empty message content")] EmptyMessage,
    #[error("unsupported sender type")] InvalidSenderType,
    #[error("invalid state transition: {0}")] InvalidStateTransition(String),
}

#[derive(Debug, Clone)]
pub struct Message {
    pub id: MessageId,
    pub conversation_id: ConversationId,
    pub sender_id: String,
    pub sender_type: SenderType,
    pub content: String,
    pub message_type: String,
    pub timestamp: DateTime<Utc>,
}

impl Message {
    pub fn new(id: MessageId, conversation_id: ConversationId, sender_id: String, sender_type: SenderType, content: String, message_type: String, timestamp: DateTime<Utc>) -> Result<Self, DomainError> {
        if content.trim().is_empty() { return Err(DomainError::EmptyMessage); }
        Ok(Self { id, conversation_id, sender_id, sender_type, content, message_type, timestamp })
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // 部分字段暂未被读取（后续列表/详情 API 通过仓库访问后会使用）
pub struct Conversation {
    pub id: ConversationId,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<Message>,
    pub pending_events: Vec<DomainEvent>,
}

impl Conversation {
    #[allow(dead_code)] // 新建会话在当前用例路径未直接调用
    pub fn new(id: ConversationId, shop_id: String, customer_id: String, status: String, created_at: DateTime<Utc>) -> Self {
        Self { id, shop_id, customer_id, status, created_at, updated_at: created_at, messages: Vec::new(), pending_events: Vec::new() }
    }

    #[allow(dead_code)]
    pub fn open(id: ConversationId, shop_id: String, customer_id: String, now: DateTime<Utc>) -> Self {
        let mut c = Self::new(id, shop_id, customer_id, "active".into(), now);
        c.pending_events.push(DomainEvent::ConversationOpened { conversation_id: c.id.clone() });
        c
    }

    pub fn close(&mut self, now: DateTime<Utc>) -> Result<(), DomainError> {
        if self.status == "closed" { return Err(DomainError::InvalidStateTransition("already closed".into())); }
        self.status = "closed".into();
        self.updated_at = now;
        self.pending_events.push(DomainEvent::ConversationClosed { conversation_id: self.id.clone() });
        Ok(())
    }

    pub fn reopen(&mut self, now: DateTime<Utc>) -> Result<(), DomainError> {
        if self.status != "closed" { return Err(DomainError::InvalidStateTransition("only closed can reopen".into())); }
        self.status = "active".into();
        self.updated_at = now;
        self.pending_events.push(DomainEvent::ConversationReopened { conversation_id: self.id.clone() });
        Ok(())
    }

    pub fn append_message(&mut self, msg: Message) -> Result<(), DomainError> {
        // 不变式: 消息属于该会话
        if msg.conversation_id != self.id { return Err(DomainError::InvalidSenderType); } // reuse variant (could define new variant ConversationMismatch)
        self.updated_at = msg.timestamp;
        self.messages.push(msg.clone());
        self.pending_events.push(DomainEvent::MessageAppended { conversation_id: self.id.clone(), message_id: msg.id.clone() });
        Ok(())
    }

    #[allow(dead_code)]
    pub fn take_events(&mut self) -> Vec<DomainEvent> { std::mem::take(&mut self.pending_events) }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum DomainEvent {
    MessageAppended { conversation_id: ConversationId, message_id: MessageId },
    ConversationOpened { conversation_id: ConversationId },
    ConversationClosed { conversation_id: ConversationId },
    ConversationReopened { conversation_id: ConversationId },
    // 新增：消息内容更新（应用层用例在成功更新后发布）
    MessageUpdated { conversation_id: ConversationId, message_id: MessageId },
    // 新增：消息删除（soft=true 表示软删除，false 表示硬删除）
    MessageDeleted { conversation_id: ConversationId, message_id: MessageId, soft: bool },
}

// Repository trait (domain-level abstraction)
#[async_trait::async_trait]
pub trait ConversationRepository: Send + Sync {
    async fn find(&self, id: &ConversationId) -> Result<Option<Conversation>, RepoError>;
    async fn save(&self, convo: &Conversation) -> Result<(), RepoError>;
    async fn list(&self, shop_id: Option<&str>) -> Result<Vec<Conversation>, RepoError>;
    async fn create(&self, convo: &Conversation) -> Result<(), RepoError>;
}

// Read-only message query abstraction (避免直接 SQL 泄漏到接口层)
#[async_trait::async_trait]
pub trait MessageReadRepository: Send + Sync {
    async fn list_by_conversation(&self, conversation_id: &ConversationId, limit: i64, offset: i64) -> Result<Vec<Message>, RepoError>;
    async fn find_by_id(&self, id: &MessageId) -> Result<Option<Message>, RepoError>;
}

// 写模型：消息仓库（更新 / 软删除 / 硬删除）
// 说明：
// 1. 更新与删除不通过已加载的 Conversation 聚合（避免为单条消息修改强行装载全集合）
// 2. 事件在应用层用例完成仓库操作后根据结果创建并派发（与 append 场景不同）
// 3. soft_delete 设置 deleted_at，hard_delete 物理删除
#[async_trait::async_trait]
pub trait MessageRepository: Send + Sync {
    async fn find(&self, id: &MessageId) -> Result<Option<Message>, RepoError>;
    async fn update_content(&self, id: &MessageId, new_content: &str) -> Result<(), RepoError>;
    async fn soft_delete(&self, id: &MessageId) -> Result<(), RepoError>;
    async fn hard_delete(&self, id: &MessageId) -> Result<(), RepoError>;
}

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)] // 预留 NotFound 分支供后续扩展（当前实现路径未触发）
pub enum RepoError {
    #[error("not found")] NotFound,
    #[error("database error: {0}")] Database(String),
}

// In-memory repository (for tests / initial use case wiring)
#[allow(dead_code)]
pub struct InMemoryConversationRepo {
    store: std::sync::RwLock<std::collections::HashMap<ConversationId, Conversation>>,
}

impl InMemoryConversationRepo {
    #[allow(dead_code)] pub fn new() -> Self { Self { store: std::sync::RwLock::new(std::collections::HashMap::new()) } }
    #[allow(dead_code)] pub fn insert(&self, c: Conversation) { self.store.write().unwrap().insert(c.id.clone(), c); }
}

#[async_trait::async_trait]
impl ConversationRepository for InMemoryConversationRepo {
    async fn find(&self, id: &ConversationId) -> Result<Option<Conversation>, RepoError> {
        Ok(self.store.read().unwrap().get(id).cloned())
    }
    async fn save(&self, convo: &Conversation) -> Result<(), RepoError> {
        self.store.write().unwrap().insert(convo.id.clone(), convo.clone());
        Ok(())
    }
    async fn list(&self, shop_id: Option<&str>) -> Result<Vec<Conversation>, RepoError> {
        let data = self.store.read().unwrap();
        let mut v: Vec<Conversation> = data.values()
            .filter(|c| shop_id.map(|s| c.shop_id == s).unwrap_or(true))
            .cloned()
            .collect();
        // sort by updated_at desc
        v.sort_by(|a,b| b.updated_at.cmp(&a.updated_at));
        Ok(v)
    }
    async fn create(&self, convo: &Conversation) -> Result<(), RepoError> { self.save(convo).await }
}

// (SendMessage use case moved to application layer)
