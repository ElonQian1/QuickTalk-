use axum::http::StatusCode;
use reqwest::Client;
use sqlx::SqlitePool;
use quicktalk_pure_rust::bootstrap::router::build_app;
use chrono::Utc;

#[tokio::test]
async fn get_message_by_id_returns_200_with_payload() {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    quicktalk_pure_rust::bootstrap::migrations::run_migrations(&pool).await.unwrap();
    // 准备数据: conversation + message
    let convo_id = "c-test";
    let msg_id = "m-test";
    // 先插入 shop 与 customer 满足外键
    sqlx::query("INSERT INTO admins(id, username, password_hash) VALUES(?,?,?)")
        .bind("admin1").bind("admin1").bind("pw").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO shops(id,name,domain,api_key,owner_id,status) VALUES(?,?,?,?,?,?)")
        .bind("shop1").bind("Shop 1").bind("shop1.example.com").bind("k123").bind("admin1").bind("active")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO customers(id,name) VALUES(?,?)")
        .bind("cust1").bind("Customer 1").execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO conversations(id, shop_id, customer_id, status, created_at, updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
        .bind(convo_id)
        .bind("shop1")
        .bind("cust1")
        .bind("active")
        .execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO messages(id, conversation_id, sender_id, sender_type, content, message_type, timestamp) VALUES(?,?,?,?,?,?,?)")
        .bind(msg_id)
        .bind(convo_id)
        .bind("u1")
        .bind("customer")
        .bind("hello world")
        .bind("text")
        .bind(Utc::now())
        .execute(&pool).await.unwrap();

    let app = build_app(pool).await;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let client = Client::new();
    let url = format!("http://{}/api/messages/{}", addr, msg_id);
    let resp = client.get(&url).send().await.unwrap();
    assert_eq!(resp.status().as_u16(), StatusCode::OK.as_u16());
    let body: serde_json::Value = resp.json().await.unwrap();
    assert!(body["success"].as_bool().unwrap_or(false));
    assert_eq!(body["data"]["id"].as_str(), Some(msg_id));
    assert_eq!(body["data"]["content"].as_str(), Some("hello world"));
    server.abort();
}
