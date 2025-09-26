use quicktalk_pure_rust::domain::conversation::{Conversation, ConversationId};
use quicktalk_pure_rust::domain::conversation::InMemoryConversationRepo;
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput, UseCaseError};
use quicktalk_pure_rust::application::events::publisher::EventPublisher;
use chrono::Utc;

struct NoopPublisher;
#[async_trait::async_trait]
impl EventPublisher for NoopPublisher { async fn publish(&self, _events: Vec<quicktalk_pure_rust::domain::conversation::DomainEvent>) {} }

#[tokio::test]
async fn send_message_empty_content_fails() {
    let repo = InMemoryConversationRepo::new();
    let convo = Conversation::new(ConversationId("conv_empty".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(convo);
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let input = SendMessageInput { conversation_id: "conv_empty".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "   ".into(), message_type: "text".into() };
    let err = uc.exec(input).await.expect_err("should fail");
    match err { UseCaseError::Domain(_) => {}, _ => panic!("expected domain error for empty content") }
}

#[tokio::test]
async fn send_message_conversation_not_found() {
    let repo = InMemoryConversationRepo::new();
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let input = SendMessageInput { conversation_id: "missing".into(), sender_id: "custX".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() };
    let err = uc.exec(input).await.expect_err("should fail not found");
    match err { UseCaseError::NotFound => {}, other => panic!("unexpected error: {:?}", other) }
}
