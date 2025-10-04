use std::sync::Arc;

use axum::{extract::{State}, Json as AxumJson, http::StatusCode};
use serde::{Serialize, Deserialize};
use sqlx::Row;
use tracing::error;

use crate::{bootstrap::app_state::AppState, types::ApiResponse, auth::SessionExtractor};
use crate::api::errors::ApiError;

// ============ DTO ============
#[derive(Debug, Serialize)]
pub struct UserProfileDto {
    pub id: String,
    pub username: String,
    pub role: String,
    pub email: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserProfileRequest {
    pub name: Option<String>,      // 前端叫 name，这里映射到 username（仅演示，可限制禁止修改）
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNotificationSettingsRequest {
    #[serde(rename = "newMessage")] pub new_message: Option<bool>,
    #[serde(rename = "employeeJoined")] pub employee_joined: Option<bool>,
    #[serde(rename = "shopUpdated")] pub shop_updated: Option<bool>,
    #[serde(rename = "systemNotice")] pub system_notice: Option<bool>,
}

#[derive(Debug, Serialize, Default, Clone)]
pub struct NotificationSettingsDto {
    #[serde(rename = "newMessage")] pub new_message: bool,
    #[serde(rename = "employeeJoined")] pub employee_joined: bool,
    #[serde(rename = "shopUpdated")] pub shop_updated: bool,
    #[serde(rename = "systemNotice")] pub system_notice: bool,
}

// ============ 核心接口 ============

// GET /api/user/profile  (兼容前端 profile-manager.js 期望字段 user.* 或直接扁平)
pub async fn get_current_user_profile(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    let row = sqlx::query("SELECT id, username, role, email, created_at FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| { error!(error=%e, "load user profile failed"); ApiError::internal("db error") })?;

    let id: String = row.get("id");
    let username: String = row.get("username");
    let role: String = row.get("role");
    let email: Option<String> = row.try_get("email").ok();
    let created_at: String = row.get("created_at");

    // 兼容：前端代码 data.user 或 data.* 均可
    Ok(AxumJson(ApiResponse { success: true, data: Some(serde_json::json!({
        "user": {
            "id": id,
            "name": username,          // profile-manager.js 期望 name 字段
            "username": username,
            "role": role,
            "email": email,
            "created_at": created_at
        }
    })), message: "ok".into() }))
}

// PUT /api/user/profile  （当前仅允许更新 email；name/username 出于安全暂不修改）
pub async fn update_user_profile(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    AxumJson(body): AxumJson<UpdateUserProfileRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    if let Some(ref email) = body.email {
        if email.trim().is_empty() { return Err(ApiError::bad_request("邮箱不能为空")); }
        if !email.contains('@') { return Err(ApiError::bad_request("邮箱格式不正确")); }
    }

    let email_to_set = body.email.as_deref().map(|s| s.trim()).unwrap_or("");
    let affected = sqlx::query("UPDATE admins SET email = ? WHERE id = ?")
        .bind(if email_to_set.is_empty() { None::<String> } else { Some(email_to_set.to_string()) })
        .bind(&session.admin_id)
        .execute(&state.db)
        .await
        .map_err(|e| { error!(error=%e, "update user profile failed"); ApiError::internal("db error") })?
        .rows_affected();

    if affected == 0 { return Err(ApiError::not_found("用户不存在")); }
    Ok(AxumJson(ApiResponse { success: true, data: Some(serde_json::json!({"updated": true})), message: "资料已更新".into() }))
}

// POST /api/user/change-password -> 复用 admin_change_password (保持前端路径兼容)
pub async fn change_password_proxy(
    State(state): State<Arc<AppState>>,
    session: SessionExtractor,
    body: AxumJson<crate::api::admin::ChangePasswordRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    crate::api::admin::admin_change_password(State(state), session, body).await
}

// ========== 通知设置（临时, 存 sessions 期间内存返回; 可后续落库） ==========
// 目前没有 dedicated 表，为降低迁移成本，直接返回默认值，更新时写入 volatile map（TODO: persist）。
// 若要持久化，可新增表 admin_notification_settings(admin_id, new_message INTEGER, ...)。

use once_cell::sync::Lazy;
use std::{collections::HashMap};
use tokio::sync::RwLock;
use std::time::{Instant};

// 二级缓存结构：目前仅存储值与加载时间（未来可加 TTL 逻辑）
type CachedSettings = (NotificationSettingsDto, Instant);
static NOTIFICATION_CACHE: Lazy<RwLock<HashMap<String, CachedSettings>>> = Lazy::new(|| RwLock::new(HashMap::new()));

// GET /api/user/notification-settings
pub async fn get_notification_settings(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<NotificationSettingsDto>>, ApiError> {
    // 1. 先查缓存
    if let Some((dto, _loaded_at)) = NOTIFICATION_CACHE.read().await.get(&session.admin_id).cloned() {
        return Ok(AxumJson(ApiResponse { success: true, data: Some(dto), message: "ok".into() }));
    }

    // 2. 缓存 miss -> 访问数据库
    let repo = &state.notification_repo;
    let dto = match repo.get(&session.admin_id).await {
        Ok(Some(model)) => NotificationSettingsDto {
            new_message: model.new_message,
            employee_joined: model.employee_joined,
            shop_updated: model.shop_updated,
            system_notice: model.system_notice,
        },
        Ok(None) => NotificationSettingsDto::default(), // 默认值（全部 false）
        Err(e) => {
            error!(error=%e, "load notification settings failed");
            return Err(ApiError::internal("加载通知设置失败"));
        }
    };

    // 3. 写入缓存
    NOTIFICATION_CACHE.write().await.insert(session.admin_id.clone(), (dto.clone(), Instant::now()));

    Ok(AxumJson(ApiResponse { success: true, data: Some(dto), message: "ok".into() }))
}

// PUT /api/user/notification-settings
pub async fn update_notification_settings(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    AxumJson(body): AxumJson<UpdateNotificationSettingsRequest>,
) -> Result<AxumJson<ApiResponse<NotificationSettingsDto>>, ApiError> {
    // 1. 取当前（缓存或 DB）作为基线
    let current = {
        if let Some((dto, _)) = NOTIFICATION_CACHE.read().await.get(&session.admin_id).cloned() {
            dto
        } else {
            match state.notification_repo.get(&session.admin_id).await {
                Ok(Some(model)) => NotificationSettingsDto {
                    new_message: model.new_message,
                    employee_joined: model.employee_joined,
                    shop_updated: model.shop_updated,
                    system_notice: model.system_notice,
                },
                Ok(None) => NotificationSettingsDto::default(),
                Err(e) => { error!(error=%e, "load notification settings failed before update"); return Err(ApiError::internal("加载通知设置失败")); }
            }
        }
    };

    // 2. 应用增量
    let mut updated = current.clone();
    if let Some(v) = body.new_message { updated.new_message = v; }
    if let Some(v) = body.employee_joined { updated.employee_joined = v; }
    if let Some(v) = body.shop_updated { updated.shop_updated = v; }
    if let Some(v) = body.system_notice { updated.system_notice = v; }

    // 3. 写 DB (upsert)
    use crate::db::notification_settings_repository_sqlx::NotificationSettings;
    let model = NotificationSettings {
        admin_id: session.admin_id.clone(),
        new_message: updated.new_message,
        employee_joined: updated.employee_joined,
        shop_updated: updated.shop_updated,
        system_notice: updated.system_notice,
        updated_at: "".into(), // upsert 中会替换更新时间
    };
    if let Err(e) = state.notification_repo.upsert(&model).await {
        error!(error=%e, "persist notification settings failed");
        return Err(ApiError::internal("保存通知设置失败"));
    }

    // 4. 刷新缓存
    NOTIFICATION_CACHE.write().await.insert(session.admin_id.clone(), (updated.clone(), Instant::now()));

    Ok(AxumJson(ApiResponse { success: true, data: Some(updated), message: "settings updated".into() }))
}

// GET /api/dashboard/stats  -> 兼容前端旧路径，代理 workbench summary (days=1)
pub async fn dashboard_stats(
    State(state): State<Arc<AppState>>,
    SessionExtractor(_session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    // 调用 existing workbench summary 逻辑
    let reader = crate::db::workbench_read_model_sqlx::WorkbenchReadModelSqlx { pool: state.db.clone() };
    match reader.summary(None, 1).await {
        Ok(summary) => {
            // 提取今日消息数
            let today = summary.totals.messages_today;
            Ok(AxumJson(ApiResponse { success: true, data: Some(serde_json::json!({
                "totalShops": extract_shop_count(&state.db).await.unwrap_or(0),
                "todayMessages": today,
            })), message: "ok".into() }))
        }
        Err(e) => {
            error!(error=%e, "dashboard stats failed");
            Ok(AxumJson(ApiResponse { success: false, data: None, message: "统计加载失败".into() }))
        }
    }
}

async fn extract_shop_count(pool: &sqlx::SqlitePool) -> Result<i64, sqlx::Error> {
    let row = sqlx::query("SELECT COUNT(*) as c FROM shops")
        .fetch_one(pool)
        .await?;
    Ok(row.get::<i64,_>("c"))
}
