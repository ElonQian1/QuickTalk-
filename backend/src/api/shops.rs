use axum::{extract::{State, Query, Path}, response::Json};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::auth::SessionExtractor; // 解析会话
use crate::types::Shop;
use crate::api::errors::{ApiError, ApiResult, success, success_empty};
use crate::api::auth_helpers::{get_admin_info, UserRole, enforce_super_admin};
use crate::api::response_types::{StandardApiResult, JsonResult, ResponseBuilder};
use crate::api::input_validators::InputValidators;
use crate::api::logging_helpers::LoggingHelpers;
use crate::types::dto::shops::UpdateShopRequest;
use crate::application::shops::usecases as shop_uc;
use chrono::Utc;

// GET /api/shops/search?q=...&limit=20
pub async fn search_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Query(params): Query<HashMap<String, String>>,
) -> StandardApiResult<Vec<Shop>> {
    let q = InputValidators::clean_query_param(params.get("q").map(|s| s.as_str()));
    let limit: i64 = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .map(|n| n.clamp(1, 100))
        .unwrap_or(20);

    if q.is_empty() {
        return super::response_helpers::success_empty_array("关键字过短");
    }

    let like = format!("%{}%", q);
    // 使用公共权限检查函数
    let admin_info = get_admin_info(&state, &session.admin_id).await?;

    let (sql, bind_owner) = if admin_info.role == UserRole::SuperAdmin { (
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
        .map_err(|e| super::errors::db_helpers::handle_list_error(e, "shops"))?;

    let shops: Vec<Shop> = rows
        .iter()
        .map(|row| super::data_mappers::row_to_shop(row))
        .collect();

    ResponseBuilder::success_json(shops, "搜索完成")
}

// GET /api/shops/check-domain?domain=xxx
pub async fn check_domain(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> JsonResult {
    let domain = InputValidators::validate_and_clean_string(
        &params.get("domain").cloned().unwrap_or_default(), 
        "域名"
    )?;
    let available = super::query_helpers::QueryHelpers::check_domain_availability(&state.db, &domain).await?;
    super::response_helpers::success_availability(available, "ok")
}

// DELETE /api/shops/:id
pub async fn delete_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<()> {
    // 获取店铺 owner 与存在性
    let shop_row = sqlx::query("SELECT owner_id FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_fetch_with_notfound_error(e, "shop owner", "店铺不存在"))?;
    let owner_id: String = shop_row.try_get("owner_id").unwrap_or_default();
    
    // 检查权限：使用统一的权限检查函数
    let admin_info = get_admin_info(&state, &session.admin_id).await?;
    if !(admin_info.role == UserRole::SuperAdmin || owner_id == session.admin_id) {
        return Err(ApiError::forbidden("无权限删除该店铺"));
    }
    
    let result = sqlx::query("DELETE FROM shops WHERE id = ?")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_delete_error(e, "shop"))?;
    if result.rows_affected() > 0 {
        success_empty("店铺删除成功")
    } else {
        Err(ApiError::not_found("店铺不存在"))
    }
}

// POST /api/shops/:id/rotate-api-key
pub async fn rotate_api_key(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<serde_json::Value> {
    // 权限：owner 或 super_admin
    let shop_row = sqlx::query("SELECT owner_id FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_fetch_with_notfound_error(e, "shop for rotation", "店铺不存在"))?;
    let owner_id: String = shop_row.try_get("owner_id").unwrap_or_default();
    let admin_info = get_admin_info(&state, &session.admin_id).await?;
    if !(admin_info.role == UserRole::SuperAdmin || owner_id == session.admin_id) { 
        return Err(ApiError::forbidden("无权限操作")); 
    }

    let new_key = Uuid::new_v4().to_string();
    let res = sqlx::query("UPDATE shops SET api_key = ? WHERE id = ?")
        .bind(&new_key)
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_update_error(e, "api key rotation"))?;
    if res.rows_affected() == 0 { return Err(ApiError::not_found("店铺不存在")); }
    super::response_helpers::success_api_key(new_key, "API密钥更新成功")
}

pub async fn get_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Query(params): Query<HashMap<String, String>>,
) -> StandardApiResult<Vec<Shop>> {
    // 获取管理员信息
    let admin_info = get_admin_info(&state, &session.admin_id).await?;
    let all_flag = params.get("all").map(|v| v == "1" || v.eq_ignore_ascii_case("true" )).unwrap_or(false);
    let pending_only = params.get("pending_only").map(|v| v=="1" || v.eq_ignore_ascii_case("true")).unwrap_or(false);

    // 先查当前管理员邮箱（用于匹配员工表 email）
    let (admin_username, admin_email) = super::query_helpers::QueryHelpers::get_admin_info(&state.db, &session.admin_id).await?;

    // 1) 我拥有的店铺
    // super_admin 默认现在查看全部，除非 pending_only=1（兼容旧体验）；all=1 依旧无条件全部
    let owner_sql = if admin_info.role == UserRole::SuperAdmin {
        if pending_only { "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE status IN ('pending','rejected','inactive') ORDER BY created_at DESC" }
        else { "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops ORDER BY created_at DESC" }
    } else {
        "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE owner_id = ? ORDER BY created_at DESC"
    };

    let mut owner_q = sqlx::query(owner_sql);
    if admin_info.role != UserRole::SuperAdmin {
        owner_q = owner_q.bind(&session.admin_id);
    }
    let owner_rows = owner_q
        .fetch_all(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_list_error(e, "owner shops"))?;

    let mut shops: Vec<Shop> = owner_rows
        .iter()
        .map(|row| super::data_mappers::row_to_shop_owner(row))
        .collect();

    // 2) 我作为员工的店铺（基于 employees.email 匹配当前管理员邮箱）
    {
        let lower_email = admin_email.to_lowercase();
        let lower_username = admin_username.to_lowercase();
        // 用用户名的本地部分匹配邮箱前缀（username@*），当管理员没有配置 email 时也能匹配
        let email_like_from_username = InputValidators::generate_email_like_pattern(&admin_username.to_lowercase());
          let employee_rows = sqlx::query(
            "SELECT s.id, s.name, s.domain, s.api_key, s.owner_id, s.status, s.created_at \
             FROM shops s \
             JOIN employees e ON e.shop_id = s.id \
             LEFT JOIN users u ON u.id = e.user_id \
             WHERE e.status = 'active' AND ( \
                (e.email IS NOT NULL AND LOWER(e.email) = ?) OR \
                (e.email IS NOT NULL AND LOWER(e.email) LIKE ?) OR \
                (e.name IS NOT NULL AND LOWER(e.name) = ?) OR \
                (u.email IS NOT NULL AND LOWER(u.email) = ?) OR \
                (u.username IS NOT NULL AND LOWER(u.username) = ?) OR \
                (u.email IS NOT NULL AND LOWER(u.email) LIKE ?) \
             ) \
             ORDER BY s.created_at DESC"
        )
        // e.email = admin_email
        .bind(&lower_email)
        // e.email LIKE 'username@%'
        .bind(&email_like_from_username)
        // e.name = admin_username
        .bind(&lower_username)
        // u.email = admin_email
        .bind(&lower_email)
        // u.username = admin_username
        .bind(&lower_username)
        // u.email LIKE 'username@%'
        .bind(&email_like_from_username)
    .fetch_all(&state.db)
    .await
    .map_err(|e| super::errors::db_helpers::handle_employee_shops_error(e))?;

        // 去重：避免同时是 owner 和 employee 导致重复
        use std::collections::HashSet;
        let existing: HashSet<String> = shops.iter().map(|s| s.id.clone()).collect();

        for row in employee_rows.iter() {
            let id: String = row.get("id");
            if existing.contains(&id) { continue; }
            shops.push(super::data_mappers::row_to_shop_employee(row));
        }
    }

    LoggingHelpers::log_data_stats("get_shops", shops.len(), &session.admin_id);

    success(shops, "Shops retrieved successfully")
}

// GET /api/shops/debug  -> 调试端点：返回总数、当前可见、角色、过滤参数、采样
pub async fn debug_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<serde_json::Value> {
    // 统计总数
    let total = super::query_helpers::QueryHelpers::count_shops(&state.db).await?;

    // 获取管理员信息
    let admin_info = get_admin_info(&state, &session.admin_id).await?;
    let (admin_username, admin_email) = super::query_helpers::QueryHelpers::get_admin_info(&state.db, &session.admin_id).await?;
    let all_flag = params.get("all").map(|v| v=="1" || v.eq_ignore_ascii_case("true")).unwrap_or(false);
    let pending_only = params.get("pending_only").map(|v| v=="1" || v.eq_ignore_ascii_case("true")).unwrap_or(false);

    // owner shops
    let owner_sql = if admin_info.role == UserRole::SuperAdmin {
        if pending_only { "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE status IN ('pending','rejected','inactive') ORDER BY created_at DESC" } else { "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops ORDER BY created_at DESC" }
    } else { "SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE owner_id = ? ORDER BY created_at DESC" };
    let mut owner_q = sqlx::query(owner_sql);
    if admin_info.role != UserRole::SuperAdmin { owner_q = owner_q.bind(&session.admin_id); }
    let owner_rows = owner_q.fetch_all(&state.db).await.map_err(|e| super::errors::db_helpers::handle_list_error(e, "owner shops debug"))?;
    let mut shops: Vec<serde_json::Value> = owner_rows.iter().map(|r| serde_json::json!({
        "id": r.get::<String,_>("id"),
        "name": r.get::<String,_>("name"),
        "status": r.get::<String,_>("status"),
        "owner_id": r.try_get::<String,_>("owner_id").unwrap_or_else(|_|"legacy_data".into()),
        "membership": "owner"
    })).collect();

    // employee shops
    let lower_email = admin_email.to_lowercase();
    let lower_username = admin_username.to_lowercase();
    let email_like_from_username = InputValidators::generate_email_like_pattern(&admin_username.to_lowercase());
    let employee_rows = sqlx::query(
        "SELECT s.id, s.name, s.status, s.owner_id FROM shops s \n             JOIN employees e ON e.shop_id = s.id \n             LEFT JOIN users u ON u.id = e.user_id \n             WHERE e.status = 'active' AND ( \n                (e.email IS NOT NULL AND LOWER(e.email) = ?) OR \n                (e.email IS NOT NULL AND LOWER(e.email) LIKE ?) OR \n                (e.name IS NOT NULL AND LOWER(e.name) = ?) OR \n                (u.email IS NOT NULL AND LOWER(u.email) = ?) OR \n                (u.username IS NOT NULL AND LOWER(u.username) = ?) OR \n                (u.email IS NOT NULL AND LOWER(u.email) LIKE ?) \n             ) ORDER BY s.created_at DESC"
    )
        .bind(&lower_email)
        .bind(&email_like_from_username)
        .bind(&lower_username)
        .bind(&lower_email)
        .bind(&lower_username)
        .bind(&email_like_from_username)
        .fetch_all(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_employee_shops_error(e))?;
    use std::collections::HashSet;
    let existing: HashSet<String> = shops.iter().filter_map(|v| v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string())).collect();
    for r in employee_rows.iter() {
        let id: String = r.get("id");
        if existing.contains(&id) { continue; }
        shops.push(serde_json::json!({
            "id": id,
            "name": r.get::<String,_>("name"),
            "status": r.get::<String,_>("status"),
            "owner_id": r.try_get::<String,_>("owner_id").unwrap_or_else(|_|"legacy_data".into()),
            "membership": "employee"
        }));
    }

    let visible = shops.len() as i64;
    let sample: Vec<serde_json::Value> = shops.iter().take(5).cloned().collect();
    let debug = serde_json::json!({
        "timestamp": Utc::now().to_rfc3339(),
        "role": admin_info.role,
        "all_flag": all_flag,
        "pending_only": pending_only,
        "total": total,
        "visible": visible,
        "admin_id": session.admin_id,
        "admin_email": admin_email,
        "admin_username": admin_username,
        "sample": sample
    });
    success(debug, "debug ok")
}

// GET /api/shops/orphans  -> 超级管理员：列出 owner_id 无效的孤儿店铺
pub async fn list_orphan_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> ApiResult<serde_json::Value> {
    // 检查权限
    enforce_super_admin(&state, &session.admin_id).await?;

    let rows = sqlx::query("SELECT id, name, owner_id, status, created_at FROM shops WHERE owner_id = '' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_list_error(e, "orphan shops"))?;
    let data: Vec<serde_json::Value> = rows.iter().map(|r| serde_json::json!({
        "id": r.get::<String,_>("id"),
        "name": r.get::<String,_>("name"),
        "owner_id": r.try_get::<String,_>("owner_id").unwrap_or_default(),
        "status": r.get::<String,_>("status"),
        "created_at": r.get::<String,_>("created_at")
    })).collect();
    super::response_helpers::success_count(&data, "orphans", "orphans listed")
}

#[derive(serde::Deserialize)]
pub struct ReassignOwnerPayload {
    pub shop_ids: Vec<String>,
    pub new_owner_id: String,
    #[serde(default)] pub dry_run: bool,
}

// POST /api/shops/reassign-owner  -> 超级管理员：批量重指派店铺 owner；支持 dry_run
pub async fn reassign_shop_owner(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Json(payload): Json<ReassignOwnerPayload>,
) -> ApiResult<serde_json::Value> {
    InputValidators::validate_list_not_empty(&payload.shop_ids, "shop_ids")?;
    
    // 检查权限
    enforce_super_admin(&state, &session.admin_id).await?;

    // 验证 new_owner_id 是否存在
    let owner_exists = sqlx::query("SELECT 1 FROM admins WHERE id = ?")
        .bind(&payload.new_owner_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_fetch_error(e, "new owner verification"))?;
    if owner_exists.is_none() { 
        return Err(ApiError::not_found("new_owner_id 不存在")); 
    }

    // 查询目标店铺当前 owner
    let mut current: Vec<serde_json::Value> = Vec::new();
    for sid in &payload.shop_ids {
        if let Ok(row_opt) = sqlx::query("SELECT id, name, owner_id FROM shops WHERE id = ?")
            .bind(sid)
            .fetch_optional(&state.db)
            .await {
            if let Some(r) = row_opt { current.push(serde_json::json!({"id": r.get::<String,_>("id"), "name": r.get::<String,_>("name"), "owner_id": r.try_get::<String,_>("owner_id").unwrap_or_default()})); }
        }
    }

    let mut updated = Vec::new();
    if !payload.dry_run {
        for sid in &payload.shop_ids {
            let res = sqlx::query("UPDATE shops SET owner_id = ? WHERE id = ?")
                .bind(&payload.new_owner_id)
                .bind(sid)
                .execute(&state.db)
                .await;
            match res {
                Ok(r) => if r.rows_affected() > 0 { updated.push(sid.clone()); },
                Err(e) => { tracing::error!(error=%e, shop_id=%sid, "reassign failed"); }
            }
        }
    }

    let result = serde_json::json!({
        "dry_run": payload.dry_run,
        "requested_count": payload.shop_ids.len(),
        "updated_count": updated.len(),
        "updated_ids": updated,
        "current": current,
        "new_owner_id": payload.new_owner_id
    });
    success(result, if payload.dry_run { "dry-run ok" } else { "reassigned" })
}

pub async fn create_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Json(payload): Json<UpdateShopRequest>,
) -> ApiResult<Shop> {
    // 业务规则：任何已通过会话认证的管理员（包括 role = "user" 的普通账号）
    // 创建店铺时都会被设置为该店铺的 owner（owner_id = session.admin_id）。
    // 因此“是否店主”不取决于角色字段，而由 shops.owner_id 判定。
    let name = payload.name.clone().unwrap_or_else(|| "Unnamed Shop".to_string());
    let domain = payload.domain.clone().unwrap_or_else(|| "no-domain".to_string());
    let input = shop_uc::CreateShopInput { owner_id: session.admin_id.clone(), name, domain };
    match shop_uc::create_shop(&state.db, &*state.shop_repo, input).await {
        Ok((out, events)) => {
            // 发布事件（忽略发布错误以保证接口幂等）
            state.event_publisher.publish(events).await;
            let shop = super::data_mappers::create_shop_output_to_shop(
                &out,
                payload.name.unwrap_or("Unnamed Shop".into()),
                payload.domain.unwrap_or("no-domain".into()),
                session.admin_id
            );
            success(shop, "Shop created")
        }
        Err(e) => match e {
            shop_uc::ShopUseCaseError::DomainExists => Err(ApiError::conflict("域名已存在")),
            shop_uc::ShopUseCaseError::Domain(d) => Err(ApiError::bad_request(&d.to_string())),
            _ => Err(ApiError::internal("创建失败"))
        }
    }
}

pub async fn get_shop_details(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<Shop> {
    let row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db)
        .await;

    match row {
        Ok(row) => {
            let owner_id: String = row.try_get("owner_id").unwrap_or_else(|_| "legacy_data".to_string());
            if owner_id != session.admin_id {
                // 检查是否是超级管理员
                let admin_info = get_admin_info(&state, &session.admin_id).await?;
                if admin_info.role != UserRole::SuperAdmin {
                    return Err(ApiError::not_found("店铺不存在")); // 避免泄漏存在性
                }
            }

            let shop = super::data_mappers::row_to_shop_with_owner(&row, owner_id);
            success(shop, "Shop details retrieved")
        }
        Err(sqlx::Error::RowNotFound) => Err(ApiError::not_found("店铺不存在")),
        Err(e) => { Err(super::errors::db_helpers::handle_fetch_error(e, "shop details")) }
    }
}

pub async fn update_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
    Json(payload): Json<UpdateShopRequest>,
) -> ApiResult<Shop> {
    let input = shop_uc::UpdateShopInput { shop_id: id.clone(), actor_id: session.admin_id.clone(), name: payload.name.clone(), domain: payload.domain.clone() };
    match shop_uc::update_shop(&state.db, &*state.shop_repo, &*state.shop_permission, input).await {
        Ok(events) => {
            state.event_publisher.publish(events).await;
            let row = sqlx::query("SELECT id, name, domain, api_key, owner_id, status, created_at FROM shops WHERE id = ?")
                .bind(&id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| super::errors::db_helpers::handle_fetch_error(e, "updated shop reload"))?;
            let shop = super::data_mappers::row_to_shop(&row);
            success(shop, "Shop updated")
        }
        Err(e) => match e {
            shop_uc::ShopUseCaseError::NotFound => Err(ApiError::not_found("店铺不存在")),
            shop_uc::ShopUseCaseError::Forbidden => Err(ApiError::forbidden("无权限修改")),
            shop_uc::ShopUseCaseError::DomainExists => Err(ApiError::conflict("域名已存在")),
            shop_uc::ShopUseCaseError::NothingToUpdate => Err(ApiError::bad_request("没有需要更新的字段")),
            shop_uc::ShopUseCaseError::Domain(d) => Err(ApiError::bad_request(&d.to_string())),
            _ => Err(ApiError::internal("更新失败"))
        }
    }
}

pub async fn approve_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<()> {
    // 使用 use case，保持权限语义：暂允许 owner/self 或 super_admin（与用例内逻辑一致）
    match shop_uc::approve_shop(&state.db, &*state.shop_permission, &id, &session.admin_id).await {
        Ok(events) => { 
            state.event_publisher.publish(events).await; 
            success_empty("Shop status updated to approved") 
        },
        Err(e) => match e { 
            shop_uc::ShopUseCaseError::NotFound => Err(ApiError::not_found("店铺不存在")), 
            shop_uc::ShopUseCaseError::Forbidden => Err(ApiError::forbidden("无权限")), 
            shop_uc::ShopUseCaseError::Domain(_) => Err(ApiError::bad_request("状态非法")), 
            _ => Err(ApiError::internal("更新失败")) 
        }
    }
}

pub async fn reject_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<()> {
    match shop_uc::reject_shop(&state.db, &*state.shop_permission, &id, &session.admin_id).await {
        Ok(events) => { 
            state.event_publisher.publish(events).await; 
            success_empty("Shop status updated to rejected") 
        },
        Err(e) => match e { 
            shop_uc::ShopUseCaseError::NotFound => Err(ApiError::not_found("店铺不存在")), 
            shop_uc::ShopUseCaseError::Forbidden => Err(ApiError::forbidden("无权限")), 
            shop_uc::ShopUseCaseError::Domain(_) => Err(ApiError::bad_request("状态非法")), 
            _ => Err(ApiError::internal("更新失败")) 
        }
    }
}

pub async fn activate_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<()> {
    match shop_uc::activate_shop_usecase(&state.db, &*state.shop_permission, &id, &session.admin_id).await {
        Ok(events) => { 
            state.event_publisher.publish(events).await; 
            success_empty("Shop status updated to active") 
        },
        Err(e) => match e { 
            shop_uc::ShopUseCaseError::NotFound => Err(ApiError::not_found("店铺不存在")), 
            shop_uc::ShopUseCaseError::Forbidden => Err(ApiError::forbidden("无权限")), 
            shop_uc::ShopUseCaseError::Domain(_) => Err(ApiError::bad_request("状态非法")), 
            _ => Err(ApiError::internal("更新失败")) 
        }
    }
}

pub async fn deactivate_shop(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Path(id): Path<String>,
) -> ApiResult<()> {
    match shop_uc::deactivate_shop_usecase(&state.db, &*state.shop_permission, &id, &session.admin_id).await {
        Ok(events) => { 
            state.event_publisher.publish(events).await; 
            success_empty("Shop status updated to inactive") 
        },
        Err(e) => match e { 
            shop_uc::ShopUseCaseError::NotFound => Err(ApiError::not_found("店铺不存在")), 
            shop_uc::ShopUseCaseError::Forbidden => Err(ApiError::forbidden("无权限")), 
            shop_uc::ShopUseCaseError::Domain(_) => Err(ApiError::bad_request("状态非法")), 
            _ => Err(ApiError::internal("更新失败")) 
        }
    }
}


pub async fn create_shop_activation_order(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> ApiResult<serde_json::Value> {
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
            success(response, "Activation order created")
        }
        Err(e) => { Err(super::errors::db_helpers::handle_order_creation_error(e)) }
    }
}
