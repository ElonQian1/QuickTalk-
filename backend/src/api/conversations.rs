// 会话与消息相关 API
// 已完成迁移: 统一 ApiError / ApiResult 错误处理、SendMessage 用例接入、消息读取仓库化
// 事件模型 (Envelope v1):
// 每条广播 Envelope 统一外层:
// { "version": "v1", "type": <event_type>, "event_id": <UUIDv4>, "emitted_at": <RFC3339>, "data": { ... } }
// 其中 event_id / emitted_at 为新增元数据字段：
//   - event_id 用于客户端去重 / 幂等处理
//   - emitted_at 用于接收端排序辅助（不替代业务时间戳 message.timestamp）
// 向后兼容：旧客户端忽略新增字段不受影响
// 主要事件类型:
//   domain.event.message_appended   data: { conversation_id, message_id, message{...完整消息...} }
//   domain.event.message_updated    data: { conversation_id, message_id, message{...最新...} }
//   domain.event.message_deleted    data: { conversation_id, message_id, soft }
//   domain.event.conversation_opened|closed|reopened data: { conversation_id }
// 兼容策略:
// - 添加新字段：直接扩展 data 内部; 不破坏旧前端
// - 新事件类型：保持 version 不变; 旧客户端忽略未知 type
// - 重大结构变更：提升 version -> v2 并在文档中列出差异
// 注意: 旧的 "new_message" 广播已移除
use axum::{extract::{Path, Query, State}, http::StatusCode, response::Json};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;

use crate::bootstrap::app_state::AppState;
use crate::types::{ApiResponse, Conversation, Message, ConversationSummary};
use crate::types::dto::conversations::{CreateConversationRequest, UpdateConversationStatusRequest};
use crate::types::dto::messages::{CreateMessageRequest, UpdateMessageRequest};
use crate::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use crate::application::usecases::update_message::{UpdateMessageUseCase, UpdateMessageInput, UpdateMessageError};
use crate::application::usecases::delete_message::{DeleteMessageUseCase, DeleteMessageInput, DeleteMessageError};
use crate::application::event_bus_rich::EventBusWithDb;
use crate::application::usecases::create_conversation::{CreateConversationUseCase, CreateConversationInput, CreateConversationError};
use crate::application::usecases::update_conversation_status::{UpdateConversationStatusUseCase, UpdateConversationStatusInput, UpdateConversationStatusError};
// DomainError 映射已通过 ApiError From 实现，不直接使用
use crate::db::conversation_repository_sqlx::SqlxConversationRepository;
use crate::db::message_read_repository_sqlx::MessageReadRepositorySqlx;
use crate::db::message_repository_sqlx::MessageRepositorySqlx;
use crate::domain::conversation::{ConversationId, ConversationRepository, MessageReadRepository}; // for repository trait methods
use crate::api::errors::{ApiError, ApiResult, success, success_empty};
use crate::application::queries::conversation_queries::{ConversationQueries, QueryError};
use crate::db::conversation_read_model_sqlx::ConversationReadModelSqlx;

pub async fn get_conversations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Vec<Conversation>> {
    let shop_id = params.get("shop_id").map(|s| s.as_str());
    let repo = SqlxConversationRepository { pool: state.db.clone() };
    match repo.list(shop_id).await {
        Ok(convos) => {
            // strip domain-specific fields already aligned with API entity; domain aggregate currently identical shape (messages empty here)
            let result: Vec<Conversation> = convos.into_iter().map(|c| Conversation {
                id: c.id.0,
                shop_id: c.shop_id,
                customer_id: c.customer_id,
                status: c.status,
                created_at: c.created_at,
                updated_at: c.updated_at,
            }).collect();
            success(result, "Conversations retrieved successfully")
        }
        Err(e) => {
            tracing::error!(?e, "list conversations failed");
            Err(ApiError::internal("Failed to list conversations"))
        }
    }
}

pub async fn get_conversation_details(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
) -> ApiResult<Conversation> {
    let repo = SqlxConversationRepository { pool: state.db.clone() };
    match repo.find(&ConversationId(conversation_id.clone())).await {
        Ok(Some(c)) => success(Conversation {
            id: c.id.0,
            shop_id: c.shop_id,
            customer_id: c.customer_id,
            status: c.status,
            created_at: c.created_at,
            updated_at: c.updated_at,
        }, "Conversation details retrieved successfully"),
        Ok(None) => Err(ApiError::not_found("Conversation not found")),
        Err(e) => { tracing::error!(?e, "get conversation failed"); Err(ApiError::internal("Failed to get conversation")) }
    }
}

