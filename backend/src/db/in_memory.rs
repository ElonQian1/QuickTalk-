//! In-memory repositories for message tests (no SQLx dependency)
//! 提供 MessageRepository 与 MessageReadRepository 的内存实现，用于快速单元测试
use std::collections::HashMap;
use std::sync::RwLock;
use chrono::{DateTime, Utc};

use crate::domain::conversation::{
    MessageRepository, MessageReadRepository, RepoError, Message, MessageId, ConversationId, SenderType
};

#[derive(Default)]
pub struct InMemoryMessageStore {
    inner: RwLock<HashMap<String, StoredMessage>>, // key = message_id
}

#[derive(Clone)]
struct StoredMessage {
    id: String,
    conversation_id: String,
    sender_id: String,
    sender_type: String,
    content: String,
    message_type: String,
    timestamp: DateTime<Utc>,
    deleted: bool,
}

impl InMemoryMessageStore {
    pub fn new() -> Self { Self { inner: RwLock::new(HashMap::new()) } }
    pub fn insert_domain(&self, m: &Message) {
        let sm = StoredMessage {
            id: m.id.0.clone(),
            conversation_id: m.conversation_id.0.clone(),
            sender_id: m.sender_id.clone(),
            sender_type: m.sender_type.as_str().to_string(),
            content: m.content.clone(),
            message_type: m.message_type.clone(),
            timestamp: m.timestamp,
            deleted: false,
        };
        self.inner.write().unwrap().insert(sm.id.clone(), sm);
    }

    fn to_domain(sm: &StoredMessage) -> Option<Message> {
        if sm.deleted { return None; }
        Some(Message {
            id: MessageId(sm.id.clone()),
            conversation_id: ConversationId(sm.conversation_id.clone()),
            sender_id: sm.sender_id.clone(),
            sender_type: SenderType::from_str(&sm.sender_type).unwrap_or(SenderType::Customer),
            content: sm.content.clone(),
            message_type: sm.message_type.clone(),
            timestamp: sm.timestamp,
        })
    }
}

pub struct InMemoryMessageRepository { store: InMemoryMessageStore }

impl InMemoryMessageRepository { pub fn new() -> Self { Self { store: InMemoryMessageStore::new() } } pub fn store(&self) -> &InMemoryMessageStore { &self.store } }

#[async_trait::async_trait]
impl MessageRepository for InMemoryMessageRepository {
    async fn find(&self, id: &MessageId) -> Result<Option<Message>, RepoError> {
        let guard = self.store.inner.read().unwrap();
        Ok(guard.get(&id.0).and_then(|sm| InMemoryMessageStore::to_domain(sm)))
    }
    async fn update_content(&self, id: &MessageId, new_content: &str) -> Result<(), RepoError> {
        let mut guard = self.store.inner.write().unwrap();
        if let Some(sm) = guard.get_mut(&id.0) { sm.content = new_content.to_string(); Ok(()) } else { Err(RepoError::NotFound) }
    }
    async fn soft_delete(&self, id: &MessageId) -> Result<(), RepoError> {
        let mut guard = self.store.inner.write().unwrap();
        if let Some(sm) = guard.get_mut(&id.0) { sm.deleted = true; Ok(()) } else { Err(RepoError::NotFound) }
    }
    async fn hard_delete(&self, id: &MessageId) -> Result<(), RepoError> {
        let mut guard = self.store.inner.write().unwrap();
        if guard.remove(&id.0).is_some() { Ok(()) } else { Err(RepoError::NotFound) }
    }
}

#[async_trait::async_trait]
impl MessageReadRepository for InMemoryMessageRepository {
    async fn list_by_conversation(&self, conversation_id: &ConversationId, limit: i64, offset: i64) -> Result<Vec<Message>, RepoError> {
        let guard = self.store.inner.read().unwrap();
        let mut v: Vec<_> = guard.values()
            .filter(|sm| sm.conversation_id == conversation_id.0 && !sm.deleted)
            .cloned()
            .collect();
        v.sort_by(|a,b| a.timestamp.cmp(&b.timestamp));
        let start = offset.max(0) as usize;
        let end = (start + limit.max(0) as usize).min(v.len());
        let slice = if start >= v.len() { &[][..] } else { &v[start..end] };
        Ok(slice.iter().filter_map(InMemoryMessageStore::to_domain).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    #[tokio::test]
    async fn in_memory_repo_basic_flow() {
        let repo = InMemoryMessageRepository::new();
        let msg = Message::new(
            MessageId("m1".into()),
            ConversationId("c1".into()),
            "u1".into(),
            SenderType::Customer,
            "hello".into(),
            "text".into(),
            Utc::now()
        ).unwrap();
        repo.store.insert_domain(&msg);
        let found = repo.find(&MessageId("m1".into())).await.unwrap();
        assert!(found.is_some());
        repo.update_content(&MessageId("m1".into()), "world").await.unwrap();
        let list = repo.list_by_conversation(&ConversationId("c1".into()), 10, 0).await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].content, "world");
        repo.soft_delete(&MessageId("m1".into())).await.unwrap();
        let list2 = repo.list_by_conversation(&ConversationId("c1".into()), 10, 0).await.unwrap();
        assert_eq!(list2.len(), 0); // filtered
    }
}
