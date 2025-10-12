// Purpose: 店铺员工管理服务层
// Input: shop_id, requester(user_id), payload(username)
// Output: 列表 (id/username/email/phone/avatar_url/role) 或 Ok(())
// Errors: 权限不足/用户不存在/内部错误

use crate::{
    database::Database,
    error::AppError,
};

#[derive(serde::Serialize, Clone, Debug)]
pub struct StaffItem {
    pub id: i64,
    pub username: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
}

pub async fn list_staff(db: &Database, requester_id: i64, shop_id: i64) -> Result<Vec<StaffItem>, AppError> {
    let is_member = db
        .is_shop_member(shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_membership_failed".to_string()))?;
    if !is_member {
        return Err(AppError::Unauthorized);
    }

    let items = db
        .list_shop_staff(shop_id)
        .await
        .map_err(|_| AppError::Internal("list_staff_failed".to_string()))?
        .into_iter()
        .map(|(u, role)| StaffItem {
            id: u.id,
            username: u.username,
            email: u.email,
            phone: u.phone,
            avatar_url: u.avatar_url,
            role,
        })
        .collect();

    Ok(items)
}

pub async fn add_staff(db: &Database, requester_id: i64, shop_id: i64, username: &str) -> Result<(), AppError> {
    let is_owner = db
        .is_shop_owner(shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?;
    if !is_owner {
        return Err(AppError::Unauthorized);
    }
    if username.trim().is_empty() {
        return Err(AppError::BadRequest("username_required".to_string()));
    }

    db
        .add_shop_staff_by_username(shop_id, username.trim(), Some("staff"))
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("user_not_found") {
                AppError::BadRequest("user_not_found".to_string())
            } else {
                AppError::Internal("add_staff_failed".to_string())
            }
        })
}

pub async fn remove_staff(db: &Database, requester_id: i64, shop_id: i64, user_id: i64) -> Result<(), AppError> {
    let is_owner = db
        .is_shop_owner(shop_id, requester_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?;
    if !is_owner {
        return Err(AppError::Unauthorized);
    }
    // 不允许删除店主
    if db.is_shop_owner(shop_id, user_id).await.unwrap_or(false) {
        return Err(AppError::BadRequest("cannot_remove_owner".to_string()));
    }
    let affected = db
        .remove_shop_staff(shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("remove_staff_failed".to_string()))?;
    if affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}
