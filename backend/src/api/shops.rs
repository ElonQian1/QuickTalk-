use axum::{extract::{State, Query, Path}, response::Json};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::auth::SessionExtractor; // 解析会话
use tracing::info;
use crate::types::{ApiResponse, Shop};
use crate::types::dto::shops::UpdateShopRequest;
use crate::application::shops::usecases as shop_uc;

// 内部工具：确保调用者是 super_admin
async fn enforce_super_admin(state: &Arc<AppState>, admin_id: &str) -> Result<(), axum::http::StatusCode> {
    let row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = row.get("role");
    if role != "super_admin" { return Err(axum::http::StatusCode::FORBIDDEN); }
    Ok(())
}

// GET /api/shops/search?q=...&limit=20
pub async fn search_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
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
    // 角色判断
    let admin_role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = admin_role_row.get("role");

    let (sql, bind_owner) = if role == "super_admin" { (
        "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE (name LIKE ? OR domain LIKE ?) ORDER BY created_at DESC LIMIT ?",
        None
    ) } else { (
        "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE owner_id = ? AND (name LIKE ? OR domain LIKE ?) ORDER BY created_at DESC LIMIT ?",
        Some(session.admin_id.as_str())
    ) };

    let mut q = sqlx::query(sql);
    if let Some(o) = bind_owner { q = q.bind(o); }
    q = q.bind(&like).bind(&like).bind(limit);

    let rows = q.fetch_all(&state.db)
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
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    // 获取店铺 owner 与存在性
    let shop_row = sqlx::query("SELECT owner_id FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| match e { sqlx::Error::RowNotFound => axum::http::StatusCode::NOT_FOUND, _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR })?;
    let owner_id: String = shop_row.try_get("owner_id").unwrap_or_default();
    // 检查角色
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = role_row.get("role");
    if !(role == "super_admin" || owner_id == session.admin_id) {
        return Err(axum::http::StatusCode::FORBIDDEN);
    }
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
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<serde_json::Value>>, axum::http::StatusCode> {
    // 权限：owner 或 super_admin
    let shop_row = sqlx::query("SELECT owner_id FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| match e { sqlx::Error::RowNotFound => axum::http::StatusCode::NOT_FOUND, _ => axum::http::StatusCode::INTERNAL_SERVER_ERROR })?;
    let owner_id: String = shop_row.try_get("owner_id").unwrap_or_default();
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = role_row.get("role");
    if !(role == "super_admin" || owner_id == session.admin_id) { return Err(axum::http::StatusCode::FORBIDDEN); }

    let new_key = Uuid::new_v4().to_string();
    let res = sqlx::query("UPDATE shops SET api_key = ? WHERE id = ?")
        .bind(&new_key)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    if res.rows_affected() == 0 { return Err(axum::http::StatusCode::NOT_FOUND); }
    Ok(Json(ApiResponse { success: true, data: Some(serde_json::json!({"api_key": new_key})), message: "API key rotated".into() }))
}

pub async fn get_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Shop>>>, axum::http::StatusCode> {
    // 超级管理员默认仅查看待审核/非active (pending/rejected/inactive)，?all=1 查看全部
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = role_row.get("role");
    let all_flag = params.get("all").map(|v| v == "1" || v.eq_ignore_ascii_case("true" )).unwrap_or(false);

    let (sql, bind_owner, bind_extra): (&str, Option<&str>, Option<Vec<String>>) = if role == "super_admin" {
        if all_flag { (
            "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops ORDER BY created_at DESC",
            None,
            None
        ) } else { (
            "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE status IN ('pending','rejected','inactive') ORDER BY created_at DESC",
            None,
            None
        ) }
    } else { (
        "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE owner_id = ? ORDER BY created_at DESC",
        Some(session.admin_id.as_str()),
        None
    ) };

    let mut q = sqlx::query(sql);
    if let Some(owner) = bind_owner { q = q.bind(owner); }
    if let Some(extra) = bind_extra { for v in extra { q = q.bind(v); } }

    let rows = q.fetch_all(&state.db)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    info!(
        admin_id=%session.admin_id,
        role=%role,
        all_flag=%all_flag,
        returned=%rows.len(),
        "get_shops filtered result"
    );

    let shops: Vec<Shop> = rows.iter().map(|row| Shop {
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
    }).collect();

    Ok(Json(ApiResponse { success: true, data: Some(shops), message: "Shops retrieved successfully".into() }))
}

pub async fn create_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Json(payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let name = payload.name.clone().unwrap_or_else(|| "Unnamed Shop".to_string());
    let domain = payload.domain.clone().unwrap_or_else(|| "no-domain".to_string());
    let input = shop_uc::CreateShopInput { owner_id: session.admin_id.clone(), name, domain };
    match shop_uc::create_shop(&state.db, input).await {
        Ok(out) => {
            let shop = Shop { id: out.id, name: payload.name.unwrap_or("Unnamed Shop".into()), domain: payload.domain.unwrap_or("no-domain".into()), api_key: out.api_key, owner_id: session.admin_id, status: "pending".into(), created_at: out.created_at, payment_status: None, subscription_type: None, subscription_status: None, subscription_expires_at: None, contact_email: None, contact_phone: None, contact_info: None };
            Ok(Json(ApiResponse { success: true, data: Some(shop), message: "Shop created".into() }))
        }
        Err(e) => match e {
            shop_uc::ShopUseCaseError::DomainExists => Err(axum::http::StatusCode::CONFLICT),
            shop_uc::ShopUseCaseError::Domain(d) => {
                let msg = d.to_string();
                let body = ApiResponse::<Shop> { success: false, data: None, message: msg };
                return Ok(Json(body));
            }
            _ => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_shop_details(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await;

    match row {
        Ok(row) => {
            let owner_id: String = row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string());
            if owner_id != session.admin_id {
                // 再次确认是否 super_admin
                let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
                    .bind(&session.admin_id)
                    .fetch_one(&state.db)
                    .await
                    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
                let role: String = role_row.get("role");
                if role != "super_admin" {
                    return Err(axum::http::StatusCode::NOT_FOUND); // 避免泄漏存在性
                }
            }

            let shop = Shop {
                id: row.get("id"),
                name: row.get("name"),
                domain: row.get("domain"),
                api_key: row.get("api_key"),
                owner_id,
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
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
    Json(payload): Json<UpdateShopRequest>,
) -> Result<Json<ApiResponse<Shop>>, axum::http::StatusCode> {
    let input = shop_uc::UpdateShopInput { shop_id: id.clone(), actor_id: session.admin_id.clone(), name: payload.name.clone(), domain: payload.domain.clone() };
    match shop_uc::update_shop(&state.db, input).await {
        Ok(()) => {
            let row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
                .bind(&id)
                .fetch_one(&state.db)
                .await
                .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
            let shop = Shop { id: row.get("id"), name: row.get("name"), domain: row.get("domain"), api_key: row.get("api_key"), owner_id: row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string()), status: row.get("status"), created_at: row.get("created_at"), payment_status: None, subscription_type: None, subscription_status: None, subscription_expires_at: None, contact_email: None, contact_phone: None, contact_info: None };
            Ok(Json(ApiResponse { success: true, data: Some(shop), message: "Shop updated".into() }))
        }
        Err(e) => match e {
            shop_uc::ShopUseCaseError::NotFound => Err(axum::http::StatusCode::NOT_FOUND),
            shop_uc::ShopUseCaseError::Forbidden => Err(axum::http::StatusCode::FORBIDDEN),
            shop_uc::ShopUseCaseError::DomainExists => Err(axum::http::StatusCode::CONFLICT),
            shop_uc::ShopUseCaseError::NothingToUpdate => Err(axum::http::StatusCode::BAD_REQUEST),
            shop_uc::ShopUseCaseError::Domain(d) => {
                let body = ApiResponse::<Shop> { success: false, data: None, message: d.to_string() };
                return Ok(Json(body));
            }
            _ => Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn approve_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    enforce_super_admin(&state, &session.admin_id).await?;
    update_shop_status(state, id, "approved").await
}

pub async fn reject_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    enforce_super_admin(&state, &session.admin_id).await?;
    update_shop_status(state, id, "rejected").await
}

pub async fn activate_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    enforce_super_admin(&state, &session.admin_id).await?;
    update_shop_status(state, id, "active").await
}

pub async fn deactivate_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> Result<Json<ApiResponse<()>>, axum::http::StatusCode> {
    enforce_super_admin(&state, &session.admin_id).await?;
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
