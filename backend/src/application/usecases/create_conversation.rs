// moved from application/create_conversation.rs
use chrono::Utc;
use chrono::DateTime;
use crate::domain::conversation::{ConversationRepository, ConversationId, Conversation, DomainError};
use uuid::Uuid;

pub struct CreateConversationInput { pub shop_id: String, pub customer_id: String }
pub struct CreateConversationOutput { pub conversation_id: String, pub created_at: DateTime<Utc> }

#[derive(Debug, thiserror::Error)]
pub enum CreateConversationError {
    #[allow(dead_code)]
    #[error("already exists")] AlreadyExists,
    #[error(transparent)] Domain(#[from] DomainError),
    #[error("repository error: {0}")] Repo(String),
}

pub struct CreateConversationUseCase<R: ConversationRepository> { repo: R }
impl<R: ConversationRepository> CreateConversationUseCase<R> {
    pub fn new(repo: R) -> Self { Self { repo } }
    pub async fn exec(&self, input: CreateConversationInput) -> Result<CreateConversationOutput, CreateConversationError> {
        let id = ConversationId(Uuid::new_v4().to_string());
        let now = Utc::now();
        let convo = Conversation::open(id.clone(), input.shop_id.clone(), input.customer_id.clone(), now);
        self.repo.create(&convo).await.map_err(|e| CreateConversationError::Repo(e.to_string()))?;
        Ok(CreateConversationOutput { conversation_id: id.0, created_at: now })
    }
}
