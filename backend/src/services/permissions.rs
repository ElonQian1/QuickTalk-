// Purpose: 权限判定辅助（店铺维度）
// Input: user_id, shop_id
// Output: Ok(()) 表示允许；Err(AppError::Unauthorized) 表示拒绝

use crate::error::AppError;

pub async fn ensure_member_or_owner(db: &sea_orm::DatabaseConnection, user_id: i64, shop_id: i64) -> Result<(), AppError> {
    // 先判断是否店主
    if crate::repositories::ShopStaffRepository::is_shop_owner(db, shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?
    {
        return Ok(());
    }

    // 再判断是否员工
    if crate::repositories::ShopStaffRepository::is_shop_member(db, shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_membership_failed".to_string()))?
    {
        return Ok(());
    }

    Err(AppError::Unauthorized)
}
