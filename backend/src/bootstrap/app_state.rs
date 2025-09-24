use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use sqlx::SqlitePool;

pub type WebSocketConnections = Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>;

#[derive(Clone)]
#[allow(dead_code)] // ws_connections 暂未在生产路径使用，后续用于精准推送
pub struct AppState {
    pub db: SqlitePool,
    pub ws_connections: WebSocketConnections,
    pub message_sender: broadcast::Sender<String>,
}

impl AppState {
    #[allow(dead_code)] // 工厂方法当前未直接调用（通过 bootstrap 构建）
    pub fn new(db: SqlitePool, message_sender: broadcast::Sender<String>) -> Self {
        Self { db, ws_connections: Arc::new(Mutex::new(HashMap::new())), message_sender }
    }
}