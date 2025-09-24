use chrono::{DateTime, Utc};
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct ConversationSearchResult {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct ConversationSummaryView {
    pub id: String,
    pub shop_id: String,
    pub customer_id: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_count: i64,
    pub last_message_time: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum QueryError {
    #[error("not found")] NotFound,
    #[error("database error: {0}")] Database(String),
}

#[async_trait]
pub trait ConversationQueries: Send + Sync {
    async fn search(&self, shop_id: Option<&str>, term: Option<&str>) -> Result<Vec<ConversationSearchResult>, QueryError>;
    async fn summary(&self, id: &str) -> Result<ConversationSummaryView, QueryError>;
}
