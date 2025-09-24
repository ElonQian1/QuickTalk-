// domain types not directly needed in this integration test
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::application::events::publisher::EventPublisher;
struct NoopPublisher; #[async_trait::async_trait] impl EventPublisher for NoopPublisher { async fn publish(&self, _events: Vec<quicktalk_pure_rust::domain::conversation::DomainEvent>) {} }
use quicktalk_pure_rust::db::conversation_repository_sqlx::SqlxConversationRepository;
use chrono::Utc;
use sqlx::{SqlitePool, Executor, Row};

async fn setup_db() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    // minimal schema for test
    pool.execute("CREATE TABLE conversations (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, status TEXT, created_at TEXT, updated_at TEXT);").await.unwrap();
    pool.execute("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, sender_type TEXT, content TEXT, message_type TEXT, timestamp TEXT, shop_id TEXT);").await.unwrap();
    pool
}

#[tokio::test]
async fn repository_save_and_find_with_message() {
    let pool = setup_db().await;
    // seed conversation
    let now = Utc::now();
    sqlx::query("INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("c1").bind("shop1").bind("cust1").bind("active").bind(now).bind(now).execute(&pool).await.unwrap();
    let repo = SqlxConversationRepository { pool: pool.clone() };
    let uc = SendMessageUseCase::new(repo, NoopPublisher);
    let out = uc.exec(SendMessageInput { conversation_id: "c1".into(), sender_id: "cust1".into(), sender_type: "customer".into(), content: "hello via repo".into(), message_type: "text".into() }).await.unwrap();
    assert!(!out.message_id.is_empty());
    // verify persisted
    let row = sqlx::query("SELECT content FROM messages WHERE id = ?").bind(&out.message_id).fetch_one(&pool).await.unwrap();
    let content: String = row.get("content");
    assert_eq!(content, "hello via repo");
}
