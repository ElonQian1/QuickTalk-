use crate::{auth::AuthUser, error::AppError};
use axum::{extract::State, Json};
use tracing::error;

use crate::{models::*, AppState};
use crate::services::metrics;

pub async fn get_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    // 使用真实数据库统计数据（含未读数聚合）
    match metrics::fetch_shops_with_unread_by_owner(&state.db, user_id).await {
        Ok(shops) => Ok(Json(shops)),
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
            
            // 根据错误类型返回不同的状态码
            let error_msg = e.to_string();
            if error_msg.contains("owner_not_found") {
                Err(AppError::Unauthorized)
            } else if error_msg.contains("slug_already_exists") {
                Err(AppError::BadRequest("店铺名称已存在".to_string()))
            } else {
                Err(AppError::Internal("创建店铺失败".to_string()))
            }
        }
    }
}

// 获取当前用户作为"员工"被加入的店铺列表（含未读）
pub async fn get_staff_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    match metrics::fetch_shops_with_unread_by_staff(&state.db, user_id).await {
        Ok(shops) => Ok(Json(shops)),
        Err(e) => {
            error!(error=?e, "查询员工店铺列表失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }
}
