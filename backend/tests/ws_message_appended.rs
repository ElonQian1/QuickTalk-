use reqwest::Client;
use serde_json::json;

mod common;
use common::{test_app_with_schema, seed_conversation, spawn_test_server, connect_ws, next_json};

#[tokio::test]
async fn websocket_receives_message_appended_envelope_after_http_send() {
    // 1. 启动内存应用 + 临时服务器
    let (app, pool) = test_app_with_schema().await;
    seed_conversation(&pool, "c_ws1", "shopX", "custX").await;
    let (base_url, _server_handle) = spawn_test_server(app).await; // handle drop 时服务器结束

    // 2. 建立 WebSocket 连接，读取欢迎消息
    let (mut ws, welcome) = connect_ws(&base_url).await;
    assert_eq!(welcome["type"], "system.welcome");

    // 3. 通过 HTTP API 发送消息 (POST /api/conversations/:id/messages)
    let body = json!({
        "conversation_id": "c_ws1",
        "sender_id": "custX",
        "sender_type": "customer",
        "content": "hello via ws test",
        "message_type": "text"
    });
    let url = format!("{}/api/conversations/c_ws1/messages", base_url);
    let client = Client::new();
    let resp = client.post(url)
        .header("content-type", "application/json")
        .body(body.to_string())
        .send().await.expect("http send ok");
    assert!(resp.status().is_success());

    // 4. WebSocket 端应收到 envelope 类型为 message_appended
    let event = next_json(&mut ws).await; // 下一个事件
    assert_eq!(event["type"], "domain.event.message_appended");
    assert_eq!(event["version"], "v1");
    let data = &event["data"]; // 某些 WS 路径里 data.message 内嵌
    // 兼容不同实现：ws::websocket_handler 当前结构是 data: { message: {...} }
    let msg = &data["message"];
    assert_eq!(msg["content"], "hello via ws test");
    assert_eq!(msg["conversation_id"], "c_ws1");
}
