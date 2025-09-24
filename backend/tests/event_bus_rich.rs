use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::db::conversation_repository_sqlx::SqlxConversationRepository;
use quicktalk_pure_rust::application::event_bus_rich::EventBusWithDb;
use chrono::Utc;
use sqlx::{SqlitePool, Executor};
use tokio::time::{timeout, Duration};

async fn setup_db() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    pool.execute("CREATE TABLE conversations (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, status TEXT, created_at TEXT, updated_at TEXT);").await.unwrap();
    pool.execute("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, sender_type TEXT, content TEXT, message_type TEXT, timestamp TEXT, shop_id TEXT, deleted_at TEXT);").await.unwrap();
    pool
}

#[tokio::test]
async fn event_bus_rich_appended_includes_message_payload() {
    let pool = setup_db().await;
    // seed conversation
    let now = Utc::now();
    sqlx::query("INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("c100")
        .bind("shopX")
        .bind("custZ")
        .bind("active")
        .bind(now)
        .bind(now)
        .execute(&pool).await.unwrap();

    // broadcast channel
    let (tx, mut rx) = tokio::sync::broadcast::channel::<String>(16);

    // use case
    let repo = SqlxConversationRepository { pool: pool.clone() };
    let uc = SendMessageUseCase::new(repo);
    let out = uc.exec(SendMessageInput { conversation_id: "c100".into(), sender_id: "custZ".into(), sender_type: "customer".into(), content: "hello-rich".into(), message_type: "text".into() }).await.unwrap();

    // publish events (simulate API layer behavior)
    let bus = EventBusWithDb::new(tx.clone(), pool.clone());
    bus.publish(out.events.clone()).await;

    // receive
    let received = timeout(Duration::from_secs(1), rx.recv()).await.expect("timeout").expect("channel closed");
    let json: serde_json::Value = serde_json::from_str(&received).unwrap();
    assert_eq!(json["version"], "v1");
    assert_eq!(json["type"], "domain.event.message_appended");
    assert!(json["event_id"].as_str().unwrap().len() > 10);
    assert!(json["emitted_at"].as_str().unwrap().contains('T'));
    assert!(json["data"]["message"].is_object(), "message object missing");
    assert_eq!(json["data"]["message"]["content"], "hello-rich");
}