pub async fn create_conversation(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateConversationRequest>,
) -> ApiResult<Conversation> {
    let repo = SqlxConversationRepository { pool: state.db.clone() };
    let uc = CreateConversationUseCase::new(repo);
    let input = CreateConversationInput { shop_id: request.shop_id.clone(), customer_id: request.customer_id.clone() };
    match uc.exec(input).await {
        Ok(out) => {
            // 事件总线（open 已记录事件）暂未单独发布：open 构造期间事件在聚合内部未外传，这里简化忽略
            let conversation = Conversation { id: out.conversation_id, shop_id: request.shop_id, customer_id: request.customer_id, status: "active".into(), created_at: out.created_at, updated_at: out.created_at };
            success(conversation, "Conversation created successfully")
        }
        Err(e) => {
            let api_err = match e { CreateConversationError::AlreadyExists => ApiError::bad_request("Conversation already exists"), CreateConversationError::Domain(de) => ApiError::from(de), CreateConversationError::Repo(_) => ApiError::internal("Repository error"), };
            Err(api_err)
        }
    }
}

pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Vec<Message>> {
    let limit: i64 = params.get("limit").and_then(|l| l.parse().ok()).unwrap_or(50);
    let offset: i64 = params.get("offset").and_then(|o| o.parse().ok()).unwrap_or(0);
    let repo = MessageReadRepositorySqlx { pool: state.db.clone() };
    let conv_id = ConversationId(conversation_id.clone());
    match repo.list_by_conversation(&conv_id, limit, offset).await {
        Ok(domain_messages) => {
            let messages: Vec<Message> = domain_messages.into_iter().map(|m| Message {
                id: m.id.0,
                conversation_id: m.conversation_id.0,
                sender_id: m.sender_id,
                sender_type: m.sender_type.as_str().to_string(),
                content: m.content,
                message_type: m.message_type,
                timestamp: m.timestamp,
                shop_id: None, // 若需要 shop_id，可在仓库层 join conversations
            }).collect();
            success(messages, "Messages retrieved successfully")
        }
        Err(e) => { tracing::error!(?e, "list messages failed"); Err(ApiError::internal("Failed to list messages")) }
    }
}

pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Json(request): Json<CreateMessageRequest>,
) -> Result<Json<ApiResponse<Message>>, ApiError> {
    if conversation_id != request.conversation_id {
        return Err(ApiError::bad_request("conversation_id mismatch"));
    }
    let repo = SqlxConversationRepository { pool: state.db.clone() };
    let use_case = SendMessageUseCase::new(repo);
    let input = SendMessageInput {
        conversation_id: request.conversation_id.clone(),
        sender_id: request.sender_id.clone(),
        sender_type: request.sender_type.clone(),
        content: request.content.clone(),
        message_type: request.message_type.clone(),
    };
    match use_case.exec(input).await {
        Ok(out) => {
            // 直接通过富事件总线发布（附带完整消息），再 SELECT 一次用于 HTTP 返回
            let rich_bus = EventBusWithDb::new(state.message_sender.clone(), state.db.clone());
            rich_bus.publish(out.events.clone()).await; // await 发布
            // 为响应加载消息
            match sqlx::query("SELECT * FROM messages WHERE id = ?")
                .bind(&out.message_id)
                .fetch_one(&state.db).await {
                    Ok(row) => {
                        let message = Message {
                            id: row.get("id"),
                            conversation_id: row.get("conversation_id"),
                            sender_id: row.get("sender_id"),
                            sender_type: row.get("sender_type"),
                            content: row.get("content"),
                            message_type: row.get("message_type"),
                            timestamp: row.get("timestamp"),
                            shop_id: row.try_get("shop_id").ok(),
                        };
                        return success(message, "Message sent successfully");
                    }
                    Err(e) => { tracing::error!(?e, "load persisted message failed"); return Err(ApiError::internal("Failed to load persisted message")); }
                }
        }
        Err(e) => Err(ApiError::from(e))
    }
}

