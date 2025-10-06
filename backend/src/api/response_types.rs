/// API响应类型统一模块
/// 用于消除重复的响应类型定义和构造模式，提供一致的API响应接口

use axum::{response::Json as AxumJson, http::StatusCode};
use serde_json::json;
use crate::types::ApiResponse;
use crate::api::errors::ApiError;

/// 标准API响应类型
pub type StandardApiResult<T> = Result<AxumJson<ApiResponse<T>>, ApiError>;

/// JSON响应类型（向后兼容）
pub type JsonResult = Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError>;

/// 系统响应类型（带StatusCode）
pub type SystemResult = Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode>;

/// 响应构造助手
pub struct ResponseBuilder;

impl ResponseBuilder {
    /// 构造成功的JSON响应
    pub fn success_json<T: serde::Serialize>(data: T, message: &str) -> StandardApiResult<T> {
        Ok(AxumJson(ApiResponse {
            success: true,
            data: Some(data),
            message: message.to_string(),
        }))
    }

    /// 构造成功的通用JSON响应
    pub fn success_value(data: serde_json::Value, message: &str) -> JsonResult {
        Ok(AxumJson(ApiResponse {
            success: true,
            data: Some(data),
            message: message.to_string(),
        }))
    }

    /// 构造失败的JSON响应
    pub fn error_json(message: &str) -> JsonResult {
        Ok(AxumJson(ApiResponse {
            success: false,
            data: None,
            message: message.to_string(),
        }))
    }

    /// 构造系统成功响应
    pub fn system_success(data: serde_json::Value, message: &str) -> SystemResult {
        Ok(AxumJson(ApiResponse {
            success: true,
            data: Some(data),
            message: message.to_string(),
        }))
    }

    /// 构造系统失败响应
    pub fn system_error(message: &str) -> SystemResult {
        Ok(AxumJson(ApiResponse {
            success: false,
            data: None,
            message: message.to_string(),
        }))
    }

    /// 构造简单状态响应
    pub fn simple_status(status: &str, message: &str) -> JsonResult {
        Self::success_value(json!({ "status": status }), message)
    }

    /// 构造更新成功响应
    pub fn updated(message: &str) -> JsonResult {
        Self::success_value(json!({ "updated": true }), message)
    }

    /// 构造删除成功响应
    pub fn deleted(message: &str) -> JsonResult {
        Self::success_value(json!({ "deleted": true }), message)
    }

    /// 构造创建成功响应
    pub fn created<T: serde::Serialize>(data: T, message: &str) -> StandardApiResult<T> {
        // 复用success_json，避免重复实现
        Self::success_json(data, message)
    }

    /// 构造统计响应
    pub fn stats(count: usize, entity: &str) -> JsonResult {
        Self::success_value(json!({ 
            "count": count,
            "entity": entity 
        }), "统计完成")
    }

    /// 构造可用性检查响应
    pub fn availability(available: bool, message: &str) -> JsonResult {
        Self::success_value(json!({ "available": available }), message)
    }

    /// 构造批量操作响应
    pub fn batch_operation(requested: usize, affected: usize, operation: &str) -> JsonResult {
        Self::success_value(json!({
            "operation": operation,
            "requested_count": requested,
            "affected_count": affected
        }), "批量操作完成")
    }
}