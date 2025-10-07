// DDD API Handler - 使用用例而不是直接数据库操作
use axum::{extract::{Path, State}, http::StatusCode, response::Json};
use serde::{Serialize, Deserialize};
use async_trait::async_trait;
use crate::domain::conversation::DomainEvent;
use crate::application::usecases::send_message::{SendMessageUseCase, SendMessageInput, UseCaseError};
use crate::application::events::publisher::EventPublisher;
use crate::db::conversation_repository_sqlx::SqlxConversationRepository;
use crate::bootstrap::app_state::AppState;

// 简单的 NoOp EventPublisher 用于测试
struct NoOpEventPublisher;

#[async_trait::async_trait]
impl EventPublisher for NoOpEventPublisher {
    async fn publish(&self, _events: Vec<DomainEvent>) {
        // 不做任何操作，仅用于测试
    }
}

// API 请求/响应结构
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    pub sender_type: String,
    pub sender_id: String,
    pub message_type: Option<String>,
}

#[derive(Serialize)]
pub struct SendMessageResponse {
    pub success: bool,
    pub message_id: String,
    pub events: Vec<DomainEventDto>,
}

#[derive(Serialize)]
pub struct DomainEventDto {
    pub event_type: String,
    pub conversation_id: String,
    pub timestamp: String,
}

impl From<DomainEvent> for DomainEventDto {
    fn from(event: DomainEvent) -> Self {
        match event {
            DomainEvent::MessageAppended { conversation_id, message_id: _ } => {
                DomainEventDto {
                    event_type: "message_sent".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ConversationOpened { conversation_id } => {
                DomainEventDto {
                    event_type: "conversation_opened".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ConversationClosed { conversation_id } => {
                DomainEventDto {
                    event_type: "conversation_closed".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ConversationReopened { conversation_id } => {
                DomainEventDto {
                    event_type: "conversation_reopened".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::MessageUpdated { conversation_id, message_id: _ } => {
                DomainEventDto {
                    event_type: "message_updated".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::MessageDeleted { conversation_id, message_id: _, soft: _ } => {
                DomainEventDto {
                    event_type: "message_deleted".to_string(),
                    conversation_id: conversation_id.0,
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ShopCreated { shop_id } => {
                DomainEventDto {
                    event_type: "shop_created".to_string(),
                    conversation_id: format!("shop_{}", shop_id), // 临时解决方案
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ShopUpdated { shop_id } => {
                DomainEventDto {
                    event_type: "shop_updated".to_string(),
                    conversation_id: format!("shop_{}", shop_id), // 临时解决方案
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
            DomainEvent::ShopStatusChanged { shop_id, old_status: _, new_status: _ } => {
                DomainEventDto {
                    event_type: "shop_status_changed".to_string(),
                    conversation_id: format!("shop_{}", shop_id), // 临时解决方案
                    timestamp: chrono::Utc::now().to_rfc3339(),
                }
            }
        }
    }
}

// DDD 风格的 API 处理器
pub async fn send_message_handler(
    State(state): State<std::sync::Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, StatusCode> {
    // 创建仓库和用例
    let repo = SqlxConversationRepository::new(state.db.clone());
    let publisher = NoOpEventPublisher;
    let use_case = SendMessageUseCase::new(repo, publisher);
    
    // 执行用例
    let input = SendMessageInput {
        conversation_id,
        sender_id: req.sender_id,
        sender_type: req.sender_type,
        content: req.content,
        message_type: req.message_type.unwrap_or_else(|| "text".to_string()),
    };
    
    match use_case.exec(input).await {
        Ok(output) => {
            let events: Vec<DomainEventDto> = output.events.into_iter().map(Into::into).collect();
            Ok(Json(SendMessageResponse {
                success: true,
                message_id: output.message_id,
                events,
            }))
        }
        Err(UseCaseError::NotFound) => Err(StatusCode::NOT_FOUND),
        Err(UseCaseError::InvalidSenderType) => Err(StatusCode::BAD_REQUEST),
        Err(UseCaseError::Domain(_)) => Err(StatusCode::BAD_REQUEST),
        Err(UseCaseError::Repo(_)) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}