mod common;
use common::{test_app_with_schema, spawn_test_server, connect_ws, next_json};
use tokio_tungstenite::tungstenite::Message as WsMsg;
use futures_util::SinkExt; // for ws.send

#[tokio::test]
async fn websocket_ping_pong_roundtrip() {
    let (app, _pool) = test_app_with_schema().await;
    let (base_url, _handle) = spawn_test_server(app).await;

    let (mut ws, welcome) = connect_ws(&base_url).await;
    assert_eq!(welcome["type"], "system.welcome");

    // 发送 Ping 枚举格式：{"type":"Ping"}
    ws.send(WsMsg::Text("{\"type\":\"Ping\"}".into())).await.expect("send ping");

    // 读取 Pong
    let pong = next_json(&mut ws).await;
    assert_eq!(pong["type"], "Pong");
    assert!(pong["payload"]["time"].as_str().unwrap().contains('T'));
}
