use crate::{auth::AuthUser, error::AppError};
use axum::{extract::State, Json};
use tracing::error;

use crate::{models::*, AppState};

pub async fn get_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    match state.shop_service.get_shops_by_owner(user_id).await {
        Ok(_shops) => {
            // 暂时返回空列表，等Repository层返回正确格式
            let shops_with_unread: Vec<ShopWithUnreadCount> = Vec::new();
            Ok(Json(shops_with_unread))
        },
        Err(e) => {
            error!(error=?e, "查询店铺列表失败");
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
                shop_name: shop_model.name,
                shop_url: shop_model.website_url,
                api_key: shop_model.api_key.unwrap_or_default(),
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

// 获取当前用户作为"员工"被加入的店铺列表（含未读）
pub async fn get_staff_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    match state.shop_service.get_shops_by_staff(user_id).await {
        Ok(_shops) => {
            // 暂时返回空列表，等Repository层返回正确格式
            let shops_with_unread: Vec<ShopWithUnreadCount> = Vec::new();
            Ok(Json(shops_with_unread))
        },
        Err(e) => {
            error!(error=?e, "查询员工店铺列表失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}
