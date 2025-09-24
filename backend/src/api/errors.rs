use axum::{response::{IntoResponse, Response}, http::StatusCode, Json};
use serde::Serialize;
use crate::types::ApiResponse;
use crate::domain::conversation::{DomainError, RepoError};
use crate::application::usecases::send_message::UseCaseError;

#[derive(Debug, Serialize)]
#[allow(dead_code)] // 未来用于字段级错误返回
pub struct FieldError { pub field: String, pub message: String }

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    NotFound(String),
    #[allow(dead_code)] // 预留：鉴权模块接入后使用
    Unauthorized(String),
    #[allow(dead_code)] // 预留：权限控制（角色/策略）
    Forbidden(String),
    #[allow(dead_code)] // 预留：资源版本冲突/乐观锁
    Conflict(String),
    Internal(String),
    // 其他错误类型可以在这里添加
}

impl ApiError {
    pub fn bad_request<M: Into<String>>(m: M) -> Self { Self::BadRequest(m.into()) }
    pub fn not_found<M: Into<String>>(m: M) -> Self { Self::NotFound(m.into()) }
    pub fn internal<M: Into<String>>(m: M) -> Self { Self::Internal(m.into()) }
    pub fn message(&self) -> &str { match self { ApiError::BadRequest(m)|ApiError::NotFound(m)|ApiError::Unauthorized(m)|ApiError::Forbidden(m)|ApiError::Conflict(m)|ApiError::Internal(m) => m } }
    pub fn status(&self) -> StatusCode { match self { ApiError::BadRequest(_) => StatusCode::BAD_REQUEST, ApiError::NotFound(_) => StatusCode::NOT_FOUND, ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED, ApiError::Forbidden(_) => StatusCode::FORBIDDEN, ApiError::Conflict(_) => StatusCode::CONFLICT, ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR } }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let body = ApiResponse::<serde_json::Value> { success: false, data: None, message: self.message().to_string() };
        (status, Json(body)).into_response()
    }
}

// Conversions from domain / repo / use case errors
impl From<DomainError> for ApiError {
    fn from(e: DomainError) -> Self {
        match e {
            DomainError::EmptyMessage => ApiError::BadRequest("Message content cannot be empty".into()),
            DomainError::InvalidSenderType => ApiError::BadRequest("Invalid sender type".into()),
            DomainError::InvalidStateTransition(msg) => ApiError::BadRequest(format!("Invalid state transition: {}", msg)),
        }
    }
}
impl From<RepoError> for ApiError {
    fn from(e: RepoError) -> Self {
        match e { RepoError::NotFound => ApiError::NotFound("Resource not found".into()), RepoError::Database(msg) => ApiError::Internal(format!("Database error: {}", msg)) }
    }
}
impl From<UseCaseError> for ApiError {
    fn from(e: UseCaseError) -> Self {
        match e {
            UseCaseError::NotFound => ApiError::NotFound("Conversation not found".into()),
            UseCaseError::Domain(de) => ApiError::from(de),
            UseCaseError::Repo(msg) => ApiError::Internal(format!("Repository error: {}", msg)),
            UseCaseError::InvalidSenderType => ApiError::BadRequest("Invalid sender type".into()),
        }
    }
}

// Helper result alias
pub type ApiResult<T> = Result<Json<ApiResponse<T>>, ApiError>;

// Helper constructors
pub fn success<T>(data: T, message: &str) -> ApiResult<T> { Ok(Json(ApiResponse { success: true, data: Some(data), message: message.to_string() })) }
pub fn success_empty(message: &str) -> ApiResult<()> { Ok(Json(ApiResponse { success: true, data: None, message: message.to_string() })) }
