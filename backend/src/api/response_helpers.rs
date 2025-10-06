/// API 响应格式化助手函数
/// 用于消除重复的JSON响应构造模式

use serde_json::{json, Value};
use crate::api::errors::{ApiResult, success};

/// 通用状态响应
pub fn success_status(status_key: &str, message: &str) -> ApiResult<Value> {
    success(json!({status_key: true}), message)
}

/// 更新成功响应
pub fn success_updated(message: &str) -> ApiResult<Value> {
    success_status("updated", message)
}

/// 登出成功响应  
pub fn success_logged_out(message: &str) -> ApiResult<Value> {
    success_status("logged_out", message)
}

/// 需要重新登录响应
pub fn success_require_relogin(message: &str) -> ApiResult<Value> {
    success_status("require_relogin", message)
}

/// 可用性检查响应
pub fn success_availability(available: bool, message: &str) -> ApiResult<Value> {
    success(json!({"available": available}), message)
}

/// API密钥响应
pub fn success_api_key(api_key: String, message: &str) -> ApiResult<Value> {
    success(json!({"api_key": api_key}), message)
}

/// 计数响应
pub fn success_count<T: serde::Serialize>(items: &[T], item_name: &str, message: &str) -> ApiResult<Value> {
    success(json!({"count": items.len(), item_name: items}), message)
}

/// 空数组响应（用于搜索关键字过短等场景）
pub fn success_empty_array<T>(message: &str) -> ApiResult<Vec<T>> {
    success(vec![], message)
}