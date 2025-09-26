use axum::{http::StatusCode};
use reqwest::Client;
use quicktalk_pure_rust::bootstrap::router::build_app;
use sqlx::SqlitePool;

#[tokio::test]
async fn get_message_by_id_returns_404_when_not_found() {
    // 使用内存数据库并执行迁移
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    quicktalk_pure_rust::bootstrap::migrations::run_migrations(&pool).await.unwrap();
    let app = build_app(pool).await;
    // 启动一个随机端口服务器
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap(); });

    let client = Client::new();
    let url = format!("http://{}/api/messages/nonexistent", addr);
    let resp = client.get(&url).send().await.unwrap();
    assert_eq!(resp.status().as_u16(), StatusCode::NOT_FOUND.as_u16());
    server.abort();
}