use axum::{
    extract::{Path, State},
    Json,
};

use crate::{auth::AuthUser, error::AppError, models::*, services::permissions, AppState};
use serde_json::json;

pub async fn get_customers(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<Vec<CustomerWithSession>>, AppError> {
    // 权限：仅店主或该店铺员工可查看客户列表
    if let Err(e) = permissions::ensure_member_or_owner(&state.db, user_id, shop_id).await {
        return Err(match e { AppError::Unauthorized => AppError::Forbidden, other => other });
    }
    let overview = state
        .db
        .get_customers_overview_by_shop(shop_id)
        .await
        .map_err(|_| AppError::Internal("获取客户列表失败".to_string()))?;

    Ok(Json(overview))
}

// 标记为已读：将某店铺下某客户的未读数清零（仅店主可操作）
pub async fn reset_unread(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path((shop_id, customer_id)): Path<(i64, i64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 鉴权：确保是店主或该店铺员工
    let shop = state
        .db
        .get_shop_by_id(shop_id)
        .await
        .map_err(|_| AppError::Internal("查询店铺失败".to_string()))?
        .ok_or(AppError::NotFound)?;

    if let Err(e) = permissions::ensure_member_or_owner(&state.db, user_id, shop.id).await {
        return Err(match e { AppError::Unauthorized => AppError::Forbidden, other => other });
    }

    state
        .db
        .reset_unread_count(shop_id, customer_id)
        .await
        .map_err(|_| AppError::Internal("重置未读失败".to_string()))?;

    Ok(Json(json!({ "success": true })))
}

// 批量标记已读：将某店铺下所有客户的未读数清零（仅店主可操作）
pub async fn reset_unread_all(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    // 鉴权：确保是店主或该店铺员工
    let shop = state
        .db
        .get_shop_by_id(shop_id)
        .await
        .map_err(|_| AppError::Internal("查询店铺失败".to_string()))?
        .ok_or(AppError::NotFound)?;

    if let Err(e) = permissions::ensure_member_or_owner(&state.db, user_id, shop.id).await {
        return Err(match e { AppError::Unauthorized => AppError::Forbidden, other => other });
    }

    state
        .db
        .reset_unread_all_in_shop(shop_id)
        .await
        .map_err(|_| AppError::Internal("批量重置未读失败".to_string()))?;

    Ok(Json(json!({ "success": true })))
}
