use axum::{
    extract::{Path, State},
    Json,
};

use crate::{auth::AuthUser, error::AppError, models::*, AppState};
use serde_json::json;

pub async fn get_customers(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<Vec<CustomerWithSession>>, AppError> {
    match state
        .customer_service
        .get_customers_with_sessions(user_id, shop_id.try_into().unwrap())
        .await
    {
        Ok(customers) => {
            // 简化处理：暂时返回空列表，等Repository层返回正确格式
            let customer_sessions: Vec<CustomerWithSession> = Vec::new();
            Ok(Json(customer_sessions))
        },
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

// 标记为已读：将某店铺下某客户的未读数清零（仅店主可操作）
pub async fn reset_unread(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path((shop_id, customer_id)): Path<(i64, i64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    match state
        .session_service
        .reset_unread_count(user_id, shop_id.try_into().unwrap(), customer_id.try_into().unwrap())
        .await
    {
        Ok(_) => Ok(Json(serde_json::json!({"status": "success"}))),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}

// 批量标记已读：将某店铺下所有客户的未读数清零（仅店主可操作）
pub async fn reset_unread_all(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<serde_json::Value>, AppError> {
    match state
        .session_service
        .reset_all_unread_in_shop(user_id, shop_id.try_into().unwrap())
        .await
    {
        Ok(_) => Ok(Json(serde_json::json!({"status": "success"}))),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}
