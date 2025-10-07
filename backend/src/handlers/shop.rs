use axum::{extract::State, http::StatusCode, Json};

use crate::{models::*, AppState};

pub async fn get_shops(
    State(state): State<AppState>,
    // TODO: 添加认证中间件提取用户ID
) -> Result<Json<Vec<ShopWithUnreadCount>>, StatusCode> {
    // 暂时硬编码用户ID为测试
    let user_id = 2i64;
    
    let shops = match state.db.get_shops_by_owner(user_id).await {
        Ok(shops) => shops,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut shops_with_unread = Vec::new();
    
    for shop in shops {
        // TODO: 计算每个店铺的未读消息总数
        let unread_count = 0; // 暂时设为0
        
        shops_with_unread.push(ShopWithUnreadCount {
            shop,
            unread_count,
        });
    }

    Ok(Json(shops_with_unread))
}

pub async fn create_shop(
    State(state): State<AppState>,
    Json(payload): Json<CreateShopRequest>,
) -> Result<Json<Shop>, StatusCode> {
    // TODO: 从认证中间件获取用户ID
    let user_id = 2i64;

    let shop = match state.db.create_shop(
        user_id,
        &payload.shop_name,
        payload.shop_url.as_deref(),
    ).await {
        Ok(shop) => shop,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    Ok(Json(shop))
}