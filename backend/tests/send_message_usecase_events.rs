use quicktalk_pure_rust::domain::conversation::{Conversation, ConversationId};
use quicktalk_pure_rust::domain::conversation::InMemoryConversationRepo;
use quicktalk_pure_rust::domain::conversation::DomainEvent;
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::application::events::publisher::EventPublisher;
struct NoopPublisher;
#[async_trait::async_trait]
impl EventPublisher for NoopPublisher { async fn publish(&self, _events: Vec<quicktalk_pure_rust::domain::conversation::DomainEvent>) {} }
use chrono::Utc;

#[tokio::test]
async fn send_message_emits_event_and_persists_in_memory() {
    let repo = InMemoryConversationRepo::new();
    // 预置一个会话
    let convo = Conversation::new(ConversationId("conv1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(convo.clone());

    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let input = SendMessageInput { conversation_id: "conv1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() };
    let out = uc.exec(input).await.expect("usecase success");
    assert_eq!(out.events.len(), 1, "one event produced");
    match &out.events[0] { DomainEvent::MessageAppended { conversation_id, message_id } => {
        assert_eq!(conversation_id.0, "conv1");
        assert!(!message_id.0.is_empty());
    }, _ => panic!("unexpected event") }
}
