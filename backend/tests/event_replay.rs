use sqlx::SqlitePool;
use chrono::Utc;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use quicktalk_pure_rust::bootstrap::app_state::AppState;
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
    let state = Arc::new(AppState { db: pool.clone(), ws_connections, message_sender: sender.clone() });

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
