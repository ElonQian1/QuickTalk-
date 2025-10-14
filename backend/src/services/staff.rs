// Purpose: 店铺员工管理服务层
// Input: shop_id, requester(user_id), payload(username)
// Output: 列表 (id/username/email/phone/avatar_url/role) 或 Ok(())
// Errors: 权限不足/用户不存在/内部错误

use crate::{
    database::Database,
    error::AppError,
};
use tracing::error;

#[derive(serde::Serialize, Clone, Debug)]
pub struct StaffItem {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
}

pub async fn list_staff(db: &sea_orm::DatabaseConnection, requester_id: i64, shop_id: i64) -> Result<Vec<StaffItem>, AppError> {
    let is_member = crate::repositories::ShopStaffRepository::is_shop_member(db, shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_membership_failed".to_string()))?;
    if !is_member {
        return Err(AppError::Unauthorized);
    }

    let items = crate::repositories::ShopStaffRepository::list_shop_staff(db, shop_id)
        .await
        .map_err(|_| AppError::Internal("list_staff_failed".to_string()))?
        .into_iter()
        .map(|(u, role)| StaffItem {
            id: u.id as i64,
            username: u.username,
            email: u.email,
            phone: u.phone,
            avatar_url: u.avatar_url,
            role,
        })
        .collect();

    Ok(items)
}

pub async fn add_staff(db: &sea_orm::DatabaseConnection, requester_id: i64, shop_id: i64, username: &str) -> Result<(), AppError> {
    error!(target: "staff", "add_staff called: requester_id={}, shop_id={}, username={}", requester_id, shop_id, username);
    
    let is_owner = crate::repositories::ShopStaffRepository::is_shop_owner(db, shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?;
    if !is_owner {
        error!(target: "staff", "add_staff: requester {} is not owner of shop {}", requester_id, shop_id);
        return Err(AppError::Unauthorized);
    }
    if username.trim().is_empty() {
        error!(target: "staff", "add_staff: username is empty");
        return Err(AppError::BadRequest("username_required".to_string()));
    }

    crate::repositories::ShopStaffRepository::add_shop_staff_by_username(db, shop_id, username.trim(), Some("staff"))
        .await
        .map_err(|e| {
            let msg = e.to_string();
            error!(target: "staff", "add_staff failed: {}", msg);
            if msg.contains("user_not_found") {
                AppError::BadRequest("user_not_found".to_string())
            } else if msg.contains("already_member") {
                AppError::BadRequest("already_member".to_string())
            } else if msg.to_lowercase().contains("unique") {
                AppError::BadRequest("already_member".to_string())
            } else if msg.to_lowercase().contains("foreign key") {
                AppError::BadRequest("invalid_shop_or_user".to_string())
            } else {
                // 默认作为请求问题处理，避免 500 影响用户体验
                AppError::BadRequest("add_staff_failed".to_string())
            }
        })
}

pub async fn remove_staff(db: &sea_orm::DatabaseConnection, requester_id: i64, shop_id: i64, user_id: i64) -> Result<(), AppError> {
    let is_owner = crate::repositories::ShopStaffRepository::is_shop_owner(db, shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?;
    if !is_owner {
        return Err(AppError::Unauthorized);
    }
    // 不允许删除店主
    if crate::repositories::ShopStaffRepository::is_shop_owner(db, shop_id, user_id).await.unwrap_or(false) {
        return Err(AppError::BadRequest("cannot_remove_owner".to_string()));
    }
    let affected = crate::repositories::ShopStaffRepository::remove_shop_staff(db, shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("remove_staff_failed".to_string()))?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
