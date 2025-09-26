use serde_json::json;

mod common;
use common::{test_app_with_schema, seed_conversation, seed_message, spawn_test_server, connect_ws, next_json};
use reqwest::Client;

#[tokio::test]
async fn websocket_receives_message_updated_and_deleted_events() {
    // 启动应用并播种一个会话 + 初始消息
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_ws2", "shopX", "custX").await;
    seed_message(&pool, "m_orig", "c_ws2", "custX", "original content").await;
    let (base_url, _handle) = spawn_test_server(app).await;

    // 连接 WebSocket
    let (mut ws, welcome) = connect_ws(&base_url).await;
    assert_eq!(welcome["type"], "system.welcome");

    let client = Client::new();

    // 执行 UPDATE (HTTP PUT)
    let update_body = json!({ "content": "updated content" });
    let update_url = format!("{}/api/conversations/c_ws2/messages/m_orig", base_url);
    let update_resp = client.put(update_url)
        .header("content-type", "application/json")
        .body(update_body.to_string())
        .send().await.expect("update ok");
    assert!(update_resp.status().is_success());

    // 读取更新事件
    let updated_ev = next_json(&mut ws).await;
    assert_eq!(updated_ev["type"], "domain.event.message_updated");
    assert_eq!(updated_ev["data"]["conversation_id"], "c_ws2");
    assert_eq!(updated_ev["data"]["message_id"], "m_orig");
    let msg_obj = &updated_ev["data"]["message"];
    assert_eq!(msg_obj["content"], "updated content");

    // 执行 DELETE (HTTP DELETE)
    let delete_url = format!("{}/api/conversations/c_ws2/messages/m_orig", base_url);
    let delete_resp = client.delete(delete_url)
        .send().await.expect("delete ok");
    assert!(delete_resp.status().is_success());

    // 读取删除事件
    let deleted_ev = next_json(&mut ws).await;
    assert_eq!(deleted_ev["type"], "domain.event.message_deleted");
    assert_eq!(deleted_ev["data"]["conversation_id"], "c_ws2");
    assert_eq!(deleted_ev["data"]["message_id"], "m_orig");
    assert_eq!(deleted_ev["data"]["soft"], true);
    assert!(deleted_ev["data"]["message"].is_null());
}
