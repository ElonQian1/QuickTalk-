/// 权限相关的数据库查询助手函数
/// 用于消除auth_helpers中的重复查询和错误处理逻辑

use sqlx::{Row, SqlitePool};
use crate::api::errors::ApiError;
use crate::api::logging_helpers::LoggingHelpers;

/// 检查用户是否是指定店铺的所有者
pub async fn is_shop_owner(db: &SqlitePool, admin_id: &str, shop_id: &str) -> Result<bool, ApiError> {
    let row = sqlx::query("SELECT 1 FROM shops WHERE id = ? AND owner_id = ?")
        .bind(shop_id)
        .bind(admin_id)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            LoggingHelpers::log_permission_error(&e, admin_id, shop_id, "检查店铺拥有者");
            ApiError::internal("权限检查失败")
        })?;
    
    Ok(row.is_some())
}

/// 检查用户是否是指定店铺的活跃员工  
pub async fn is_shop_employee(db: &SqlitePool, email: &str, shop_id: &str) -> Result<bool, ApiError> {
    let row = sqlx::query("SELECT 1 FROM employees WHERE shop_id = ? AND status = 'active' AND email = ?")
        .bind(shop_id)
        .bind(email)
        .fetch_optional(db)
        .await
        .map_err(|e| {
            LoggingHelpers::log_permission_error(&e, email, shop_id, "检查员工状态");
            ApiError::internal("权限检查失败")
        })?;
    
    Ok(row.is_some())
}

/// 获取用户拥有的所有店铺ID
pub async fn get_owned_shop_ids(db: &SqlitePool, admin_id: &str) -> Result<Vec<String>, ApiError> {
    let rows = sqlx::query("SELECT id FROM shops WHERE owner_id = ?")
        .bind(admin_id)
        .fetch_all(db)
        .await
        .map_err(|e| {
            LoggingHelpers::log_db_query_error(&e, "owned_shops", admin_id);
            ApiError::internal("查询失败")
        })?;
    
    Ok(rows.iter().map(|row| row.get::<String, _>("id")).collect())
}

/// 获取用户作为员工的所有店铺ID
pub async fn get_employee_shop_ids(db: &SqlitePool, email: &str) -> Result<Vec<String>, ApiError> {
    let rows = sqlx::query("SELECT DISTINCT shop_id FROM employees WHERE email = ? AND status = 'active'")
        .bind(email)
        .fetch_all(db)
        .await
        .map_err(|e| {
            LoggingHelpers::log_db_query_error(&e, "employee_shops", email);
            ApiError::internal("查询失败")
        })?;
    
    Ok(rows.iter().map(|row| row.get::<String, _>("shop_id")).collect())
}

/// 获取所有店铺ID（超级管理员使用）
pub async fn get_all_shop_ids(db: &SqlitePool) -> Result<Vec<String>, ApiError> {
    let rows = sqlx::query("SELECT id FROM shops ORDER BY created_at")
        .fetch_all(db)
        .await
        .map_err(|e| {
            LoggingHelpers::log_db_error(&e, "查询所有店铺", None);
            ApiError::internal("查询失败")
        })?;
    
    Ok(rows.iter().map(|row| row.get::<String, _>("id")).collect())
}