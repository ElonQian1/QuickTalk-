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
            // 将 (customers::Model, Option<sessions::Model>) 转换为 CustomerWithSession
            let customer_sessions: Vec<CustomerWithSession> = customers
                .into_iter()
                .map(|(customer, session)| CustomerWithSession {
                    customer: customer.into(),
                    session: session.map(|s| s.into()),
                    last_message: None, // TODO: 根据需要查询最后一条消息
                    unread_count: 0,    // TODO: 根据需要查询未读数
                })
                .collect();
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
