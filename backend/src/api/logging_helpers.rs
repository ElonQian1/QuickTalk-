/// 日志记录助手模块
/// 用于统一处理各类日志记录模式，提供一致的日志格式和错误处理

use tracing::{error, info, debug};

/// 日志记录助手
pub struct LoggingHelpers;

impl LoggingHelpers {
    /// 记录带可选上下文的错误信息
    fn log_error_with_context<E: std::fmt::Display>(error: &E, base_fields: &[(&str, &str)], context: Option<&str>, message: &str) {
        if let Some(ctx) = context {
            let mut fields = base_fields.to_vec();
            fields.push(("context", ctx));
            error!(error=%error, ?fields, "{}", message);
        } else {
            error!(error=%error, ?base_fields, "{}", message);
        }
    }

    /// 记录带可选详情的信息日志
    fn log_info_with_details(base_fields: &[(&str, &str)], details: Option<&str>, message: &str) {
        if let Some(detail) = details {
            let mut fields = base_fields.to_vec();
            fields.push(("details", detail));
            info!(?fields, "{}", message);
        } else {
            info!(?base_fields, "{}", message);
        }
    }

    /// 记录数据库操作错误
    pub fn log_db_error<E: std::fmt::Display>(error: &E, operation: &str, context: Option<&str>) {
        Self::log_error_with_context(error, &[("operation", operation)], context, "数据库操作失败");
    }

    /// 记录数据库查询错误 (带ID)
    pub fn log_db_query_error<E: std::fmt::Display>(error: &E, entity: &str, id: &str) {
        error!(error=%error, entity=%entity, id=%id, "数据库查询失败");
    }

    /// 记录权限检查错误
    pub fn log_permission_error<E: std::fmt::Display>(error: &E, admin_id: &str, resource: &str, operation: &str) {
        error!(error=%error, admin_id=%admin_id, resource=%resource, operation=%operation, "权限检查失败");
    }

    /// 记录API操作成功信息
    pub fn log_api_success(operation: &str, admin_id: &str, details: Option<&str>) {
        Self::log_info_with_details(&[("operation", operation), ("admin_id", admin_id)], details, "API操作成功");
    }

    /// 记录业务操作信息
    pub fn log_business_operation(operation: &str, entity_type: &str, entity_id: &str, admin_id: &str) {
        info!(operation=%operation, entity_type=%entity_type, entity_id=%entity_id, admin_id=%admin_id, "业务操作执行");
    }

    /// 记录数据统计信息
    pub fn log_data_stats(operation: &str, count: usize, admin_id: &str) {
        info!(operation=%operation, count=%count, admin_id=%admin_id, "数据统计操作");
    }

    /// 记录文件操作
    pub fn log_file_operation(operation: &str, filename: &str, size: usize) {
        info!(operation=%operation, filename=%filename, size=%size, "文件操作");
    }

    /// 记录会话操作
    pub fn log_session_operation(operation: &str, admin_id: &str, result: &str) {
        info!(operation=%operation, admin_id=%admin_id, result=%result, "会话操作");
    }

    /// 记录搜索操作
    pub fn log_search_operation(keyword: &str, result_count: usize, admin_id: &str) {
        info!(keyword=%keyword, result_count=%result_count, admin_id=%admin_id, "搜索操作");
    }

    /// 记录状态变更操作
    pub fn log_status_change(entity_type: &str, entity_id: &str, old_status: &str, new_status: &str, admin_id: &str) {
        info!(entity_type=%entity_type, entity_id=%entity_id, old_status=%old_status, new_status=%new_status, admin_id=%admin_id, "状态变更");
    }

    /// 记录批量操作
    pub fn log_batch_operation(operation: &str, entity_type: &str, requested_count: usize, affected_count: usize, admin_id: &str) {
        info!(operation=%operation, entity_type=%entity_type, requested_count=%requested_count, affected_count=%affected_count, admin_id=%admin_id, "批量操作");
    }

    /// 记录警告信息
    pub fn log_warning(message: &str, context: Option<&str>) {
        Self::log_info_with_details(&[("message", message)], context, "操作警告");
    }

    /// 记录调试信息
    pub fn log_debug(component: &str, message: &str, data: Option<&str>) {
        if let Some(d) = data {
            debug!(component=%component, message=%message, data=%d, "调试信息");
        } else {
            debug!(component=%component, message=%message, "调试信息");
        }
    }
}