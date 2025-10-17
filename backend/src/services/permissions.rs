// Purpose: 权限判定辅助（店铺维度）
// Input: user_id, shop_id
// Output: Ok(()) 表示允许；Err(AppError::Unauthorized) 表示拒绝

use crate::error::AppError;
use crate::database::Database;

/// 使用 SQLx 的权限检查：是否为店主
pub async fn is_shop_owner_sqlx(db: &Database, shop_id: i64, user_id: i64) -> anyhow::Result<bool> {
    let count: i64 = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!: i64" FROM shops s WHERE s.id = ? AND s.owner_id = ?"#,
        shop_id,
        user_id
    )
    .fetch_one(db.pool())
    .await?;
    Ok(count > 0)
}

/// 使用 SQLx 的权限检查：是否为成员（店主或员工）
pub async fn is_shop_member_sqlx(db: &Database, shop_id: i64, user_id: i64) -> anyhow::Result<bool> {
    // 任意一个存在即为成员
    let total: i64 = sqlx::query_scalar!(
        r#"
        SELECT (
            (SELECT COUNT(*) FROM shops s WHERE s.id = ? AND s.owner_id = ?) +
            (SELECT COUNT(*) FROM shop_staffs ss WHERE ss.shop_id = ? AND ss.user_id = ?)
        ) as "count!: i64"
        "#,
        shop_id, user_id, shop_id, user_id
    )
    .fetch_one(db.pool())
    .await?;
    Ok(total > 0)
}

/// 使用 SQLx 的权限断言：店主或员工
pub async fn ensure_member_or_owner_sqlx(db: &Database, user_id: i64, shop_id: i64) -> Result<(), AppError> {
    if is_shop_owner_sqlx(db, shop_id, user_id).await.map_err(|_| AppError::Internal("check_owner_failed".into()))? {
        return Ok(());
    }
    if is_shop_member_sqlx(db, shop_id, user_id).await.map_err(|_| AppError::Internal("check_membership_failed".into()))? {
        return Ok(());
    }
    Err(AppError::Unauthorized)
}

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
