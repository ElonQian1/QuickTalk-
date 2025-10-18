use crate::{auth::AuthUser, error::AppError};
use axum::{extract::{State, Query}, Json};
use serde::Deserialize;
use tracing::error;

use crate::{models::*, AppState};
use crate::services::metrics;
use crate::models::ShopWithOverview;

// Purpose: 店主查看自己店铺列表（含未读汇总），支持分页与仅活跃筛选
// Input: Query { only_active: Option<bool>, limit: Option<i64>, offset: Option<i64> }, AuthUser
// Output: Json<Vec<ShopWithUnreadCount>>
// Errors: 数据库查询失败 -> AppError::Internal
#[derive(Debug, Deserialize)]
pub(crate) struct ShopListQuery {
    #[serde(default, alias = "onlyActive")]
    pub only_active: Option<bool>,
    #[serde(default, alias = "pageSize")]
    pub limit: Option<i64>,
    #[serde(default, alias = "skip")]
    pub offset: Option<i64>,
    #[serde(default, alias = "order", alias = "sortBy")]
    pub sort: Option<String>, // 支持: unread_desc(默认) | created_at_desc | name_asc | name_desc
}

pub async fn get_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    // 解析查询参数，提供默认值并做基础校验
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    // 简单约束：limit 1..=200，offset >= 0
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    // 使用真实数据库统计数据（含未读数聚合）
    match metrics::fetch_shops_with_unread_by_owner_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref()).await {
        Ok(shops) => Ok(Json(shops)),
        Err(e) => {
            error!(error=?e, "查询店铺列表失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}

// 新增：返回包含 last_activity 与 last_message 的店铺列表（店主）
pub async fn get_shops_overview(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<Vec<ShopWithOverview>>, AppError> {
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    match metrics::fetch_shops_overview_by_owner_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref()).await {
        Ok(shops) => Ok(Json(shops)),
        Err(e) => {
            error!(error=?e, "查询店铺概览失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}

pub async fn create_shop(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<CreateShopRequest>,
) -> Result<Json<Shop>, AppError> {
    match state
        .shop_service
        .create_shop(
            user_id.try_into().unwrap(), 
            payload.shop_name.clone(), 
            payload.shop_name.clone(), // 使用店铺名作为slug 
            payload.shop_url.clone()
        )
        .await
    {
        Ok(shop_model) => {
            // 转换为期望的DTO格式
            let shop = Shop {
                id: shop_model.id as i64,
                owner_id: shop_model.owner_id.unwrap_or(0) as i64,
                shop_name: shop_model.shop_name,
                shop_url: shop_model.website_url,
                api_key: shop_model.api_key,
                status: if shop_model.is_active { 1 } else { 0 },
                created_at: shop_model.created_at.and_utc(),
                updated_at: shop_model.updated_at.and_utc(),
            };
            Ok(Json(shop))
        },
        Err(e) => {
            error!(error=?e, "创建店铺失败");
            Err(AppError::Internal("创建店铺失败".to_string()))
        }
    }
}

// Purpose: 获取当前用户作为“员工”加入的店铺列表（含未读汇总），支持分页与仅活跃筛选
// Input: Query { only_active: Option<bool>, limit: Option<i64>, offset: Option<i64> }, AuthUser
// Output: Json<Vec<ShopWithUnreadCount>>
// Errors: 数据库查询失败 -> AppError::Internal
pub async fn get_staff_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    match metrics::fetch_shops_with_unread_by_staff_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref()).await {
        Ok(shops) => Ok(Json(shops)),
        Err(e) => {
            error!(error=?e, "查询员工店铺列表失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}

// 新增：返回包含 last_activity 与 last_message 的员工店铺列表
pub async fn get_staff_shops_overview(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<Vec<ShopWithOverview>>, AppError> {
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    match metrics::fetch_shops_overview_by_staff_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref()).await {
        Ok(shops) => Ok(Json(shops)),
        Err(e) => {
            error!(error=?e, "查询员工店铺概览失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}

// Purpose: 店主店铺分页（含总数）
// Input: Query { only_active, limit, offset }, AuthUser
// Output: Json<PageResult<ShopWithUnreadCount>>
// Errors: 数据库查询失败 -> AppError::Internal
pub async fn get_shops_paged(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<PageResult<ShopWithUnreadCount>>, AppError> {
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    let total = metrics::count_shops_by_owner(&state.db, user_id, only_active)
        .await
        .map_err(|e| {
            error!(error=?e, "统计店铺总数失败");
            AppError::Internal("统计店铺总数失败".to_string())
        })?;
    let items = metrics::fetch_shops_with_unread_by_owner_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref())
        .await
        .map_err(|e| {
            error!(error=?e, "查询店铺列表失败");
            AppError::Internal("获取店铺失败".to_string())
        })?;

    Ok(Json(PageResult { items, total, limit, offset }))
}

// Purpose: 员工店铺分页（含总数）
// Input: Query { only_active, limit, offset }, AuthUser
// Output: Json<PageResult<ShopWithUnreadCount>>
// Errors: 数据库查询失败 -> AppError::Internal
pub async fn get_staff_shops_paged(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Query(q): Query<ShopListQuery>,
) -> Result<Json<PageResult<ShopWithUnreadCount>>, AppError> {
    let only_active = q.only_active.unwrap_or(true);
    let mut limit = q.limit.unwrap_or(50);
    let mut offset = q.offset.unwrap_or(0);
    if limit <= 0 { limit = 50; }
    if limit > 200 { limit = 200; }
    if offset < 0 { offset = 0; }

    let total = metrics::count_shops_by_staff(&state.db, user_id, only_active)
        .await
        .map_err(|e| {
            error!(error=?e, "统计员工店铺总数失败");
            AppError::Internal("统计店铺总数失败".to_string())
        })?;
    let items = metrics::fetch_shops_with_unread_by_staff_paged(&state.db, user_id, only_active, limit, offset, q.sort.as_deref())
        .await
        .map_err(|e| {
            error!(error=?e, "查询员工店铺列表失败");
            AppError::Internal("获取店铺失败".to_string())
        })?;

    Ok(Json(PageResult { items, total, limit, offset }))
}
