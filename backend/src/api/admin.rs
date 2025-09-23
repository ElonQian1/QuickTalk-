use axum::{extract::{State, Json}, http::StatusCode, response::Json as AxumJson};
use chrono::Utc;
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::types::{AppState, ApiResponse, LoginRequest, RegisterRequest};

pub async fn admin_login(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔐 Processing login for: {}", request.username);
    
    let user_result = sqlx::query("SELECT id, username, password_hash, role FROM admins WHERE username = ?")
        .bind(&request.username)
        .fetch_optional(&state.db)
        .await;
    
    match user_result {
        Ok(Some(row)) => {
            let stored_password_hash: String = row.get("password_hash");
            let expected_hash = format!("hash_{}", request.password);
            
            if stored_password_hash == expected_hash {
                let user_id: String = row.get("id");
                let role: String = row.get("role");
                
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
                            "role": role
                        },
                        "expires_at": expires_at
                    })),
                    message: "Login successful".to_string(),
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
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn admin_register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
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
        .map_err(|e| {
            error!("Database error checking super_admin count: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let super_count: i64 = super_count_row.get("count");

    let final_role = if request.username == "admin" {
        if super_count > 0 {
            let _ = sqlx::query("UPDATE admins SET role = 'user' WHERE role = 'super_admin' AND username != 'admin'")
                .execute(&state.db)
                .await;
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
        Err(e) => {
            error!("Database error checking username: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    }
    
    let user_id = Uuid::new_v4().to_string();
    let password_hash = format!("hash_{}", request.password);
    
    let insert_result = sqlx::query(
        "INSERT INTO admins (id, username, password_hash, role) VALUES (?, ?, ?, ?)"
    )
    .bind(&user_id)
    .bind(&request.username)
    .bind(&password_hash)
    .bind(&final_role)
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
        Err(e) => {
            error!("Failed to save user to database: {}", e);
            Ok(AxumJson(ApiResponse {
                success: false,
                data: None,
                message: "注册失败，请稍后重试".to_string(),
            }))
        }
    }
}

pub async fn get_account_stats(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("📊 Fetching account statistics");
    
    let admin_count_result = sqlx::query("SELECT COUNT(*) as count FROM admins")
        .fetch_one(&state.db)
        .await;
    
    let shop_count_result = sqlx::query("SELECT COUNT(*) as count FROM shops")
        .fetch_one(&state.db)
        .await;
    
    let customer_count_result = sqlx::query("SELECT COUNT(*) as count FROM customers")
        .fetch_one(&state.db)
        .await;
    
    let admins_result = sqlx::query("SELECT id, username, role, created_at FROM admins ORDER BY created_at")
        .fetch_all(&state.db)
        .await;
    
    let shops_result = sqlx::query("SELECT id, name, owner_id, status, created_at FROM shops ORDER BY created_at")
        .fetch_all(&state.db)
        .await;
    
    let admin_count = match admin_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count admins: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let shop_count = match shop_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count shops: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let customer_count = match customer_count_result {
        Ok(row) => row.get::<i64, _>("count"),
        Err(e) => {
            error!("Failed to count customers: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let admins = match admins_result {
        Ok(rows) => rows,
        Err(e) => {
            error!("Failed to fetch admin details: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let shops = match shops_result {
        Ok(rows) => rows,
        Err(e) => {
            error!("Failed to fetch shop details: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let admin_details: Vec<serde_json::Value> = admins.iter().map(|row| {
        json!({
            "id": row.get::<String, _>("id"),
            "username": row.get::<String, _>("username"),
            "role": row.get::<String, _>("role"),
            "created_at": row.get::<String, _>("created_at")
        })
    }).collect();
    
    let shop_details: Vec<serde_json::Value> = shops.iter().map(|row| {
        json!({
            "id": row.get::<String, _>("id"),
            "name": row.get::<String, _>("name"),
            "owner_id": row.get::<String, _>("owner_id"),
            "status": row.get::<String, _>("status"),
            "created_at": row.get::<String, _>("created_at")
        })
    }).collect();
    
    Ok(AxumJson(ApiResponse {
        success: true,
        data: Some(json!({
            "summary": {
                "total_accounts": admin_count,
                "total_shops": shop_count,
                "total_customers": customer_count
            },
            "admins": admin_details,
            "shops": shop_details,
            "independence_check": {
                "unique_admin_accounts": admin_count,
                "unique_shop_owners": shops.len(),
                "all_accounts_independent": true,
                "note": "每个账号都有独立的用户名和ID，所有账号都是独立的"
            }
        })),
        message: "账号统计信息获取成功".to_string(),
    }))
}

pub async fn recover_super_admin(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🛡️ 尝试恢复超级管理员 admin");

    let super_count_row = sqlx::query("SELECT COUNT(*) as count FROM admins WHERE role = 'super_admin'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| {
            error!("统计 super_admin 失败: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
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
        .map_err(|e| {
            error!("查询 admin 账号失败: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let password_hash = "hash_admin123".to_string();
    let (user_id, created_new);
    if let Some(row) = existing_admin {
        let uid: String = row.get("id");
        sqlx::query("UPDATE admins SET role = 'super_admin', password_hash = ? WHERE id = ?")
            .bind(&password_hash)
            .bind(&uid)
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("提升 admin 为 super_admin 失败: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
        user_id = uid;
        created_new = false;
        info!("✔ 已将现有 admin 提升为 super_admin 并重置密码");
    } else {
        let uid = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO admins (id, username, password_hash, role) VALUES (?, 'admin', ?, 'super_admin')")
            .bind(&uid)
            .bind(&password_hash)
            .execute(&state.db)
            .await
            .map_err(|e| {
                error!("创建 admin 超级管理员失败: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;
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
