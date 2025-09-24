use quicktalk_pure_rust::domain::conversation::{Conversation, ConversationId, InMemoryConversationRepo};
use quicktalk_pure_rust::application::send_message::{SendMessageUseCase, SendMessageInput, UseCaseError};
use chrono::Utc;

#[tokio::test]
async fn send_message_happy_path() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::new(ConversationId("c1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(conv);
    let uc = SendMessageUseCase::new(repo);
    let out = uc.exec(SendMessageInput { conversation_id: "c1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() }).await.unwrap();
    assert!(!out.message_id.is_empty());
}

#[tokio::test]
async fn reject_empty_message() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::new(ConversationId("c1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(conv);
    let uc = SendMessageUseCase::new(repo);
    let res = uc.exec(SendMessageInput { conversation_id: "c1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "   ".into(), message_type: "text".into() }).await;
    assert!(matches!(res, Err(UseCaseError::Domain(_))));
}

#[tokio::test]
async fn conversation_not_found() {
    let repo = InMemoryConversationRepo::new();
    let uc = SendMessageUseCase::new(repo);
    let res = uc.exec(SendMessageInput { conversation_id: "absent".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() }).await;
    assert!(matches!(res, Err(UseCaseError::NotFound)));
}
