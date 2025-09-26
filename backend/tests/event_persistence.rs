use sqlx::SqlitePool;
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::domain::conversation::{InMemoryConversationRepo, Conversation, ConversationId};
use chrono::Utc;
use quicktalk_pure_rust::application::event_bus_rich::EventBusWithDb;
use tokio::sync::broadcast;

#[tokio::test]
async fn send_message_persists_event_in_event_log() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    // 最小 schema: conversations, messages, event_log
    quicktalk_pure_rust::bootstrap::migrations::run_migrations(&pool).await.unwrap();

    // 准备聚合
    let conv_repo = InMemoryConversationRepo::new();
    let cid = ConversationId("conv-ep".into());
    let convo = Conversation::new(cid.clone(), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    conv_repo.insert(convo);

    // 事件总线（含持久化）
    let (tx, _rx) = broadcast::channel(16);
    let bus = EventBusWithDb::new(tx, pool.clone());
    let use_case = SendMessageUseCase::new(conv_repo, bus);
    let _out = use_case.exec(SendMessageInput { conversation_id: cid.0.clone(), sender_id: "u1".into(), sender_type: "customer".into(), content: "persist".into(), message_type: "text".into() }).await.unwrap();

    // 验证 event_log 表存在记录
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM event_log")
        .fetch_one(&pool).await.unwrap();
    assert!(count.0 >= 1, "expected at least one event persisted, got {}", count.0);
}
