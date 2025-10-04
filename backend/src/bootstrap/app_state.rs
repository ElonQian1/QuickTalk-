use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use sqlx::SqlitePool;
use crate::db::{conversation_repository_sqlx::SqlxConversationRepository, message_read_repository_sqlx::MessageReadRepositorySqlx, message_repository_sqlx::MessageRepositorySqlx, admin_repository_sqlx::SqlxAdminRepository, notification_settings_repository_sqlx::NotificationSettingsRepositorySqlx, shop_repository_sqlx::ShopRepositorySqlx};
use crate::application::event_bus_rich::EventBusWithDb;
use crate::application::shops::authz::{ShopPermissionSqlx, ShopPermissionService};

pub type WebSocketConnections = Arc<Mutex<HashMap<String, broadcast::Sender<String>>>>;

#[derive(Clone)]
#[allow(dead_code)] // ws_connections 暂未在生产路径使用，后续用于精准推送
pub struct AppState {
    pub db: SqlitePool,
    pub ws_connections: WebSocketConnections,
    pub message_sender: broadcast::Sender<String>,
    // 新增依赖注入
    pub conversation_repo: Arc<SqlxConversationRepository>,
    pub message_repo: Arc<MessageRepositorySqlx>,
    pub message_read_repo: Arc<MessageReadRepositorySqlx>,
    pub event_publisher: Arc<EventBusWithDb>, // 具体实现（后续可换 trait 对象）
    pub admin_repo: Arc<SqlxAdminRepository>,
    pub notification_repo: Arc<NotificationSettingsRepositorySqlx>,
    pub shop_repo: Arc<ShopRepositorySqlx>,
    pub shop_permission: Arc<ShopPermissionSqlx>,
}

impl AppState {
    #[allow(dead_code)] // 工厂方法当前未直接调用（通过 bootstrap 构建）
    pub fn new(db: SqlitePool, message_sender: broadcast::Sender<String>) -> Self {
        let convo_repo = Arc::new(SqlxConversationRepository { pool: db.clone() });
        let msg_repo = Arc::new(MessageRepositorySqlx { pool: db.clone() });
        let msg_read_repo = Arc::new(MessageReadRepositorySqlx { pool: db.clone() });
        let publisher = Arc::new(EventBusWithDb::new(message_sender.clone(), db.clone()));
        let admin_repo = Arc::new(SqlxAdminRepository { pool: db.clone() });
        let notification_repo = Arc::new(NotificationSettingsRepositorySqlx::new(db.clone()));
    let shop_repo = Arc::new(ShopRepositorySqlx::new(db.clone()));
    let shop_permission = Arc::new(ShopPermissionSqlx { pool: db.clone() });
    Self { db, ws_connections: Arc::new(Mutex::new(HashMap::new())), message_sender, conversation_repo: convo_repo, message_repo: msg_repo, message_read_repo: msg_read_repo, event_publisher: publisher, admin_repo, notification_repo, shop_repo, shop_permission }
    }
}