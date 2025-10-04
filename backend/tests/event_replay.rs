use sqlx::SqlitePool;
use chrono::Utc;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use quicktalk_pure_rust::bootstrap::app_state::AppState;
use quicktalk_pure_rust::db::{conversation_repository_sqlx::SqlxConversationRepository, message_repository_sqlx::MessageRepositorySqlx, message_read_repository_sqlx::MessageReadRepositorySqlx};
use quicktalk_pure_rust::application::event_bus_rich::EventBusWithDb;
use quicktalk_pure_rust::domain::conversation::{DomainEvent, ConversationId, MessageId};
use quicktalk_pure_rust::api::events::replay_events;
use axum::extract::{State, Query};
use tokio::sync::broadcast;

#[tokio::test]
async fn replay_endpoint_returns_persisted_events() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    // minimal tables
    sqlx::query("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, sender_type TEXT, content TEXT, message_type TEXT, timestamp TEXT, deleted_at TEXT, shop_id TEXT);").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE,event_type TEXT,emitted_at TEXT,payload_json TEXT);").execute(&pool).await.unwrap();

    // prepare app state
    let (sender,_) = broadcast::channel(10);
    let ws_connections = Arc::new(Mutex::new(HashMap::new()));
    // 额外创建占位表满足新增 repo 需求
    sqlx::query("CREATE TABLE admins (id TEXT PRIMARY KEY, role TEXT, username TEXT, email TEXT);").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE notification_settings (admin_id TEXT PRIMARY KEY, enable_sound INTEGER, enable_desktop INTEGER, enable_vibration INTEGER, created_at TEXT, updated_at TEXT);").execute(&pool).await.unwrap();
    sqlx::query("CREATE TABLE shops (id TEXT PRIMARY KEY, name TEXT, domain TEXT, api_key TEXT, owner_id TEXT, status TEXT, created_at TEXT);").execute(&pool).await.unwrap();
    use quicktalk_pure_rust::db::{admin_repository_sqlx::SqlxAdminRepository, notification_settings_repository_sqlx::NotificationSettingsRepositorySqlx, shop_repository_sqlx::ShopRepositorySqlx};
    use quicktalk_pure_rust::application::shops::authz::ShopPermissionSqlx;
    let state = Arc::new(AppState {
        db: pool.clone(),
        ws_connections,
        message_sender: sender.clone(),
        conversation_repo: Arc::new(SqlxConversationRepository { pool: pool.clone() }),
        message_repo: Arc::new(MessageRepositorySqlx { pool: pool.clone() }),
        message_read_repo: Arc::new(MessageReadRepositorySqlx { pool: pool.clone() }),
        event_publisher: Arc::new(EventBusWithDb::new(sender.clone(), pool.clone())),
        admin_repo: Arc::new(SqlxAdminRepository { pool: pool.clone() }),
        notification_repo: Arc::new(NotificationSettingsRepositorySqlx::new(pool.clone())),
    shop_repo: Arc::new(ShopRepositorySqlx::new(pool.clone())),
    shop_permission: Arc::new(ShopPermissionSqlx { pool: pool.clone() }),
    });

    // insert message row for enrichment
    sqlx::query("INSERT INTO messages(id,conversation_id,sender_id,sender_type,content,message_type,timestamp,deleted_at,shop_id) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind("m-test").bind("c-test").bind("u1").bind("customer").bind("hello").bind("text").bind(Utc::now().to_rfc3339()).bind::<Option<String>>(None).bind::<Option<String>>(None)
        .execute(&pool).await.unwrap();

    let bus = EventBusWithDb::new(sender, pool.clone());
    bus.publish(vec![DomainEvent::MessageAppended { conversation_id: ConversationId("c-test".into()), message_id: MessageId("m-test".into()) }]).await;

    // call handler directly
    let params = Query(HashMap::from([(String::from("limit"), String::from("10"))]));
    let resp = replay_events(State(state), params).await.expect("api ok");
    let body = resp.0; // Json<ApiResponse<_>>
    assert!(body.data.is_some());
    let list = body.data.unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].envelope["type"], "domain.event.message_appended");
}
