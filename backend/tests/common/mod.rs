use axum::{Router, http::Request, body::Body};
use sqlx::{SqlitePool, Executor, Row};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message as WsMsg};
use futures_util::StreamExt;
use tower::util::ServiceExt; // oneshot

/// Build an in-memory Sqlite app with minimal schema needed for conversation/message/event tests.
pub async fn test_app_with_schema() -> (Router, SqlitePool) {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    apply_min_schema(&pool).await;
    let app = quicktalk_pure_rust::bootstrap::router::build_app(pool.clone()).await;
    (app, pool)
}

/// Apply minimal tables required for current tests (conversations, messages, event_log).
pub async fn apply_min_schema(pool: &SqlitePool) {
    pool.execute("CREATE TABLE conversations (id TEXT PRIMARY KEY, shop_id TEXT, customer_id TEXT, status TEXT, created_at TEXT, updated_at TEXT);").await.unwrap();
    pool.execute("CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT, sender_type TEXT, content TEXT, message_type TEXT, timestamp TEXT, deleted_at TEXT, shop_id TEXT);").await.unwrap();
    pool.execute("CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE,event_type TEXT,emitted_at TEXT,payload_json TEXT);").await.unwrap();
}

/// Seed a conversation row.
pub async fn seed_conversation(pool: &SqlitePool, id: &str, shop: &str, cust: &str) {
    let now = chrono::Utc::now();
    sqlx::query("INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id).bind(shop).bind(cust).bind("active").bind(now).bind(now)
        .execute(pool).await.unwrap();
}

/// Seed a message row (used for update/delete tests) with provided content.
pub async fn seed_message(pool: &SqlitePool, id: &str, conv: &str, sender: &str, content: &str) {
    let ts = chrono::Utc::now().to_rfc3339();
    sqlx::query("INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id).bind(conv).bind(sender).bind("customer").bind(content).bind("text").bind(ts)
        .execute(pool).await.unwrap();
}

/// Fetch latest persisted event payload (as JSON value).
pub async fn latest_event(pool: &SqlitePool) -> serde_json::Value {
    let row = sqlx::query("SELECT payload_json FROM event_log ORDER BY id DESC LIMIT 1")
        .fetch_one(pool).await.expect("expected event");
    let payload: String = row.get::<String,_>("payload_json");
    serde_json::from_str(&payload).unwrap()
}

/// Helper to perform a JSON request returning (status, body_json).
pub async fn json_request(app: &Router, req: Request<Body>) -> (axum::http::StatusCode, serde_json::Value) {
    let resp = app.clone().oneshot(req).await.unwrap();
    let status = resp.status();
    use http_body_util::BodyExt; // local import to collect
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&bytes).unwrap_or(serde_json::json!({"_parse_error": true}));
    (status, v)
}

/// 启动一个绑定到随机本地端口的临时 HTTP+WS 服务器，返回 (base_url, join_handle)
/// 用于需要真实 WebSocket 握手的测试；测试结束后 drop handle (任务结束)。
pub async fn spawn_test_server(app: Router) -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    (format!("http://{}", addr), handle)
}

/// 建立 WebSocket 连接并返回 (stream, first_message_json) - 解析欢迎消息。
pub async fn connect_ws(base: &str) -> (tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, serde_json::Value) {
    let ws_url = base.replace("http://", "ws://") + "/ws";
    let request = ws_url.clone().into_client_request().unwrap();
    let (ws_stream, _) = tokio_tungstenite::connect_async(request).await.expect("ws connect");
    let mut ws_stream = ws_stream;
    // 读取欢迎帧
    let first = ws_stream.next().await.expect("welcome frame").expect("ws msg");
    let welcome = match first {
        WsMsg::Text(t) => serde_json::from_str(&t).unwrap(),
        other => panic!("unexpected first ws frame: {:?}", other)
    };
    (ws_stream, welcome)
}

/// 从 WebSocket 读取下一条文本事件并解析为 JSON。
pub async fn next_json(ws: &mut tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>) -> serde_json::Value {
    loop {
        if let Some(msg) = ws.next().await { let msg = msg.expect("ws frame");
            if let WsMsg::Text(t) = msg { return serde_json::from_str(&t).expect("json event"); }
        } else { panic!("ws closed before event"); }
    }
}
