use axum::{extract::{State, Json}, response::Json as AxumJson};
use chrono::Utc;
use serde_json::json;
use serde::Deserialize;
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::application::admin::update_profile::{update_profile as uc_update_profile, UpdateProfileInput, UpdateProfileError};
use crate::types::ApiResponse;
use crate::api::errors::ApiError;
use crate::types::dto::auth::{LoginRequest, RegisterRequest};
use argon2::{Argon2, password_hash::{PasswordHasher, PasswordVerifier, PasswordHash, SaltString}};
use rand::rngs::OsRng;
use crate::application::admin::change_password::{change_password as uc_change_password, ChangePasswordInput};

pub async fn admin_login(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    info!("🔐 Processing login for: {}", request.username);
    
    let user_result = sqlx::query("SELECT id, username, password_hash, role, email FROM admins WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(&state.db)
        .await;
    
    match user_result {
        Ok(Some(row)) => {
            let stored_password_hash: String = row.get("password_hash");
            let mut password_ok = false;
            let mut upgraded = false;

            // 兼容旧格式 hash_password
            if stored_password_hash.starts_with("hash_") {
                let expected_hash = format!("hash_{}", request.password);
                if stored_password_hash == expected_hash {
                    password_ok = true;
                    // 自动升级为 Argon2
                    let salt = SaltString::generate(&mut OsRng);
                    let argon2 = Argon2::default();
                    if let Ok(new_hash) = argon2.hash_password(request.password.as_bytes(), &salt) {
                        let _ = sqlx::query("UPDATE admins SET password_hash = ? WHERE username = ?")
                            .bind(new_hash.to_string())
                            .bind(&request.username)
                            .execute(&state.db)
                            .await;
                        upgraded = true;
                    }
                }
            } else {
                // Argon2 校验
                if let Ok(parsed) = PasswordHash::new(&stored_password_hash) {
                    if Argon2::default().verify_password(request.password.as_bytes(), &parsed).is_ok() {
                        password_ok = true;
                    }
                }
            }

            if password_ok {
                let user_id: String = row.get("id");
                let role: String = row.get("role");
                let email: Option<String> = row.try_get("email").ok();
                
                info!("✅ Login successful for: {} ({})", request.username, user_id);
                let session_id = Uuid::new_v4().to_string();
                let expires_at = Utc::now() + chrono::Duration::hours(24);
                let _ = sqlx::query(
                    "INSERT INTO sessions (session_id, admin_id, expires_at) VALUES (?, ?, ?)"
                )
                .bind(&session_id)
                .bind(&user_id)
                .bind(expires_at)
                .execute(&state.db)
                .await;

                Ok(AxumJson(ApiResponse {
                    success: true,
                    data: Some(json!({
                        "token": session_id,
                        "user": {
                            "id": user_id,
                            "username": request.username,
                            "role": role,
                            "email": email
                        },
                        "expires_at": expires_at
                    })),
                    message: if upgraded { "Login successful (password upgraded)".to_string() } else { "Login successful".to_string() },
                }))
            } else {
                info!("❌ Login failed for: {} - incorrect password", request.username);
                Ok(AxumJson(ApiResponse {
                    success: false,
                    data: None,
                    message: "用户名或密码错误".to_string(),
                }))
            }
        }
        Ok(None) => {
            info!("❌ Login failed for: {} - user not found", request.username);
            Ok(AxumJson(ApiResponse {
                success: false,
                data: None,
                message: "用户名或密码错误".to_string(),
            }))
        }
        Err(e) => {
            error!("Database error during login: {}", e);
            Err(ApiError::internal("登录失败: 数据库错误"))
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateAdminProfileRequest {
    pub email: Option<String>,
}

// 更新当前管理员资料（目前仅支持邮箱）
pub async fn admin_update_profile(
    State(state): State<Arc<AppState>>,
    crate::auth::SessionExtractor(session): crate::auth::SessionExtractor,
    Json(payload): Json<UpdateAdminProfileRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    let trimmed = payload.email.as_ref().map(|e| e.trim().to_string());
    let input = UpdateProfileInput { admin_id: session.admin_id.clone(), email: trimmed.filter(|s| !s.is_empty()) };
    match uc_update_profile(&*state.admin_repo, input).await {
        Ok(()) => Ok(AxumJson(ApiResponse { success: true, data: Some(json!({"updated": true})), message: "资料已更新".into() })),
        Err(e) => {
            let msg = match e {
                UpdateProfileError::EmailInvalid(_) => "邮箱格式不正确".to_string(),
                UpdateProfileError::Repo(_) => "服务器内部错误".to_string(),
            };
            Ok(AxumJson(ApiResponse { success: false, data: None, message: msg }))
        }
    }
}

pub async fn admin_register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    info!("🆕 Processing user registration for: {}", request.username);
    
    if request.username.is_empty() || request.email.is_empty() || request.password.is_empty() {
        return Ok(AxumJson(ApiResponse {
            success: false,
            data: None,
            message: "用户名、邮箱和密码不能为空".to_string(),
        }));
    }
    
    if request.password.len() < 6 {
        return Ok(AxumJson(ApiResponse {
            success: false,
            data: None,
            message: "密码至少需要6位".to_string(),
        }));
    }
    
    let super_count_row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| { error!("Database error checking super_admin count: {}", e); ApiError::internal("数据库错误") })?;
    let super_count: i64 = super_count_row.get("count");

    // 角色判定策略（严格模式）：
    // 1. 只有精确用户名 "admin" 可成为超级管理员
    // 2. 若系统已存在任意 super_admin，则禁止再次注册 "admin"（避免自动降级产生风险）
    // 3. 不做大小写等价匹配，防止绕过（"Admin" 只会成为普通用户）
    let final_role = if request.username == "admin" {
        if super_count > 0 {
            return Ok(AxumJson(ApiResponse {
                success: false,
                data: Some(json!({ "super_admin_exists": true })),
                message: "系统已存在超级管理员，不能重复注册 admin。若遗失权限请使用恢复接口 /api/admin/recover-super-admin".to_string(),
            }));
        }
        "super_admin".to_string()
    } else {
        "user".to_string()
    };
    let elevated_to_super = final_role == "super_admin";
    
    let existing_user = sqlx::query("SELECT username FROM admins WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(&state.db)
        .await;
        
    match existing_user {
        Ok(Some(_)) => {
            return Ok(AxumJson(ApiResponse {
                success: false,
                data: None,
                message: "用户名已存在".to_string(),
            }));
        }
        Ok(None) => {}
        Err(e) => { error!("Database error checking username: {}", e); return Err(ApiError::internal("数据库错误")); }
    }
    
    let user_id = Uuid::new_v4().to_string();
    // 使用 Argon2 生成安全密码哈希
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = match argon2.hash_password(request.password.as_bytes(), &salt) {
        Ok(ph) => ph.to_string(),
        Err(e) => {
            error!("密码哈希失败: {}", e);
            return Ok(AxumJson(ApiResponse { success: false, data: None, message: "服务器内部错误: HASH".to_string() }));
        }
    };
    
    let insert_result = sqlx::query(
        "INSERT INTO admins (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&user_id)
    .bind(&request.username)
    .bind(&password_hash)
    .bind(&final_role)
    .bind(&request.email)
    .execute(&state.db)
    .await;
    
    match insert_result {
        Ok(_) => {
            info!("✅ User registration successful for: {} ({})", request.username, user_id);
            
            Ok(AxumJson(ApiResponse {
                success: true,
                data: Some(json!({
                    "user": {
                        "id": user_id,
                        "username": request.username,
                        "email": request.email,
                        "role": final_role,
                        "created_at": Utc::now()
                    },
                    "elevated_to_super_admin": elevated_to_super
                })),
                message: if elevated_to_super { "注册成功：已自动设为超级管理员".to_string() } else { "注册成功".to_string() },
            }))
        }
        Err(e) => { error!("Failed to save user to database: {}", e); Ok(AxumJson(ApiResponse { success: false, data: None, message: "注册失败，请稍后重试".to_string() })) }
    }
}

pub async fn get_account_stats(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    info!("📊 Fetching account statistics (scoped)");
    // 查询当前用户角色
    let role_row = sqlx::query("SELECT role, username FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| { error!("role lookup failed: {}", e); ApiError::internal("查询角色失败") })?;
    let role: String = role_row.get("role");
    let username: String = role_row.get("username");

    if role == "super_admin" {
        // 原超级管理员全量视图
    let admin_count = sqlx::query("SELECT COUNT(*) as c FROM admins").fetch_one(&state.db).await.map_err(|e| { error!(?e, "count admins failed"); ApiError::internal("统计失败") })?.get::<i64,_>("c");
    let shop_count = sqlx::query("SELECT COUNT(*) as c FROM shops").fetch_one(&state.db).await.map_err(|e| { error!(?e, "count shops failed"); ApiError::internal("统计失败") })?.get::<i64,_>("c");
    let customer_count = sqlx::query("SELECT COUNT(*) as c FROM customers").fetch_one(&state.db).await.map_err(|e| { error!(?e, "count customers failed"); ApiError::internal("统计失败") })?.get::<i64,_>("c");
        let admins = sqlx::query("SELECT id, username, role, created_at FROM admins ORDER BY created_at")
            .fetch_all(&state.db).await.map_err(|e| { error!(?e, "list admins failed"); ApiError::internal("统计失败") })?;
        let shops = sqlx::query("SELECT id, name, owner_id, status, created_at FROM shops ORDER BY created_at")
            .fetch_all(&state.db).await.map_err(|e| { error!(?e, "list shops failed"); ApiError::internal("统计失败") })?;
        let admin_details: Vec<serde_json::Value> = admins.iter().map(|row| json!({
            "id": row.get::<String,_>("id"),
            "username": row.get::<String,_>("username"),
            "role": row.get::<String,_>("role"),
            "created_at": row.get::<String,_>("created_at")
        })).collect();
        let shop_details: Vec<serde_json::Value> = shops.iter().map(|row| json!({
            "id": row.get::<String,_>("id"),
            "name": row.get::<String,_>("name"),
            "owner_id": row.get::<String,_>("owner_id"),
            "status": row.get::<String,_>("status"),
            "created_at": row.get::<String,_>("created_at")
        })).collect();
        return Ok(AxumJson(ApiResponse { success: true, data: Some(json!({
            "summary": {"total_accounts": admin_count, "total_shops": shop_count, "total_customers": customer_count},
            "admins": admin_details,
            "shops": shop_details,
            "scope": "super_admin_full"
        })), message: "账号统计信息获取成功".into() }));
    }

    // 普通用户：仅返回自己账号 + 自己拥有的店铺数量（不暴露其它用户、其它店铺）
    let owned_shops = sqlx::query("SELECT id, name, status, created_at FROM shops WHERE owner_id = ? ORDER BY created_at DESC")
        .bind(&session.admin_id)
        .fetch_all(&state.db)
        .await
        .map_err(|e| { error!("fetch owned shops failed: {}", e); ApiError::internal("查询失败") })?;
    let shop_brief: Vec<serde_json::Value> = owned_shops.iter().map(|r| json!({
        "id": r.get::<String,_>("id"),
        "name": r.get::<String,_>("name"),
        "status": r.get::<String,_>("status"),
        "created_at": r.get::<String,_>("created_at")
    })).collect();
    let response = json!({
        "summary": {
            "account": { "id": session.admin_id, "username": username, "role": role },
            "owned_shop_count": shop_brief.len()
        },
        "owned_shops": shop_brief,
        "scope": "user_restricted"
    });
    Ok(AxumJson(ApiResponse { success: true, data: Some(response), message: "账号统计信息获取成功".into() }))
}

pub async fn recover_super_admin(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    info!("🛡️ 尝试恢复超级管理员 admin");

    let super_count_row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| { error!("统计 super_admin 失败: {}", e); ApiError::internal("统计失败") })?;
    let super_count: i64 = super_count_row.get("count");
    if super_count > 0 {
        return Ok(AxumJson(ApiResponse {
            success: false,
            data: Some(json!({ "super_admin_count": super_count })),
            message: "系统已存在超级管理员，出于安全原则拒绝恢复操作".to_string(),
        }));
    }

    let existing_admin = sqlx::query("SELECT id FROM admins WHERE username = 'admin'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| { error!("查询 admin 账号失败: {}", e); ApiError::internal("查询失败") })?;

    let password_hash = "hash_admin123".to_string();
    let (user_id, created_new);
    if let Some(row) = existing_admin {
        let uid: String = row.get("id");
        sqlx::query("UPDATE admins SET role = 'super_admin', password_hash = ?, email = COALESCE(email, 'admin@example.com') WHERE id = ?")
            .bind(&password_hash)
            .bind(&uid)
            .execute(&state.db)
            .await
            .map_err(|e| { error!("提升 admin 为 super_admin 失败: {}", e); ApiError::internal("操作失败") })?;
        user_id = uid;
        created_new = false;
        info!("✔ 已将现有 admin 提升为 super_admin 并重置密码");
    } else {
        let uid = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO admins (id, username, password_hash, role, email) VALUES (?, 'admin', ?, 'super_admin', 'admin@example.com')")
            .bind(&uid)
            .bind(&password_hash)
            .execute(&state.db)
            .await
            .map_err(|e| { error!("创建 admin 超级管理员失败: {}", e); ApiError::internal("创建失败") })?;
        user_id = uid;
        created_new = true;
        info!("✔ 已创建新的 admin 超级管理员");
    }

    Ok(AxumJson(ApiResponse {
        success: true,
        data: Some(json!({
            "user": {
                "id": user_id,
                "username": "admin",
                "role": "super_admin"
            },
            "password": "admin123",
            "created_new": created_new
        })),
        message: "admin 超级管理员恢复完成".to_string(),
    }))
}

// 注销当前会话：需要 SessionExtractor
use crate::auth::SessionExtractor;
pub async fn admin_logout(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    let _ = sqlx::query("DELETE FROM sessions WHERE session_id = ?")
        .bind(&session.session_id)
        .execute(&state.db)
        .await;
    Ok(AxumJson(ApiResponse { success: true, data: Some(json!({"logged_out": true })), message: "已退出登录".into() }))
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest { pub old_password: String, pub new_password: String }

// 修改当前登录管理员密码，需要有效会话
pub async fn admin_change_password(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    if req.new_password.len() < 6 {
        return Ok(AxumJson(ApiResponse { success: false, data: None, message: "新密码至少需要6位".into() }));
    }

    // 查询当前用户密码哈希
    let row_opt = sqlx::query("SELECT username, password_hash FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| { error!("查找管理员失败: {}", e); ApiError::internal("查询失败") })?;
    let row = if let Some(r) = row_opt { r } else {
        return Ok(AxumJson(ApiResponse { success: false, data: None, message: "用户不存在".into() }));
    };
    let username: String = row.get("username");
    let stored: String = row.get("password_hash");

    // 验证旧密码（兼容旧 hash_ 前缀）
    let mut old_ok = false;
    if stored.starts_with("hash_") {
        let expected = format!("hash_{}", req.old_password);
        old_ok = stored == expected;
    } else if let Ok(parsed) = PasswordHash::new(&stored) {
        old_ok = Argon2::default().verify_password(req.old_password.as_bytes(), &parsed).is_ok();
    }

    if !old_ok {
        return Ok(AxumJson(ApiResponse { success: false, data: None, message: "当前密码不正确".into() }));
    }

    // 生成新哈希并更新
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let new_hash = argon2
        .hash_password(req.new_password.as_bytes(), &salt)
    .map_err(|e| { error!("新密码哈希失败: {}", e); ApiError::internal("密码处理失败") })?
        .to_string();

    // 通过用例执行（包含失效会话）
    if let Err(e) = uc_change_password(&*state.admin_repo, ChangePasswordInput { admin_id: session.admin_id.clone(), new_hash: new_hash.clone() }).await {
        error!(?e, "用例更新密码失败");
        return Ok(AxumJson(ApiResponse { success: false, data: None, message: "更新密码失败".into() }));
    }
    info!("🔐 密码已更新并清理会话: {}", username);
    Ok(AxumJson(ApiResponse { success: true, data: Some(json!({ "require_relogin": true })), message: "密码已更新，请重新登录".into() }))
}

// 获取当前登录管理员信息（含邮箱）
pub async fn admin_me(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, ApiError> {
    let row = sqlx::query("SELECT id, username, role, email, created_at FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| { error!("查询当前管理员失败: {}", e); ApiError::internal("查询失败") })?;
    let id: String = row.get("id");
    let username: String = row.get("username");
    let role: String = row.get("role");
    let email: Option<String> = row.try_get("email").ok();
    let created_at: String = row.get("created_at");
    Ok(AxumJson(ApiResponse { success: true, data: Some(json!({
        "id": id,
        "username": username,
        "role": role,
        "email": email,
        "created_at": created_at
    })), message: "ok".into() }))
}
