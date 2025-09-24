use quicktalk_pure_rust::domain::conversation::{Conversation, ConversationId};
use quicktalk_pure_rust::domain::conversation::InMemoryConversationRepo;
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::domain::conversation::DomainEvent;
use chrono::Utc;
use std::sync::{Arc, Mutex};

// 简单 Mock Publisher 记录事件
struct MockPublisher { events: Arc<Mutex<Vec<DomainEvent>>> }
impl MockPublisher { fn new() -> Self { Self { events: Arc::new(Mutex::new(Vec::new())) } } }

#[async_trait::async_trait]
impl quicktalk_pure_rust::application::events::publisher::EventPublisher for MockPublisher {
    async fn publish(&self, events: Vec<DomainEvent>) { self.events.lock().unwrap().extend(events); }
}

#[tokio::test]
async fn send_message_publishes_events_via_publisher() {
    let repo = InMemoryConversationRepo::new();
    let convo = Conversation::new(ConversationId("conv2".into()), "shop1".into(), "cust2".into(), "active".into(), Utc::now());
    repo.insert(convo);
    let publisher = MockPublisher::new();
    let captured = publisher.events.clone();
    let uc = SendMessageUseCase::new(repo, publisher);
    let input = SendMessageInput { conversation_id: "conv2".into(), sender_id: "cust2".into(), sender_type: "customer".into(), content: "hi".into(), message_type: "text".into() };
    let out = uc.exec(input).await.expect("usecase success");
    assert_eq!(out.events.len(), 1, "one event returned");
    let stored = captured.lock().unwrap();
    assert_eq!(stored.len(), 1, "publisher captured one event");
}