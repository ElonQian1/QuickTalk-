use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use tracing::{error, warn, info};

use crate::{models::*, AppState};

pub async fn get_shops(
    State(state): State<AppState>,
    // TODO: 未来：从认证中间件获取 user_id
) -> Result<Json<Vec<ShopWithUnreadCount>>, StatusCode> {
    let user_id = 2i64; // 临时硬编码

    // 临时返回 mock 数据用于开发测试
    info!("/api/shops 返回 MOCK 数据");
    let demo = vec![
        ShopWithUnreadCount { 
            shop: Shop { 
                id: 1, 
                owner_id: user_id, 
                shop_name: "Demo Shop".into(), 
                shop_url: Some("https://demo.local".into()), 
                api_key: "demo-api-key".into(), 
                status: 1, 
                created_at: chrono::Utc::now(), 
                updated_at: chrono::Utc::now() 
            }, 
            unread_count: 0
        },
        ShopWithUnreadCount { 
            shop: Shop { 
                id: 2, 
                owner_id: user_id, 
                shop_name: "Test Shop".into(), 
                shop_url: None, 
                api_key: "test-api-key".into(), 
                status: 1, 
                created_at: chrono::Utc::now(), 
                updated_at: chrono::Utc::now() 
            }, 
            unread_count: 3
        },
    ];
    return Ok(Json(demo));

    // 原来的数据库查询代码（暂时注释）
    /*
    // 可选：允许通过环境变量启用 mock（例如开发阶段后端 DB 未准备好）
    if std::env::var("ENABLE_MOCK_SHOPS").map(|v| v == "1" || v.eq_ignore_ascii_case("true")).unwrap_or(false) {
        info!("/api/shops 使用 MOCK 数据 (ENABLE_MOCK_SHOPS=1)");
        let demo = vec![
            ShopWithUnreadCount { shop: Shop { id: 1, owner_id: user_id, shop_name: "Demo Shop".into(), shop_url: Some("https://demo.local".into()), api_key: "demo-api-key".into(), status: 1, created_at: chrono::Utc::now(), updated_at: chrono::Utc::now() }, unread_count: 0},
            ShopWithUnreadCount { shop: Shop { id: 2, owner_id: user_id, shop_name: "Test Shop".into(), shop_url: None, api_key: "test-api-key".into(), status: 1, created_at: chrono::Utc::now(), updated_at: chrono::Utc::now() }, unread_count: 3},
        ];
        return Ok(Json(demo));
    }

    match state.db.get_shops_by_owner(user_id).await {
        Ok(shops) => {
            let shops_with_unread: Vec<_> = shops.into_iter().map(|shop| ShopWithUnreadCount { shop, unread_count: 0 }).collect();
            Ok(Json(shops_with_unread))
        }
        Err(e) => {
            error!(error=?e, "查询店铺列表失败");

            let soft = std::env::var("DISABLE_SOFT_FAIL").map(|v| v != "1").unwrap_or(true);
            if soft {
                warn!("shop 查询失败，软回退返回空数组 (unset DISABLE_SOFT_FAIL 或其!=1)");
                return Ok(Json(vec![]));
            }

            // 返回结构化错误（可在前端根据 code 做处理）
            #[derive(serde::Serialize)]
            struct ErrResp<'a> { code: &'a str, message: &'a str }
            let body = Json(ErrResp { code: "INTERNAL_ERROR", message: "获取店铺失败" });
            // 这里用 axum::response::IntoResponse 的 tuple 实现 (StatusCode, Json)
            let resp = (StatusCode::INTERNAL_SERVER_ERROR, body).into_response();
            // 需要引入 IntoResponse
            return Err(StatusCode::INTERNAL_SERVER_ERROR).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR).and(Ok(resp)).unwrap_err();
        }
    }
    */
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