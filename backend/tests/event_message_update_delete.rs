use axum::http::{Request, Method, StatusCode};
use axum::body::Body;
use tower::util::ServiceExt; // oneshot
use serde_json::json;

mod common;
use common::{test_app_with_schema, seed_conversation, seed_message, latest_event};

#[tokio::test]
async fn message_update_emits_updated_event() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_up1", "shopX", "custX").await;
    seed_message(&pool, "m_up1", "c_up1", "custX", "old content").await;

    let req_body = json!({ "content": "new content" });
    let resp = app.clone().oneshot(Request::builder()
        .method(Method::PUT)
        .uri("/api/conversations/c_up1/messages/m_up1")
        .header("content-type", "application/json")
        .body(Body::from(req_body.to_string()))
        .unwrap()).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let ev = latest_event(&pool).await;
    assert_eq!(ev["type"], "domain.event.message_updated");
    assert_eq!(ev["data"]["conversation_id"], "c_up1");
    assert_eq!(ev["data"]["message_id"], "m_up1");
    // 富载荷：更新事件包含 message 对象
    let msg = ev["data"]["message"].as_object().expect("message object");
    assert_eq!(msg.get("content").unwrap(), "new content");
}

#[tokio::test]
async fn message_delete_emits_deleted_event_with_soft_flag() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_del1", "shopX", "custX").await;
    seed_message(&pool, "m_del1", "c_del1", "custX", "to delete").await;

    let resp = app.clone().oneshot(Request::builder()
        .method(Method::DELETE)
        .uri("/api/conversations/c_del1/messages/m_del1")
        .body(Body::empty())
        .unwrap()).await.unwrap();
    assert_eq!(resp.status(), StatusCode::NO_CONTENT);

    let ev = latest_event(&pool).await;
    assert_eq!(ev["type"], "domain.event.message_deleted");
    assert_eq!(ev["data"]["conversation_id"], "c_del1");
    assert_eq!(ev["data"]["message_id"], "m_del1");
    assert_eq!(ev["data"]["soft"], true);
    // 删除事件 enrich 不包含 message 对象
    assert!(ev["data"]["message"].is_null(), "delete event should not embed message");
}
