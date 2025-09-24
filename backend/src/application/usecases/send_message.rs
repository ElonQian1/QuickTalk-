// moved from application/send_message.rs
use chrono::Utc;
use crate::domain::conversation::{ConversationId, ConversationRepository, DomainError, SenderType, MessageId, Message};
use crate::domain::conversation::DomainEvent;

pub struct SendMessageInput {
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub content: String,
    pub message_type: String,
}

pub struct SendMessageOutput {
    pub message_id: String,
    pub events: Vec<DomainEvent>,
}

#[derive(Debug, thiserror::Error)]
pub enum UseCaseError {
    #[error("conversation not found")] NotFound,
    #[error(transparent)] Domain(#[from] DomainError),
    #[error("repository error: {0}")] Repo(String),
    #[error("invalid sender type")] InvalidSenderType,
}

pub struct SendMessageUseCase<R: ConversationRepository> { repo: R }
impl<R: ConversationRepository> SendMessageUseCase<R> {
    pub fn new(repo: R) -> Self { Self { repo } }
    pub async fn exec(&self, input: SendMessageInput) -> Result<SendMessageOutput, UseCaseError> {
        let conv_id = ConversationId(input.conversation_id.clone());
        let mut convo = self.repo.find(&conv_id).await.map_err(|e| UseCaseError::Repo(e.to_string()))?
            .ok_or(UseCaseError::NotFound)?;
        let sender_type = SenderType::from_str(&input.sender_type).ok_or(UseCaseError::InvalidSenderType)?;
        let msg_id = MessageId(uuid::Uuid::new_v4().to_string());
        let ts = Utc::now(); // still generate timestamp for message
        let msg = Message::new(msg_id.clone(), conv_id.clone(), input.sender_id.clone(), sender_type, input.content.clone(), input.message_type.clone(), ts)?;
        convo.append_message(msg).map_err(UseCaseError::Domain)?;
        let events = convo.take_events();
        self.repo.save(&convo).await.map_err(|e| UseCaseError::Repo(e.to_string()))?;
        Ok(SendMessageOutput { message_id: msg_id.0, events })
    }
}
