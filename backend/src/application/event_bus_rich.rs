use tokio::sync::broadcast;
use sqlx::{SqlitePool, Row};
use crate::domain::conversation::DomainEvent;
use crate::application::events::serialization::serialize_event;
use crate::domain::conversation::{MessageId};
use crate::db::event_log_repository_sqlx::EventLogRepositorySqlx;

// 富事件总线: 对部分事件附带完整资源（如消息）
#[derive(Clone)]
pub struct EventBusWithDb {
    sender: broadcast::Sender<String>,
    pool: SqlitePool,
    // 可选持久化：为空则仅广播
    event_log: Option<EventLogRepositorySqlx>,
}

impl EventBusWithDb {
    pub fn new(sender: broadcast::Sender<String>, pool: SqlitePool) -> Self { Self { sender, pool: pool.clone(), event_log: Some(EventLogRepositorySqlx::new(pool)) } }
    #[allow(dead_code)]
    pub fn without_persistence(sender: broadcast::Sender<String>, pool: SqlitePool) -> Self { Self { sender, pool, event_log: None } }

    pub async fn publish(&self, events: Vec<DomainEvent>) {
        let mut serialized = Vec::with_capacity(events.len());
        for ev in events {
            let value = match ev {
                DomainEvent::MessageAppended { conversation_id, message_id } => {
                    let enrich = self.load_message_json(&message_id).await.map(|m| serde_json::json!({"message": m}));
                    serialize_event(DomainEvent::MessageAppended { conversation_id, message_id }, enrich)
                }
                DomainEvent::MessageUpdated { conversation_id, message_id } => {
                    let enrich = self.load_message_json(&message_id).await.map(|m| serde_json::json!({"message": m}));
                    serialize_event(DomainEvent::MessageUpdated { conversation_id, message_id }, enrich)
                }
                DomainEvent::MessageDeleted { conversation_id, message_id, soft } => {
                    let enrich = Some(serde_json::json!({"soft": soft}));
                    serialize_event(DomainEvent::MessageDeleted { conversation_id, message_id, soft }, enrich)
                }
                DomainEvent::ConversationOpened { conversation_id } => serialize_event(DomainEvent::ConversationOpened { conversation_id }, None),
                DomainEvent::ConversationClosed { conversation_id } => serialize_event(DomainEvent::ConversationClosed { conversation_id }, None),
                DomainEvent::ConversationReopened { conversation_id } => serialize_event(DomainEvent::ConversationReopened { conversation_id }, None),
                DomainEvent::ShopCreated { shop_id } => serialize_event(DomainEvent::ShopCreated { shop_id }, None),
                DomainEvent::ShopUpdated { shop_id } => serialize_event(DomainEvent::ShopUpdated { shop_id }, None),
                DomainEvent::ShopStatusChanged { shop_id, old_status, new_status } => serialize_event(DomainEvent::ShopStatusChanged { shop_id, old_status, new_status }, None),
            };
            serialized.push(value);
        }
        // 持久化（忽略错误继续广播）
        if let Some(repo) = &self.event_log {
            if let Err(e) = repo.append_batch(&serialized).await { tracing::warn!(error=?e, "event log append failed"); }
        }
        for val in serialized { let _ = self.sender.send(val.to_string()); }
    }

    async fn load_message_json(&self, message_id: &MessageId) -> Option<serde_json::Value> {
        let opt = sqlx::query("SELECT id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id FROM messages WHERE id = ? AND deleted_at IS NULL")
            .bind(&message_id.0)
            .fetch_optional(&self.pool).await.ok()?;
        let row = opt?; // unwrap option
        Some(serde_json::json!({
            "id": row.get::<String,_>("id"),
            "conversation_id": row.get::<String,_>("conversation_id"),
            "sender_id": row.get::<String,_>("sender_id"),
            "sender_type": row.get::<String,_>("sender_type"),
            "content": row.get::<String,_>("content"),
            "message_type": row.get::<String,_>("message_type"),
            "timestamp": row.get::<String,_>("timestamp"),
            "shop_id": row.try_get::<String,_>("shop_id").ok(),
        }))
    }
}

// 可选：异步发布 trait（暂不在其它地方使用）
#[allow(dead_code)]
#[async_trait::async_trait]
pub trait AsyncEventPublisher {
    async fn publish(&self, events: Vec<DomainEvent>);
}

#[async_trait::async_trait]
impl AsyncEventPublisher for EventBusWithDb {
    async fn publish(&self, events: Vec<DomainEvent>) { self.publish(events).await }
}