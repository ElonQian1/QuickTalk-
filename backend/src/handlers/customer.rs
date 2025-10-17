use axum::{
    extract::{Path, State, Query},
    Json,
};
use serde::Deserialize;

use crate::{auth::AuthUser, error::AppError, models::*, AppState};
use crate::services::permissions as perms;

#[derive(Debug, Deserialize)]
pub(crate) struct CustomerListQuery {
    #[serde(default, alias = "pageSize")]
    pub limit: Option<i64>,
    #[serde(default, alias = "skip")]
    pub offset: Option<i64>,
    #[serde(default, alias = "q")]
    pub keyword: Option<String>,
    #[serde(default, alias = "order", alias = "sortBy")]
    pub sort: Option<String>, // 支持: last_active_desc(默认) | name_asc | name_desc
}

pub async fn get_customers(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
) -> Result<Json<Vec<CustomerWithSession>>, AppError> {
    // SQLx 权限校验（店主或成员）
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, shop_id).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
    eprintln!("🔍 get_customers: user_id={}, shop_id={}", user_id, shop_id);
    
    let result = state
        .customer_service
        .get_customers_with_sessions(user_id, shop_id.try_into().unwrap())
        .await;
    
    match result {
        Ok(customers) => {
            eprintln!("✅ 查询到 {} 个客户", customers.len());
            // 将 (customers::Model, Option<sessions::Model>) 转换为 CustomerWithSession
            let customer_sessions: Vec<CustomerWithSession> = customers
                .into_iter()
                .map(|(customer, session)| {
                    eprintln!("📝 转换客户: id={}, customer_id={}", customer.id, customer.customer_id);
                    CustomerWithSession {
                        customer: customer.into(),
                        session: session.map(|s| s.into()),
                        last_message: None, // TODO: 根据需要查询最后一条消息
                        unread_count: 0,    // TODO: 根据需要查询未读数
                    }
                })
                .collect();
            eprintln!("✅ 成功转换 {} 个客户响应", customer_sessions.len());
            Ok(Json(customer_sessions))
        },
        Err(e) => {
            let error_msg = e.to_string();
            eprintln!("❌ get_customers错误: {}", error_msg);
            
            // 根据错误类型返回不同的HTTP状态码
            if error_msg.contains("access_denied") || error_msg.contains("permission_denied") {
                Err(AppError::Forbidden)
            } else {
                Err(AppError::Internal(error_msg))
            }
        }
    }
}

/// 分页获取客户概览（含最后消息与未读）
pub async fn get_customers_paged(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path(shop_id): Path<i64>,
    Query(q): Query<CustomerListQuery>,
) -> Result<Json<PageResult<CustomerWithSession>>, AppError> {
    // SQLx 权限校验（店主或成员）
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, shop_id).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    let (items_raw, total) = state
        .customer_service
        .get_customers_overview_paged(
            user_id,
            shop_id.try_into().unwrap(),
            limit,
            offset,
            q.keyword.clone(),
            q.sort.clone(),
        )
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if msg.contains("access_denied") { AppError::Forbidden } else { AppError::Internal(msg) }
        })?;

    let items: Vec<CustomerWithSession> = items_raw.into_iter().map(|(customer, session, last_message, unread)| {
        CustomerWithSession {
            customer: customer.into(),
            session: session.map(|s| s.into()),
            last_message: last_message.map(|m| m.into()),
            unread_count: unread as i32,
        }
    }).collect();

    Ok(Json(PageResult { items, total, limit, offset }))
}

// 标记为已读：将某店铺下某客户的未读数清零（仅店主可操作）
pub async fn reset_unread(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Path((shop_id, customer_id)): Path<(i64, i64)>,
) -> Result<Json<serde_json::Value>, AppError> {
    // SQLx 权限校验（店主或成员）
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, shop_id).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
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
    // SQLx 权限校验（店主或成员）
    if let Err(e) = perms::ensure_member_or_owner_sqlx(&state.db, user_id, shop_id).await {
        return match e {
            AppError::Unauthorized => Err(AppError::Forbidden),
            other => Err(other),
        };
    }
    match state
        .session_service
        .reset_all_unread_in_shop(user_id, shop_id.try_into().unwrap())
        .await
    {
        Ok(_) => Ok(Json(serde_json::json!({"status": "success"}))),
        Err(e) => Err(AppError::Internal(e.to_string())),
    }
}
