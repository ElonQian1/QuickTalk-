use serde_json::json;

mod common;
use common::{test_app_with_schema, seed_conversation, spawn_test_server, connect_ws, next_json};
use reqwest::Client;

#[tokio::test]
async fn websocket_message_broadcasts_to_multiple_connections() {
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_ws_multi", "shopX", "custX").await;
    let (base_url, _handle) = spawn_test_server(app).await;

    // 建立两个独立的 WS 连接
    let (mut ws1, welcome1) = connect_ws(&base_url).await;
    let (mut ws2, welcome2) = connect_ws(&base_url).await;
    assert_eq!(welcome1["type"], "system.welcome");
    assert_eq!(welcome2["type"], "system.welcome");

    // 通过 HTTP 发送一条消息
    let body = json!({
        "conversation_id": "c_ws_multi",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "multi broadcast",
        "message_type": "text"
    });
    let client = Client::new();
    let url = format!("{}/api/conversations/c_ws_multi/messages", base_url);
    let resp = client.post(url)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send().await.expect("send ok");
    assert!(resp.status().is_success());

    // 两个连接都应收到事件
    let ev1 = next_json(&mut ws1).await;
    let ev2 = next_json(&mut ws2).await;

    assert_eq!(ev1["type"], "domain.event.message_appended");
    assert_eq!(ev2["type"], "domain.event.message_appended");

    // 事件内容一致（content）
    assert_eq!(ev1["data"]["message"]["content"], "multi broadcast");
    assert_eq!(ev2["data"]["message"]["content"], "multi broadcast");

    // 可选：event_id 不要求相同（当前广播复用同一字符串，因此断言相等提升一致性）
    assert_eq!(ev1["event_id"], ev2["event_id"], "两个连接应接收到同一个事件实例");
}
