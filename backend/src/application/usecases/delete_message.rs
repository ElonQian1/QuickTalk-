// moved from application/delete_message.rs
use crate::domain::conversation::{MessageRepository, MessageId, RepoError, DomainEvent};

pub struct DeleteMessageInput { pub message_id: String, pub hard: bool }
pub struct DeleteMessageOutput { pub message_id: String, pub events: Vec<DomainEvent> }

#[derive(Debug, thiserror::Error)]
pub enum DeleteMessageError {
    #[error("not found")] NotFound,
    #[error("repository error: {0}")] Repo(String),
}

pub struct DeleteMessageUseCase<R: MessageRepository> { repo: R }
impl<R: MessageRepository> DeleteMessageUseCase<R> {
    pub fn new(repo: R) -> Self { Self { repo } }
    pub async fn exec(&self, input: DeleteMessageInput) -> Result<DeleteMessageOutput, DeleteMessageError> {
        let id = MessageId(input.message_id.clone());
        let msg = self.repo.find(&id).await.map_err(|e| DeleteMessageError::Repo(e.to_string()))?
            .ok_or(DeleteMessageError::NotFound)?;
        let res = if input.hard { self.repo.hard_delete(&id).await } else { self.repo.soft_delete(&id).await };
        res.map_err(|e| match e { RepoError::NotFound => DeleteMessageError::NotFound, other => DeleteMessageError::Repo(other.to_string()) })?;
        let events = vec![DomainEvent::MessageDeleted { conversation_id: msg.conversation_id, message_id: id, soft: !input.hard }];
        Ok(DeleteMessageOutput { message_id: input.message_id, events })
    }
}
