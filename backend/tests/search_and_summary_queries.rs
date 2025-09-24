use sqlx::{SqlitePool, Executor};
use quicktalk_pure_rust::db::conversation_read_model_sqlx::ConversationReadModelSqlx;
use quicktalk_pure_rust::application::queries::conversation_queries::ConversationQueries;
use chrono::Utc;

async fn setup_db() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    pool.execute("CREATE TABLE conversations (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, status TEXT, created_at TEXT, updated_at TEXT);").await.unwrap();
    pool.execute("CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT, email TEXT);").await.unwrap();
    pool.execute("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, sender_type TEXT, content TEXT, message_type TEXT, timestamp TEXT, shop_id TEXT);").await.unwrap();
    // seed
    let now = Utc::now();
    sqlx::query("INSERT INTO customers (id, name, email) VALUES (?, ?, ?)").bind("cust1").bind("Alice").bind("a@example.com").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind("conv1").bind("shop1").bind("cust1").bind("active").bind(now).bind(now).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind("m1").bind("conv1").bind("cust1").bind("customer").bind("Hello").bind("text").bind(now).bind("shop1").execute(&pool).await.unwrap();
    pool
}

#[tokio::test]
async fn search_conversation_basic() {
    let pool = setup_db().await;
    let rm = ConversationReadModelSqlx { pool };
    let rows = rm.search(Some("shop1"), Some("Alice")).await.unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].id, "conv1");
}

#[tokio::test]
async fn summary_basic() {
    let pool = setup_db().await;
    let rm = ConversationReadModelSqlx { pool };
    let view = rm.summary("conv1").await.unwrap();
    assert_eq!(view.message_count, 1);
    assert_eq!(view.id, "conv1");
}
