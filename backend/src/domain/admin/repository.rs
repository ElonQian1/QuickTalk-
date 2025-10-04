use async_trait::async_trait;
use super::model::{Admin, AdminId, Email};

#[derive(Debug,thiserror::Error)]
pub enum AdminRepoError {
    #[error("not found")] NotFound,
    #[error("db error: {0}")] Db(String),
}

#[async_trait]
pub trait AdminRepository: Send + Sync {
    async fn find_by_id(&self, id: &AdminId) -> Result<Admin, AdminRepoError>;
    async fn update_email(&self, id: &AdminId, email: Option<Email>) -> Result<(), AdminRepoError>;
    async fn update_password_hash(&self, id: &AdminId, new_hash: &str) -> Result<(), AdminRepoError>;
    async fn invalidate_sessions(&self, id: &AdminId) -> Result<(), AdminRepoError>;
}
