/// 公共权限验证和认证辅助函数
/// 用于消除各API模块中的重复权限检查代码

use sqlx::Row;
use std::sync::Arc;
use crate::bootstrap::app_state::AppState;
use crate::api::errors::ApiError;

/// 用户角色枚举
#[derive(Debug, PartialEq, Clone, serde::Serialize)]
pub enum UserRole {
    SuperAdmin,
    User,
}

impl UserRole {
    pub fn from_str(role: &str) -> Self {
        match role {
            "super_admin" => Self::SuperAdmin,
            _ => Self::User,
        }
    }
}

/// 权限检查结果
#[derive(Debug)]
pub struct AdminInfo {
    pub id: String,
    pub username: String,
    pub role: UserRole,
    pub email: Option<String>,
}

/// 获取管理员信息和角色
pub async fn get_admin_info(state: &Arc<AppState>, admin_id: &str) -> Result<AdminInfo, ApiError> {
    let row = sqlx::query("SELECT id, username, role, email FROM admins WHERE id = ?")
        .bind(admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            tracing::error!(error=%e, admin_id=%admin_id, "查询管理员信息失败");
            ApiError::internal("角色查询失败")
        })?;

    Ok(AdminInfo {
        id: row.get("id"),
        username: row.get("username"),
        role: UserRole::from_str(&row.get::<String, _>("role")),
        email: row.try_get("email").ok(),
    })
}

/// 强制要求超级管理员权限
pub async fn enforce_super_admin(state: &Arc<AppState>, admin_id: &str) -> Result<(), ApiError> {
    let admin_info = get_admin_info(state, admin_id).await?;
    if admin_info.role != UserRole::SuperAdmin {
        return Err(ApiError::forbidden("需要超级管理员权限"));
    }
    Ok(())
}

/// 检查管理员是否有权限访问指定店铺
/// 超级管理员可以访问所有店铺
/// 普通管理员只能访问自己拥有的店铺或者作为员工的店铺
pub async fn check_shop_access(
    state: &Arc<AppState>, 
    admin_id: &str, 
    shop_id: &str
) -> Result<bool, ApiError> {
    let admin_info = get_admin_info(state, admin_id).await?;
    
    // 超级管理员可以访问所有店铺
    if admin_info.role == UserRole::SuperAdmin {
        return Ok(true);
    }

    // 检查是否是店铺拥有者
    if super::permission_queries::is_shop_owner(&state.db, admin_id, shop_id).await? {
        return Ok(true);
    }

    // 检查是否是店铺的在职员工
    if let Some(email) = admin_info.email {
        if super::permission_queries::is_shop_employee(&state.db, &email, shop_id).await? {
            return Ok(true);
        }
    }

    Ok(false)
}

/// 确保管理员有权限访问指定店铺，如果没有权限则返回错误
pub async fn enforce_shop_access(
    state: &Arc<AppState>, 
    admin_id: &str, 
    shop_id: &str
) -> Result<(), ApiError> {
    let has_access = check_shop_access(state, admin_id, shop_id).await?;
    if !has_access {
        return Err(ApiError::forbidden("无权限访问此店铺"));
    }
    Ok(())
}

/// 获取管理员可访问的店铺列表
/// 超级管理员返回所有店铺，普通管理员返回拥有的和作为员工的店铺
pub async fn get_accessible_shops(
    state: &Arc<AppState>,
    admin_id: &str
) -> Result<Vec<String>, ApiError> {
    let admin_info = get_admin_info(state, admin_id).await?;
    
    if admin_info.role == UserRole::SuperAdmin {
        // 超级管理员可以访问所有店铺
        return super::permission_queries::get_all_shop_ids(&state.db).await;
    }

    // 普通管理员：获取拥有的店铺
    let mut shop_ids = super::permission_queries::get_owned_shop_ids(&state.db, admin_id).await?;

    // 如果有邮箱，查询作为员工的店铺
    if let Some(email) = admin_info.email {
        let employee_shop_ids = super::permission_queries::get_employee_shop_ids(&state.db, &email).await?;
        
        for shop_id in employee_shop_ids {
            if !shop_ids.contains(&shop_id) {
                shop_ids.push(shop_id);
            }
        }
    }

    Ok(shop_ids)
}