// moved from application/update_conversation_status.rs
use chrono::Utc;
use crate::domain::conversation::{ConversationRepository, ConversationId, DomainError};
use crate::domain::conversation::DomainEvent; // for returning emitted events

#[allow(dead_code)]
pub struct UpdateConversationStatusInput { pub conversation_id: String, pub target_status: String }
#[allow(dead_code)]
pub struct UpdateConversationStatusOutput { pub conversation_id: String, pub new_status: String, pub events: Vec<DomainEvent> }

#[derive(Debug, thiserror::Error)]
pub enum UpdateConversationStatusError {
    #[error("conversation not found")] NotFound,
    #[error(transparent)] Domain(#[from] DomainError),
    #[error("repository error: {0}")] Repo(String),
    #[error("unsupported target status")] UnsupportedStatus,
}

pub struct UpdateConversationStatusUseCase<R: ConversationRepository> { repo: R }
impl<R: ConversationRepository> UpdateConversationStatusUseCase<R> {
    pub fn new(repo: R) -> Self { Self { repo } }
    pub async fn exec(&self, input: UpdateConversationStatusInput) -> Result<UpdateConversationStatusOutput, UpdateConversationStatusError> {
        let id = ConversationId(input.conversation_id.clone());
        let mut convo = self.repo.find(&id).await.map_err(|e| UpdateConversationStatusError::Repo(e.to_string()))?
            .ok_or(UpdateConversationStatusError::NotFound)?;
        let now = Utc::now();
        match input.target_status.as_str() {
            "closed" => convo.close(now)?,
            "active" => convo.reopen(now)?,
            _ => return Err(UpdateConversationStatusError::UnsupportedStatus)
        }
        let events = convo.take_events();
        self.repo.save(&convo).await.map_err(|e| UpdateConversationStatusError::Repo(e.to_string()))?;
        Ok(UpdateConversationStatusOutput { conversation_id: convo.id.0, new_status: convo.status, events })
    }
}
