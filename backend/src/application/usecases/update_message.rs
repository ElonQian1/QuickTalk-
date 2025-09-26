// moved from application/update_message.rs
use crate::domain::conversation::{MessageRepository, MessageId, RepoError, DomainEvent};
use crate::application::events::publisher::EventPublisher; // async publisher trait

#[allow(dead_code)]
pub struct UpdateMessageInput { pub message_id: String, pub new_content: String }
#[allow(dead_code)]
pub struct UpdateMessageOutput { pub message_id: String, pub events: Vec<DomainEvent> }

#[derive(Debug, thiserror::Error)]
pub enum UpdateMessageError {
    #[error("not found")] NotFound,
    #[error("repository error: {0}")] Repo(String),
    #[error("empty content")] Empty,
}

pub struct UpdateMessageUseCase<R: MessageRepository, P: EventPublisher> { repo: R, publisher: P }
impl<R: MessageRepository, P: EventPublisher> UpdateMessageUseCase<R, P> {
    pub fn new(repo: R, publisher: P) -> Self { Self { repo, publisher } }
    pub async fn exec(&self, input: UpdateMessageInput) -> Result<UpdateMessageOutput, UpdateMessageError> {
        if input.new_content.trim().is_empty() { return Err(UpdateMessageError::Empty); }
        let id = MessageId(input.message_id.clone());
        let msg = self.repo.find(&id).await.map_err(|e| UpdateMessageError::Repo(e.to_string()))?
            .ok_or(UpdateMessageError::NotFound)?;
        self.repo.update_content(&id, &input.new_content).await.map_err(|e| match e { RepoError::NotFound => UpdateMessageError::NotFound, other => UpdateMessageError::Repo(other.to_string()) })?;
        let events = vec![DomainEvent::MessageUpdated { conversation_id: msg.conversation_id, message_id: id }];
        self.publisher.publish(events.clone()).await; // fire-and-forget
        Ok(UpdateMessageOutput { message_id: input.message_id, events })
    }
}
