use quicktalk_pure_rust::domain::conversation::{InMemoryConversationRepo, ConversationId, Conversation};
use quicktalk_pure_rust::application::update_conversation_status::{UpdateConversationStatusUseCase, UpdateConversationStatusInput, UpdateConversationStatusError};
use chrono::Utc;

#[tokio::test]
async fn create_and_close_and_reopen_conversation() {
    let repo = InMemoryConversationRepo::new();
    // 直接用聚合 open，因为 CreateConversationUseCase 当前基于仓库 create（内存实现直接保存）
    let conv = Conversation::open(ConversationId("c1".into()), "shop1".into(), "cust1".into(), Utc::now());
    repo.insert(conv);
    let uc = UpdateConversationStatusUseCase::new(repo);
    // close
    let out_close = uc.exec(UpdateConversationStatusInput { conversation_id: "c1".into(), target_status: "closed".into() }).await.unwrap();
    assert_eq!(out_close.new_status, "closed");
    // reopen
    let out_reopen = uc.exec(UpdateConversationStatusInput { conversation_id: "c1".into(), target_status: "active".into() }).await.unwrap();
    assert_eq!(out_reopen.new_status, "active");
}

#[tokio::test]
async fn invalid_reopen_transition() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::open(ConversationId("c2".into()), "shop1".into(), "cust2".into(), Utc::now());
    repo.insert(conv);
    let uc = UpdateConversationStatusUseCase::new(repo);
    // 直接 active -> active (未关闭) reopen 视为错误
    let res = uc.exec(UpdateConversationStatusInput { conversation_id: "c2".into(), target_status: "active".into() }).await;
    assert!(matches!(res, Err(UpdateConversationStatusError::Domain(_))));
}

#[tokio::test]
async fn close_twice_error() {
    let repo = InMemoryConversationRepo::new();
    let conv = Conversation::open(ConversationId("c3".into()), "shop1".into(), "cust3".into(), Utc::now());
    repo.insert(conv);
    let uc = UpdateConversationStatusUseCase::new(repo);
    uc.exec(UpdateConversationStatusInput { conversation_id: "c3".into(), target_status: "closed".into() }).await.unwrap();
    let res2 = uc.exec(UpdateConversationStatusInput { conversation_id: "c3".into(), target_status: "closed".into() }).await;
    assert!(matches!(res2, Err(UpdateConversationStatusError::Domain(_))));
}