pub async fn update_message(
    State(state): State<Arc<AppState>>,
    Path((_conversation_id, message_id)): Path<(String, String)>,
    Json(request): Json<UpdateMessageRequest>,
) -> ApiResult<Message> {
    let repo = MessageRepositorySqlx { pool: state.db.clone() };
    let uc = UpdateMessageUseCase::new(repo);
    let input = UpdateMessageInput { message_id: message_id.clone(), new_content: request.content.clone() };
    match uc.exec(input).await {
        Ok(out) => {
            // 重新读取消息（排除软删除）
            match sqlx::query_as::<_, Message>("SELECT * FROM messages WHERE id = ? AND deleted_at IS NULL")
                .bind(&out.message_id)
                .fetch_one(&state.db)
                .await {
                    Ok(msg) => {
                        // 富事件发布（包含完整消息）
                        let rich_bus = EventBusWithDb::new(state.message_sender.clone(), state.db.clone());
                        rich_bus.publish(out.events).await;
                        success(msg, "Message updated successfully")
                    }
                    Err(e) => { tracing::error!(?e, "fetch updated message failed"); Err(ApiError::internal("Failed to load updated message")) }
                }
        }
        Err(e) => {
            let api_err = match e {
                UpdateMessageError::NotFound => ApiError::not_found("Message not found"),
                UpdateMessageError::Empty => ApiError::bad_request("Content cannot be empty"),
                UpdateMessageError::Repo(_) => ApiError::internal("Repository error"),
            };
            Err(api_err)
        }
    }
}

pub async fn delete_message(
    State(state): State<Arc<AppState>>,
    Path((_conversation_id, message_id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    let repo = MessageRepositorySqlx { pool: state.db.clone() };
    let uc = DeleteMessageUseCase::new(repo);
    // 默认软删除；未来可通过查询参数 hard=true 控制
    let input = DeleteMessageInput { message_id: message_id.clone(), hard: false };
    match uc.exec(input).await {
        Ok(out) => {
            let rich_bus = EventBusWithDb::new(state.message_sender.clone(), state.db.clone());
            rich_bus.publish(out.events).await;
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => {
            let api_err = match e {
                DeleteMessageError::NotFound => ApiError::not_found("Message not found"),
                DeleteMessageError::Repo(_) => ApiError::internal("Repository error"),
            }; Err(api_err)
        }
    }
}

pub async fn update_conversation_status(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
    Json(request): Json<UpdateConversationStatusRequest>,
) -> ApiResult<()> {
    let repo = SqlxConversationRepository { pool: state.db.clone() };
    let uc = UpdateConversationStatusUseCase::new(repo);
    let input = UpdateConversationStatusInput { conversation_id: conversation_id.clone(), target_status: request.status.clone() };
    match uc.exec(input).await {
        Ok(_out) => success_empty("Conversation status updated"),
        Err(e) => {
            let api_err = match e {
                UpdateConversationStatusError::NotFound => ApiError::not_found("Conversation not found"),
                UpdateConversationStatusError::Domain(de) => ApiError::from(de),
                UpdateConversationStatusError::Repo(_) => ApiError::internal("Repository error"),
                UpdateConversationStatusError::UnsupportedStatus => ApiError::bad_request("Unsupported status"),
            };
            Err(api_err)
        }
    }
}

pub async fn search_conversations(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Vec<Conversation>> {
    let shop_id = params.get("shop_id").map(|s| s.as_str());
    let term = params.get("q").map(|s| s.as_str());
    let rm = ConversationReadModelSqlx { pool: state.db.clone() };
    match rm.search(shop_id, term).await {
        Ok(rows) => {
            let list: Vec<Conversation> = rows.into_iter().map(|r| Conversation { id: r.id, shop_id: r.shop_id, customer_id: r.customer_id, status: r.status, created_at: r.created_at, updated_at: r.updated_at }).collect();
            success(list, "Search results")
        }
        Err(e) => {
            tracing::error!(?e, "search failed");
            Err(ApiError::internal("Failed to search conversations"))
        }
    }
}

pub async fn get_conversation_summary(
    State(state): State<Arc<AppState>>,
    Path(conversation_id): Path<String>,
) -> ApiResult<ConversationSummary> {
    let rm = ConversationReadModelSqlx { pool: state.db.clone() };
    match rm.summary(&conversation_id).await {
        Ok(view) => {
            // 适配旧结构 (customer_name / last_message) 暂用占位，后续可改为 join / 聚合统计
            let summary = ConversationSummary { id: view.id, shop_id: view.shop_id, customer_name: view.customer_id, last_message: format!("messages: {}", view.message_count), updated_at: view.updated_at, status: view.status };
            success(summary, "Conversation summary retrieved successfully")
        }
        Err(QueryError::NotFound) => Err(ApiError::not_found("Conversation not found")),
        Err(e) => { tracing::error!(?e, "summary failed"); Err(ApiError::internal("Failed to get conversation summary")) }
    }
}
