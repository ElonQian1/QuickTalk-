use axum::{extract::State, Json};
use serde_json::json;
use sea_orm::*;

use crate::{auth::AuthUser, error::AppError, AppState};
use crate::entities::{users, shops, shop_staffs};

pub async fn debug_user_data(
    State(state): State<AppState>,
    AuthUser { user_id }: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    eprintln!("🔍 debug_user_data: user_id={}", user_id);
    
    // 查询当前用户信息
    let user = users::Entity::find_by_id(user_id as i32)
        .one(&state.db_connection)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    // 查询所有店铺
    let all_shops = shops::Entity::find()
        .all(&state.db_connection)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    // 查询所有员工关系
    let all_staff_relations = shop_staffs::Entity::find()
        .all(&state.db_connection)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    // 查询用户拥有的店铺
    let owned_shops = shops::Entity::find()
        .filter(shops::Column::OwnerId.eq(user_id as i32))
        .all(&state.db_connection)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    // 查询用户作为员工的店铺
    let staff_shops = shop_staffs::Entity::find()
        .filter(shop_staffs::Column::UserId.eq(user_id as i32))
        .all(&state.db_connection)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    
    let debug_info = json!({
        "current_user": {
            "id": user_id,
            "details": user
        },
        "all_shops": all_shops,
        "all_staff_relations": all_staff_relations,
        "owned_shops": owned_shops,
        "staff_shops": staff_shops,
        "summary": {
            "total_shops": all_shops.len(),
            "owned_shops_count": owned_shops.len(),
            "staff_shops_count": staff_shops.len()
        }
    });
    
    eprintln!("📊 Debug信息: {}", serde_json::to_string_pretty(&debug_info).unwrap_or_default());
    
    Ok(Json(debug_info))
}