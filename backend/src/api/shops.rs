use axum::{extract::{State, Query, Path}, response::Json};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::types::{ApiResponse, Shop};
use crate::types::dto::shops::{UpdateShopRequest};

// GET /api/shops/search?q=...&limit=20
pub async fn search_shops(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Shop>>>, axum::http::StatusCode> {
    let q = params.get("q").map(|s| s.trim().to_string()).unwrap_or_default();
    let limit: i64 = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .map(|n| n.clamp(1, 100))
        .unwrap_or(20);

    if q.is_empty() {
        return Ok(Json(ApiResponse { success: true, data: Some(vec![]), message: "关键字过短".into() }));
    }

    let like = format!("%{}%", q);
    let rows = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE name LIKE ? OR domain LIKE ? ORDER BY created_at DESC LIMIT ?")
        .bind(&like)
        .bind(&like)
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let shops: Vec<Shop> = rows
        .iter()
        .map(|row| Shop {
            id: row.get("id"),
            name: row.get("name"),
            domain: row.get("domain"),
            api_key: row.get("api_key"),
            owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
            status: row.get("status"),
            created_at: row.get("created_at"),
            payment_status: None,
            subscription_type: None,
            subscription_status: None,
            subscription_expires_at: None,
            contact_email: None,
            contact_phone: None,
            contact_info: None,
        })
        .collect();

    Ok(Json(ApiResponse { success: true, data: Some(shops), message: "搜索成功".into() }))
}

// GET /api/shops/check-domain?domain=xxx
pub async fn check_domain(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::http::StatusCode> {
    let domain = params.get("domain").cloned().unwrap_or_default();
    if domain.is_empty() {
        return Ok(Json(ApiResponse { success: false, data: None, message: "域名不能为空".into() }));
    }
    let row = sqlx::query("SELECT COUNT(*) as cnt FROM shops WHERE domain = ?")
        .bind(&domain)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let cnt: i64 = row.get("cnt");
    Ok(Json(ApiResponse {
        success: true,
        data: Some(serde_json::json!({"available": cnt == 0})),
        message: "ok".into(),
    }))
}

// DELETE /api/shops/:id
pub async fn delete_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    let result = sqlx::query("DELETE FROM shops WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    if result.rows_affected() > 0 {
        Ok(Json(ApiResponse { success: true, data: Some(()), message: "Shop deleted".into() }))
    } else {
        Err(axum::http::StatusCode::NOT_FOUND)
    }
}

// POST /api/shops/:id/rotate-api-key
pub async fn rotate_api_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::http::StatusCode> {
    let new_key = Uuid::new_v4().to_string();
    let res = sqlx::query("UPDATE shops SET api_key = ? WHERE id = ?")
        .bind(&new_key)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    if res.rows_affected() == 0 {
        return Err(axum::http::StatusCode::NOT_FOUND);
    }
    Ok(Json(ApiResponse { success: true, data: Some(serde_json::json!({"api_key": new_key})), message: "API key rotated".into() }))
}

pub async fn get_shops(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ApiResponse<Vec<Shop>>>, axum::http::StatusCode> {
    let rows = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops ORDER BY created_at DESC")
        .fetch_all(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let shops: Vec<Shop> = rows
        .iter()
        .map(|row| Shop {
            id: row.get("id"),
            name: row.get("name"),
            domain: row.get("domain"),
            api_key: row.get("api_key"),
            owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
            status: row.get("status"),
            created_at: row.get("created_at"),
            payment_status: None,
            subscription_type: None,
            subscription_status: None,
            subscription_expires_at: None,
            contact_email: None,
            contact_phone: None,
            contact_info: None,
        })
        .collect();

    Ok(Json(ApiResponse { success: true, data: Some(shops), message: "Shops retrieved successfully".into() }))
}

pub async fn create_shop(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let id = Uuid::new_v4().to_string();
    let api_key = Uuid::new_v4().to_string();
    // owner_id not part of UpdateShopRequest; retrieve existing owner or use default
    let owner_id_row = sqlx::query("SELECT owner_id FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::NOT_FOUND)?;
    let owner_id: String = owner_id_row.try_get("owner_id").unwrap_or_else(|_| "default_owner".to_string());

    let result = sqlx::query("INSERT INTO shops (id, name, domain, api_key, owner_id, status) VALUES (?, ?, ?, ?, ?, ?)
")
        .bind(&id)
        .bind(&payload.name)
        .bind(&payload.domain)
        .bind(&api_key)
        .bind(&owner_id)
        .bind("pending")
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => {
            let new_shop = Shop {
                id,
                name: payload.name.clone().unwrap_or_else(|| "Unnamed Shop".to_string()),
                domain: payload.domain.clone().unwrap_or_else(|| "no-domain".to_string()),
                api_key,
                owner_id,
                status: "pending".to_string(),
                created_at: chrono::Utc::now().to_string(),
                payment_status: None,
                subscription_type: None,
                subscription_status: None,
                subscription_expires_at: None,
                contact_email: None,
                contact_phone: None,
                contact_info: None,
            };
            Ok(Json(ApiResponse { success: true, data: Some(new_shop), message: "Shop created successfully".into() }))
        }
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn get_shop_details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await;

    match row {
        Ok(row) => {
            let shop = Shop {
                id: row.get("id"),
                name: row.get("name"),
                domain: row.get("domain"),
                api_key: row.get("api_key"),
                owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
                status: row.get("status"),
                created_at: row.get("created_at"),
                payment_status: None,
                subscription_type: None,
                subscription_status: None,
                subscription_expires_at: None,
                contact_email: None,
                contact_phone: None,
                contact_info: None,
            };
            Ok(Json(ApiResponse { success: true, data: Some(shop), message: "Shop details retrieved".into() }))
        }
        Err(sqlx::Error::RowNotFound) => Err(axum::http::StatusCode::NOT_FOUND),
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn update_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let mut tx = state.db.begin().await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut update_query = "UPDATE shops SET ".to_string();
    let mut params: Vec<String> = Vec::new();

    if let Some(name) = payload.name.as_ref() {
        update_query.push_str("name = ?, ");
        params.push(name.clone());
    }
    if let Some(domain) = payload.domain.as_ref() {
        update_query.push_str("domain = ?, ");
        params.push(domain.clone());
    }
    // Remove trailing comma and space
    update_query.pop();
    update_query.pop();

    update_query.push_str(" WHERE id = ?");
    params.push(id.clone());

    let mut query = sqlx::query(&update_query);
    for param in params {
        query = query.bind(param);
    }
    
    query.execute(&mut *tx).await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let updated_shop_row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit().await.map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let shop = Shop {
        id: updated_shop_row.get("id"),
        name: updated_shop_row.get("name"),
        domain: updated_shop_row.get("domain"),
        api_key: updated_shop_row.get("api_key"),
        owner_id: updated_shop_row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()),
        status: updated_shop_row.get("status"),
        created_at: updated_shop_row.get("created_at"),
        payment_status: None,
        subscription_type: None,
        subscription_status: None,
        subscription_expires_at: None,
        contact_email: None,
        contact_phone: None,
        contact_info: None,
    };

    Ok(Json(ApiResponse { success: true, data: Some(shop), message: "Shop updated successfully".into() }))
}

pub async fn approve_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    update_shop_status(state, id, "approved").await
}

pub async fn reject_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    update_shop_status(state, id, "rejected").await
}

pub async fn activate_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    update_shop_status(state, id, "active").await
}

pub async fn deactivate_shop(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    update_shop_status(state, id, "inactive").await
}

async fn update_shop_status(
    state: Arc<AppState>,
    id: String,
    status: &str,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    let result = sqlx::query("UPDATE shops SET status = ? WHERE id = ?")
        .bind(status)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    if result.rows_affected() > 0 {
        Ok(Json(ApiResponse { success: true, data: Some(()), message: format!("Shop status updated to {}", status) }))
    } else {
        Err(axum::http::StatusCode::NOT_FOUND)
    }
}

pub async fn create_shop_activation_order(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::http::StatusCode> {
    let order_id = Uuid::new_v4().to_string();
    let order_number = format!("ACTIVATION-{}", Uuid::new_v4().as_simple().to_string());
    let amount = 99.0; // Example amount
    let currency = "CNY";
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(30);

    let result = sqlx::query(
        "INSERT INTO activation_orders (id, shop_id, order_number, amount, currency, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ")
    .bind(&order_id)
    .bind(&shop_id)
    .bind(&order_number)
    .bind(amount)
    .bind(currency)
    .bind("pending")
    .bind(expires_at)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let response = serde_json::json!({
                "order_id": order_id,
                "order_number": order_number,
                "amount": amount,
                "currency": currency,
                "expires_at": expires_at,
            });
            Ok(Json(ApiResponse { success: true, data: Some(response), message: "Activation order created".into() }))
        }
        Err(_) => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR),
    }
}
