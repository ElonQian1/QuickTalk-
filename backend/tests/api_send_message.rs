use axum::http::{StatusCode, Request};
use axum::body::Body;
use tower::util::ServiceExt; // for oneshot
use serde_json::json;
use http_body_util::BodyExt; // for collect()

// 引入共享测试助手 (内存DB + 最小schema + 常用操作)
mod common; // tests/common/mod.rs
use common::{test_app_with_schema, seed_conversation};

#[tokio::test]
async fn api_send_message_success() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_api1", "shopX", "custX").await;

    let body = json!({
        "conversation_id": "c_api1",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "hello api",
        "message_type": "text"
    });
    let response = app.clone().oneshot(Request::builder()
        .method("POST")
        .uri("/api/conversations/c_api1/messages")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()).await.unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body();
    let bytes = body.collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(v["success"].as_bool().unwrap_or(false));
    assert_eq!(v["data"]["content"], "hello api");
}

#[tokio::test]
async fn api_send_message_conversation_mismatch() {
    let (app, _pool) = test_app_with_schema().await;
    // 构造 body 与路径不一致
    let body = json!({
        "conversation_id": "c_body",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "msg",
        "message_type": "text"
    });
    let resp = app.clone().oneshot(Request::builder()
        .method("POST")
        .uri("/api/conversations/c_path/messages")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn api_send_message_not_found() {
    let (app, _pool) = test_app_with_schema().await;
    let body = json!({
        "conversation_id": "c_missing",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "msg",
        "message_type": "text"
    });
    let resp = app.clone().oneshot(Request::builder()
        .method("POST")
        .uri("/api/conversations/c_missing/messages")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn api_send_message_empty_content() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_empty", "shopX", "custX").await;

    let body = json!({
        "conversation_id": "c_empty",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "   ",
        "message_type": "text"
    });
    let resp = app.clone().oneshot(Request::builder()
        .method("POST")
        .uri("/api/conversations/c_empty/messages")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}
