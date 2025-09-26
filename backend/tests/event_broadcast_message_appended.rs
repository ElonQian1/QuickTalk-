use axum::http::Request;
use axum::body::Body;
use tower::util::ServiceExt; // oneshot
use serde_json::json;

mod common;
use common::{test_app_with_schema, seed_conversation, latest_event};

#[tokio::test]
async fn event_persisted_and_envelope_shape_after_send_message() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_ev1", "shopX", "custX").await;
    let body = json!({
        "conversation_id": "c_ev1",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "hello event",
        "message_type": "text"
    });
    let resp = app.clone().oneshot(Request::builder()
        .method("POST")
        .uri("/api/conversations/c_ev1/messages")
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()).await.unwrap();
    assert!(resp.status().is_success());

    let v = latest_event(&pool).await;
    assert_eq!(v["version"], "v1");
    assert_eq!(v["type"], "domain.event.message_appended");
    assert!(v["event_id"].as_str().unwrap().len() > 10);
    assert!(v["emitted_at"].as_str().unwrap().contains('T'));
    assert_eq!(v["data"]["conversation_id"], "c_ev1");
    assert!(v["data"]["message_id"].as_str().unwrap().len() > 5);
    assert!(v["data"]["message"].is_object(), "enriched message object expected");
    assert_eq!(v["data"]["message"]["content"], "hello event");
}
