// Purpose: 权限判定辅助（店铺维度）
// Input: user_id, shop_id
// Output: Ok(()) 表示允许；Err(AppError::Unauthorized) 表示拒绝

use crate::{database::Database, error::AppError};

pub async fn ensure_member_or_owner(db: &Database, user_id: i64, shop_id: i64) -> Result<(), AppError> {
    // 先判断是否店主
    if db
        .is_shop_owner(shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_owner_failed".to_string()))?
    {
        return Ok(());
    }

    // 再判断是否员工
    if db
        .is_shop_member(shop_id, user_id)
        .await
        .map_err(|_| AppError::Internal("check_membership_failed".to_string()))?
    {
        return Ok(());
    }

    Err(AppError::Unauthorized)
}
