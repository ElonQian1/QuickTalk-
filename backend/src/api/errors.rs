use axum::{response::{IntoResponse, Response}, http::StatusCode, Json};
use serde::Serialize;
use crate::types::ApiResponse;
use crate::domain::conversation::{DomainError, RepoError};
use crate::application::usecases::send_message::UseCaseError;
use tracing::error;

#[derive(Debug, Serialize)]
#[allow(dead_code)] // 未来用于字段级错误返回
pub struct FieldError { pub field: String, pub message: String }

#[derive(Debug)]
pub enum ApiError {
    BadRequest(String),
    NotFound(String),
    Unauthorized(String),
    Forbidden(String),
    Conflict(String),
    Internal(String),
}

// 错误处理助手函数模块
pub mod db_helpers {
    use super::*;

    /// 统一的数据库错误处理助手 - 带详细日志
    pub fn handle_db_error<E: std::fmt::Display>(
        error: E,
        operation: &str,
        user_message: &str,
    ) -> ApiError {
        error!("Database operation failed: {} - {}", operation, error);
        ApiError::internal(user_message)
    }

    /// 统一的统计查询错误处理
    pub fn handle_count_error<E: std::fmt::Display>(error: E, entity: &str) -> ApiError {
        error!("Count query failed for {}: {}", entity, error);
        ApiError::internal("统计失败")
    }

    /// 统一的查询列表错误处理
    pub fn handle_list_error<E: std::fmt::Display>(error: E, entity: &str) -> ApiError {
        error!("List query failed for {}: {}", entity, error);
        ApiError::internal("查询失败")
    }

    /// 统一的单条记录查询错误处理
    pub fn handle_fetch_error<E: std::fmt::Display>(error: E, entity: &str) -> ApiError {
        error!("Fetch query failed for {}: {}", entity, error);
        ApiError::internal("查询失败")
    }

    /// 统一的更新操作错误处理
    pub fn handle_update_error<E: std::fmt::Display>(error: E, operation: &str) -> ApiError {
        error!("Update operation failed: {} - {}", operation, error);
        ApiError::internal("更新失败")
    }

    /// 统一的删除操作错误处理
    pub fn handle_delete_error<E: std::fmt::Display>(error: E, entity: &str) -> ApiError {
        error!("Delete operation failed for {}: {}", entity, error);
        ApiError::internal("删除失败")
    }

    /// 统一的插入操作错误处理
    pub fn handle_insert_error<E: std::fmt::Display>(error: E, entity: &str) -> ApiError {
        error!("Insert operation failed for {}: {}", entity, error);
        ApiError::internal("创建失败")
    }

    /// 统一的密码操作错误处理
    pub fn handle_password_error<E: std::fmt::Display>(error: E, operation: &str) -> ApiError {
        error!("Password {} failed: {}", operation, error);
        ApiError::internal("密码处理失败")
    }

    /// 统一的查询操作错误处理 - 支持 Not Found 情况
    pub fn handle_fetch_with_notfound_error<E: std::fmt::Debug>(error: E, entity: &str, not_found_msg: &str) -> ApiError {
        match format!("{:?}", error).contains("RowNotFound") {
            true => ApiError::not_found(not_found_msg),
            false => {
                error!(?error, "Fetch query failed for {}", entity);
                ApiError::internal("查询失败")
            }
        }
    }

