// moved from application/send_message.rs
use chrono::Utc;
use crate::domain::conversation::{ConversationId, ConversationRepository, DomainError, SenderType, MessageId, Message};
use crate::domain::conversation::DomainEvent;
use crate::application::events::publisher::EventPublisher; // async publisher trait

pub struct SendMessageInput {
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_type: String,
    pub content: String,
    pub message_type: String,
}

pub struct SendMessageOutput {
    pub message_id: String,
    pub events: Vec<DomainEvent>, // 仍返回便于上层测试或回显
}

#[derive(Debug, thiserror::Error)]
pub enum UseCaseError {
    #[error("conversation not found")] NotFound,
    #[error(transparent)] Domain(#[from] DomainError),
    #[error("repository error: {0}")] Repo(String),
    #[error("invalid sender type")] InvalidSenderType,
}

pub struct SendMessageUseCase<R: ConversationRepository, P: EventPublisher> { repo: R, publisher: P }
impl<R: ConversationRepository, P: EventPublisher> SendMessageUseCase<R, P> {
    pub fn new(repo: R, publisher: P) -> Self { Self { repo, publisher } }
    pub async fn exec(&self, input: SendMessageInput) -> Result<SendMessageOutput, UseCaseError> {
        let conv_id = ConversationId(input.conversation_id.clone());
        let mut convo = self.repo.find(&conv_id).await.map_err(|e| UseCaseError::Repo(e.to_string()))?
            .ok_or(UseCaseError::NotFound)?;
        let sender_type = SenderType::from_str(&input.sender_type).ok_or(UseCaseError::InvalidSenderType)?;
        let msg_id = MessageId(uuid::Uuid::new_v4().to_string());
        let ts = Utc::now();
        let msg = Message::new(msg_id.clone(), conv_id.clone(), input.sender_id.clone(), sender_type, input.content.clone(), input.message_type.clone(), ts)?;
        convo.append_message(msg).map_err(UseCaseError::Domain)?;
        // NOTE: repo.save 需要访问聚合中的新增消息；事件派发顺序：持久化成功后再对外返回
        let events = convo.take_events();
        self.repo.save(&convo).await.map_err(|e| UseCaseError::Repo(e.to_string()))?;
        // 发布事件（忽略发布错误：当前实现 publish 不返回 Result）
        self.publisher.publish(events.clone()).await;
        Ok(SendMessageOutput { message_id: msg_id.0, events })
    }
}
