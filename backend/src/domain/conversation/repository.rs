use async_trait::async_trait;
use crate::domain::shared::ids::ConversationId;
use super::model::aggregate::Conversation;

#[derive(Debug, thiserror::Error)]
pub enum RepoError {
    #[error("not found")] NotFound,
    #[error("storage error: {0}")] Storage(String),
}

#[async_trait]
pub trait ConversationRepository: Send + Sync {
    async fn find(&self, id: &ConversationId) -> Result<Option<Conversation>, RepoError>;
    async fn save(&self, agg: &Conversation) -> Result<(), RepoError>;
}
