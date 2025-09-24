use quicktalk_pure_rust::domain::conversation::{Conversation, ConversationId, InMemoryConversationRepo};
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput, UseCaseError};
use quicktalk_pure_rust::application::events::publisher::EventPublisher;
struct NoopPublisher;
#[async_trait::async_trait]
impl EventPublisher for NoopPublisher { async fn publish(&self, _events: Vec<quicktalk_pure_rust::domain::conversation::DomainEvent>) {} }
use chrono::Utc;

#[tokio::test]
async fn send_message_happy_path() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::new(ConversationId("c1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(conv);
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let out = uc.exec(SendMessageInput { conversation_id: "c1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() }).await.unwrap();
    assert!(!out.message_id.is_empty());
}

#[tokio::test]
async fn reject_empty_message() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::new(ConversationId("c1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(conv);
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let res = uc.exec(SendMessageInput { conversation_id: "c1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "   ".into(), message_type: "text".into() }).await;
    assert!(matches!(res, Err(UseCaseError::Domain(_))));
}

#[tokio::test]
async fn conversation_not_found() {
    let repo = InMemoryConversationRepo::new();
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let res = uc.exec(SendMessageInput { conversation_id: "absent".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() }).await;
    assert!(matches!(res, Err(UseCaseError::NotFound)));
}