    /// 统一的域名检测错误处理
    pub fn handle_domain_check_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("Domain check failed: {}", error);
        ApiError::internal("域名检测失败")
    }

    /// 统一的员工店铺查询错误处理
    pub fn handle_employee_shops_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("Employee shops query failed: {}", error);
        ApiError::internal("加载员工店铺失败")
    }

    /// 统一的订单创建错误处理
    pub fn handle_order_creation_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("Order creation failed: {}", error);
        ApiError::internal("创建订单失败")
    }

    /// 统一的目录创建错误处理
    pub fn handle_dir_creation_error<E: std::fmt::Display>(error: E, dir_path: &str) -> ApiError {
        error!("Directory creation failed at {}: {}", dir_path, error);
        ApiError::internal("创建上传目录失败")
    }

    /// 统一的文件写入错误处理
    pub fn handle_file_write_error<E: std::fmt::Display>(error: E, file_path: &str) -> ApiError {
        error!("File write failed at {}: {}", file_path, error);
        ApiError::internal("写入文件失败")
    }

    /// 统一的目录读取错误处理
    pub fn handle_dir_read_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("Directory read failed: {}", error);
        ApiError::internal("读取目录失败")
    }

    /// 统一的文件条目读取错误处理
    pub fn handle_file_entry_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("File entry read failed: {}", error);
        ApiError::internal("读取文件条目失败")
    }

    /// 统一的员工管理错误处理
    pub fn handle_employee_list_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to retrieve employees");
        ApiError::internal("获取员工列表失败")
    }

    pub fn handle_employee_add_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to add employee");
        ApiError::internal("添加员工失败")
    }

    pub fn handle_employee_remove_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to remove employee");
        ApiError::internal("移除员工失败")
    }

    pub fn handle_employee_role_update_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to update employee role");
        ApiError::internal("更新员工角色失败")
    }

    pub fn handle_user_search_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to search users");
        ApiError::internal("搜索用户失败")
    }

    pub fn handle_employee_invitation_error<E: std::fmt::Debug>(error: E) -> ApiError {
        error!(?error, "Failed to handle employee invitation");
        ApiError::internal("员工邀请处理失败")
    }

    pub fn handle_transaction_error<E: std::fmt::Debug>(error: E, operation: &str) -> ApiError {
        error!(?error, "Transaction failed: {}", operation);
        ApiError::internal("事务处理失败")
    }

    /// 统一的表单解析错误处理
    pub fn handle_multipart_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("Multipart form parsing failed: {}", error);
        ApiError::bad_request("表单解析失败")
    }

    /// 统一的文件字节读取错误处理
    pub fn handle_file_bytes_error<E: std::fmt::Display>(error: E) -> ApiError {
        error!("File bytes reading failed: {}", error);
        ApiError::bad_request("文件读取失败")
    }
}

impl ApiError {
    pub fn bad_request<M: Into<String>>(m: M) -> Self { Self::BadRequest(m.into()) }
    pub fn not_found<M: Into<String>>(m: M) -> Self { Self::NotFound(m.into()) }
    pub fn internal<M: Into<String>>(m: M) -> Self { Self::Internal(m.into()) }
    pub fn forbidden<M: Into<String>>(m: M) -> Self { Self::Forbidden(m.into()) }
    pub fn conflict<M: Into<String>>(m: M) -> Self { Self::Conflict(m.into()) }
    pub fn unauthorized<M: Into<String>>(m: M) -> Self { Self::Unauthorized(m.into()) }
    pub fn message(&self) -> &str { match self { ApiError::BadRequest(m)|ApiError::NotFound(m)|ApiError::Unauthorized(m)|ApiError::Forbidden(m)|ApiError::Conflict(m)|ApiError::Internal(m) => m } }
    pub fn status(&self) -> StatusCode { match self { ApiError::BadRequest(_) => StatusCode::BAD_REQUEST, ApiError::NotFound(_) => StatusCode::NOT_FOUND, ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED, ApiError::Forbidden(_) => StatusCode::FORBIDDEN, ApiError::Conflict(_) => StatusCode::CONFLICT, ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR } }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        // 对外结构可加入 code 字段（保持 data=None 与通用 message）
        let body = ApiResponse::<serde_json::Value> {
            success: false,
            data: Some(serde_json::json!({
                "code": status.as_u16(),
                "error": self.message(),
            })),
            message: self.message().to_string(),
        };
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
