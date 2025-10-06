/// 系统状态管理助手模块
/// 用于消除错误收集、状态判断、结果构造等重复代码模式

use serde_json::{json, Value};
use crate::types::ApiResponse;
use axum::response::Json as AxumJson;

/// 操作结果收集器
pub struct OperationCollector {
    pub successes: Vec<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl OperationCollector {
    /// 创建新的收集器
    pub fn new() -> Self {
        Self {
            successes: Vec::new(),
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }

    /// 添加成功记录
    pub fn add_success(&mut self, message: String) {
        self.successes.push(message);
    }

    /// 添加错误记录
    pub fn add_error(&mut self, message: String) {
        self.errors.push(message);
    }

    /// 添加警告记录
    pub fn add_warning(&mut self, message: String) {
        self.warnings.push(message);
    }

    /// 是否有错误
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }

    /// 是否成功（无错误）
    pub fn is_success(&self) -> bool {
        self.errors.is_empty()
    }

    /// 获取状态字符串
    pub fn status_text(&self) -> &'static str {
        if self.is_success() { "通过" } else { "失败" }
    }

    /// 获取成功状态的emoji字符串
    pub fn status_message<'a>(&self, success_msg: &'a str, fail_msg: &'a str) -> &'a str {
        if self.is_success() { success_msg } else { fail_msg }
    }

    /// 构造标准的统计摘要
    pub fn summary(&self) -> Value {
        json!({
            "success_count": self.successes.len(),
            "error_count": self.errors.len(),
            "warning_count": self.warnings.len(),
            "status": self.status_text()
        })
    }

    /// 构造完整的结果JSON
    pub fn result(&self) -> Value {
        json!({
            "is_valid": self.is_success(),
            "successes": self.successes,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": self.summary()
        })
    }

    /// 构造API响应
    pub fn to_api_response(&self, message: &str) -> AxumJson<ApiResponse<Value>> {
        AxumJson(ApiResponse {
            success: self.is_success(),
            data: Some(self.result()),
            message: message.to_string(),
        })
    }
}

/// 系统状态助手
pub struct SystemStatusHelpers;

impl SystemStatusHelpers {
    /// 构造修复操作结果
    pub fn repair_result(
        fixed_items: &[String], 
        errors: &[String], 
        _operation_type: &str,
        additional_data: Option<Value>
    ) -> Value {
        let mut result = json!({
            "fixed_count": fixed_items.len(),
            "error_count": errors.len(),
            "fixed_items": fixed_items,
            "errors": errors,
            "success": errors.is_empty()
        });
        
        if let Some(data) = additional_data {
            result.as_object_mut().unwrap().extend(data.as_object().unwrap().clone());
        }
        
        result
    }

    /// 构造清理操作结果  
    pub fn cleanup_result(
        affected_count: usize,
        errors: &[String],
        operation_type: &str
    ) -> Value {
        json!({
            "operation": operation_type,
            "affected_count": affected_count,
            "error_count": errors.len(),
            "errors": errors,
            "success": errors.is_empty()
        })
    }

    /// 构造验证结果
    pub fn validation_result(
        errors: &[String],
        warnings: &[String]
    ) -> Value {
        json!({
            "is_valid": errors.is_empty(),
            "errors": errors,
            "warnings": warnings,
            "summary": {
                "error_count": errors.len(),
                "warning_count": warnings.len(),
                "status": if errors.is_empty() { "通过" } else { "失败" }
            }
        })
    }

    /// 获取操作状态消息
    pub fn operation_status_message(
        success_count: usize,
        error_count: usize,
        operation_name: &str
    ) -> String {
        if error_count == 0 {
            format!("✅ {} 操作完成: 成功 {}", operation_name, success_count)
        } else {
            format!("❌ {} 操作完成: 成功 {}, 失败 {}", operation_name, success_count, error_count)
        }
    }
}