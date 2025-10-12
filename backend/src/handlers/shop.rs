use crate::{auth::AuthUser, error::AppError, services::metrics};
use axum::{extract::State, Json};
use tracing::error;

use crate::{models::*, AppState};

pub async fn get_shops(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<Vec<ShopWithUnreadCount>>, AppError> {
    match metrics::fetch_shops_with_unread_by_owner(&state.db, user_id).await {
        Ok(shops_with_unread) => Ok(Json(shops_with_unread)),
        Err(e) => {
            error!(error=?e, "查询店铺列表失败");
            Err(AppError::Internal("获取店铺失败".to_string()))
        }
    }

    // 旧实现与 MOCK 数据逻辑已移除，统一通过 service/metrics 提供真实聚合结果
}

pub async fn create_shop(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
    Json(payload): Json<CreateShopRequest>,
) -> Result<Json<Shop>, AppError> {
    let shop = match state
        .db
        .create_shop(user_id, &payload.shop_name, payload.shop_url.as_deref())
        .await
    {
        Ok(shop) => shop,
        Err(_) => return Err(AppError::Internal("创建店铺失败".to_string())),
    };

    Ok(Json(shop))
}
