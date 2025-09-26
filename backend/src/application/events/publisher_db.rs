use async_trait::async_trait;
use sqlx::SqlitePool;
use crate::application::events::publisher::EventPublisher;
use crate::domain::conversation::DomainEvent;
use crate::application::events::serialization::serialize_event;

// 事件持久化包装器：写入 event_log (列: event_id,event_type,emitted_at,payload_json) 并继续委托内部发布
// 若写入失败仅记录 warn，不影响主流程
pub struct EventPublisherWithDb<P: EventPublisher> { pub inner: P, pub pool: SqlitePool }
impl<P: EventPublisher> EventPublisherWithDb<P> { pub fn new(inner: P, pool: SqlitePool) -> Self { Self { inner, pool } } }

#[async_trait]
impl<P: EventPublisher + Send + Sync> EventPublisher for EventPublisherWithDb<P> {
    async fn publish(&self, events: Vec<DomainEvent>) {
        if events.is_empty() { return; }
        for ev in &events {
            let env = serialize_event(ev.clone(), None);
            if let (Some(event_id), Some(event_type), Some(emitted_at)) = (
                env.get("event_id").and_then(|v| v.as_str()),
                env.get("type").and_then(|v| v.as_str()),
                env.get("emitted_at").and_then(|v| v.as_str()),
            ) {
                if let Err(e) = sqlx::query("INSERT OR IGNORE INTO event_log(event_id,event_type,emitted_at,payload_json) VALUES(?,?,?,?)")
                    .bind(event_id)
                    .bind(event_type)
                    .bind(emitted_at)
                    .bind(env.to_string())
                    .execute(&self.pool).await {
                    tracing::warn!(error=?e, "persist event failed");
                }
            }
        }
        self.inner.publish(events).await;
    }
}