use crate::domain::conversation::DomainEvent;
#[async_trait::async_trait]
pub trait EventPublisher: Send + Sync {
    async fn publish(&self, events: Vec<DomainEvent>);
}

use crate::application::event_bus_rich::EventBusWithDb;
#[async_trait::async_trait]
impl EventPublisher for EventBusWithDb {
    async fn publish(&self, events: Vec<DomainEvent>) { self.publish(events).await }
}
