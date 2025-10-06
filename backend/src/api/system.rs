use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::Json as AxumJson,
};
use serde_json::json;
use sqlx::Row;
use tracing::warn;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::bootstrap::app_state::AppState;
use crate::types::ApiResponse;
use crate::auth::SessionExtractor;
use crate::api::system_status_helpers::{OperationCollector, SystemStatusHelpers};

pub async fn fix_shop_owners(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔧 开始修复店铺所有者关联");
    
    let problematic_shops = sqlx::query("SELECT id, name, owner_id FROM shops WHERE owner_id = '' OR owner_id = 'default_owner' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await;
    
    let shops_to_fix = match problematic_shops {
        Ok(shops) => shops,
        Err(e) => {
            error!("查询问题店铺失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let default_admin = sqlx::query("SELECT id, username FROM admins WHERE role = 'owner' ORDER BY created_at LIMIT 1")
        .fetch_optional(&state.db)
        .await;
    
    let default_owner_id = match default_admin {
        Ok(Some(admin)) => {
            let admin_id = admin.get::<String, _>("id");
            let admin_username = admin.get::<String, _>("username");
            info!("🎯 使用默认管理员作为店铺所有者: {} ({})", admin_username, admin_id);
            admin_id
        }
        Ok(None) => {
            error!("❌ 没有找到任何owner角色的管理员");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
        Err(e) => {
            error!("查询默认管理员失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let mut fixed_shops = Vec::new();
    let mut fix_errors = Vec::new();
    
    for shop in &shops_to_fix {
        let shop_id = shop.get::<String, _>("id");
        let shop_name = shop.get::<String, _>("name");
        let old_owner_id = shop.get::<String, _>("owner_id");
        
        info!("🔄 修复店铺: {} (旧所有者: '{}')", shop_name, old_owner_id);
        
        let update_result = sqlx::query("UPDATE shops SET owner_id = ? WHERE id = ?")
            .bind(&default_owner_id)
            .bind(&shop_id)
            .execute(&state.db)
            .await;
        
        match update_result {
            Ok(_) => {
                info!("✅ 成功修复店铺: {}", shop_name);
                fixed_shops.push(json!({
                    "shop_id": shop_id,
                    "shop_name": shop_name,
                    "old_owner_id": old_owner_id,
                    "new_owner_id": default_owner_id
                }));
            }
            Err(e) => {
                error!("❌ 修复店铺 {} 失败: {}", shop_name, e);
                fix_errors.push(format!("店铺 {} 修复失败: {}", shop_name, e));
            }
        }
    }
    
    let result = SystemStatusHelpers::repair_result(
        &fixed_shops.iter().map(|s| s.get("shop_name").unwrap().as_str().unwrap().to_string()).collect::<Vec<_>>(),
        &fix_errors,
        "店铺所有者修复",
        Some(json!({"default_owner_id": default_owner_id, "fixed_shops": fixed_shops}))
    );
    
    let status_msg = SystemStatusHelpers::operation_status_message(
        fixed_shops.len(), 
        fix_errors.len(), 
        "店铺所有者修复"
    );
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: fix_errors.is_empty(),
        data: Some(result),
        message: format!("店铺所有者修复完成: 成功修复 {} 个店铺", fixed_shops.len()),
    }))
}

pub async fn validate_shop_data_integrity(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔍 开始验证店铺数据完整性");
    
    let mut collector = OperationCollector::new();
    
    let orphaned_shops = sqlx::query("SELECT id, name, owner_id FROM shops WHERE owner_id = '' OR owner_id = 'default_owner' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await;
    
    match orphaned_shops {
        Ok(shops) => {
            if !shops.is_empty() {
                for shop in &shops {
                    let shop_name = shop.get::<String, _>("name");
                    let owner_id = shop.get::<String, _>("owner_id");
                    collector.add_error(format!("店铺 '{}' 的所有者ID '{}' 无效或不存在", shop_name, owner_id));
                }
            }
        }
        Err(e) => {
            collector.add_error(format!("查询孤立店铺时出错: {}", e));
        }
    }
    
    let duplicate_names = sqlx::query("SELECT name, COUNT(*) as count FROM shops GROUP BY name HAVING count > 1")
        .fetch_all(&state.db)
        .await;
    
    match duplicate_names {
        Ok(duplicates) => {
            for duplicate in &duplicates {
                let name = duplicate.get::<String, _>("name");
                let count = duplicate.get::<i64, _>("count");
                collector.add_warning(format!("店铺名称 '{}' 重复 {} 次", name, count));
            }
        }
        Err(e) => {
            collector.add_error(format!("检查重复店铺名称时出错: {}", e));
        }
    }
    
    let duplicate_domains = sqlx::query("SELECT domain, COUNT(*) as count FROM shops WHERE domain != '' GROUP BY domain HAVING count > 1")
        .fetch_all(&state.db)
        .await;
    
    match duplicate_domains {
        Ok(duplicates) => {
            for duplicate in &duplicates {
                let domain = duplicate.get::<String, _>("domain");
                let count = duplicate.get::<i64, _>("count");
                collector.add_warning(format!("店铺域名 '{}' 重复 {} 次", domain, count));
            }
        }
        Err(e) => {
            collector.add_error(format!("检查重复域名时出错: {}", e));
        }
    }
    
    let admin_integrity = sqlx::query("SELECT id, username FROM admins WHERE username = '' OR username IS NULL")
        .fetch_all(&state.db)
        .await;
    
    match admin_integrity {
        Ok(invalid_admins) => {
            for admin in &invalid_admins {
                let admin_id = admin.get::<String, _>("id");
                collector.add_error(format!("管理员账号 '{}' 缺少用户名", admin_id));
            }
        }
        Err(e) => {
            collector.add_error(format!("检查管理员数据完整性时出错: {}", e));
        }
    }
    
    let validation_result = SystemStatusHelpers::validation_result(
        &collector.errors,
        &collector.warnings
    );
    
    let status_msg = collector.status_message(
        "✅ 数据完整性验证通过",
        "❌ 数据完整性验证失败"
    );
    
    info!("{}: {} 个错误, {} 个警告", status_msg, collector.errors.len(), collector.warnings.len());
    
    Ok(AxumJson(ApiResponse {
        success: collector.is_success(),
        data: Some(validation_result),
        message: format!("数据完整性验证完成: {} 个错误, {} 个警告", collector.errors.len(), collector.warnings.len()),
    }))
}

// DEBUG: 返回当前会话 admin_id 与角色
pub async fn whoami(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    let row = sqlx::query("SELECT username, role, created_at FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let username: String = row.get("username");
    let role: String = row.get("role");
    let created_at: String = row.get("created_at");
    Ok(AxumJson(ApiResponse { success: true, data: Some(json!({
        "admin_id": session.admin_id,
        "username": username,
        "role": role,
        "created_at": created_at
    })), message: "whoami".into() }))
}

// 诊断：检测可疑 owner 关联（店铺创建时间早于管理员创建时间）
pub async fn diagnose_owner_mismatch(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    // 仅超级管理员可运行
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = role_row.get("role");
    if role != "super_admin" { return Err(StatusCode::FORBIDDEN); }

    // 查询可疑店铺：owner 的创建时间比店铺创建时间晚
    let rows = sqlx::query(r#"
        SELECT s.id as shop_id, s.name as shop_name, s.created_at as shop_created_at,
               a.id as owner_id, a.username as owner_username, a.created_at as owner_created_at
        FROM shops s
        JOIN admins a ON s.owner_id = a.id
        WHERE datetime(a.created_at) > datetime(s.created_at)
        ORDER BY s.created_at
    "#).fetch_all(&state.db).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let suspicious: Vec<serde_json::Value> = rows.iter().map(|r| json!({
        "shop_id": r.get::<String,_>("shop_id"),
        "shop_name": r.get::<String,_>("shop_name"),
        "shop_created_at": r.get::<String,_>("shop_created_at"),
        "owner_id": r.get::<String,_>("owner_id"),
        "owner_username": r.get::<String,_>("owner_username"),
        "owner_created_at": r.get::<String,_>("owner_created_at")
    })).collect();

    Ok(AxumJson(ApiResponse { success: true, data: Some(json!({
        "suspicious_count": suspicious.len(),
        "suspicious": suspicious
    })), message: "diagnose completed".into() }))
}

pub async fn clean_test_data(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🧹 开始清理测试数据");
    
    let keep_username = request.get("keep_username")
        .and_then(|v| v.as_str())
        .unwrap_or("jiji");
    
    info!("🎯 将保留用户: {}", keep_username);
    
    let keep_user = sqlx::query("SELECT id, username, role FROM admins WHERE username = ?")
        .bind(keep_username)
        .fetch_optional(&state.db)
        .await;
    
    let keep_user_id = match keep_user {
        Ok(Some(user)) => {
            let user_id = user.get::<String, _>("id");
            let user_role = user.get::<String, _>("role");
            info!("✅ 找到要保留的用户: {} (ID: {}, 角色: {})", keep_username, user_id, user_role);
            user_id
        }
        Ok(None) => {
            error!("❌ 未找到用户: {}", keep_username);
            return Err(StatusCode::NOT_FOUND);
        }
        Err(e) => {
            error!("查询用户失败: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };
    
    let mut collector = OperationCollector::new();
    
    info!("🗑️ 删除其他管理员账号...");
    let delete_admins_result = sqlx::query("DELETE FROM admins WHERE id != ?")
        .bind(&keep_user_id)
        .execute(&state.db)
        .await;
    
    match delete_admins_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个其他管理员账号", deleted_count);
            collector.add_success(format!("删除了 {} 个其他管理员账号", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除管理员账号失败: {}", e);
            collector.add_error(format!("删除管理员账号失败: {}", e));
        }
    }
    
    info!("🗑️ 删除所有测试店铺...");
    let delete_shops_result = sqlx::query("DELETE FROM shops")
        .execute(&state.db)
        .await;
    
    match delete_shops_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个测试店铺", deleted_count);
            collector.add_success(format!("删除了 {} 个测试店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除店铺失败: {}", e);
            collector.add_error(format!("删除店铺失败: {}", e));
        }
    }
    
    info!("🗑️ 删除所有客户数据...");
    let delete_customers_result = sqlx::query("DELETE FROM customers")
        .execute(&state.db)
        .await;
    
    match delete_customers_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个客户记录", deleted_count);
            collector.add_success(format!("删除了 {} 个客户记录", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除客户数据失败: {}", e);
            collector.add_error(format!("删除客户数据失败: {}", e));
        }
    }
    
    info!("🗑️ 删除所有对话和消息...");
    let delete_messages_result = sqlx::query("DELETE FROM messages")
        .execute(&state.db)
        .await;
    
    let delete_conversations_result = sqlx::query("DELETE FROM conversations")
        .execute(&state.db)
        .await;
    
    match (delete_messages_result, delete_conversations_result) {
        (Ok(messages_result), Ok(conversations_result)) => {
            let deleted_messages = messages_result.rows_affected();
            let deleted_conversations = conversations_result.rows_affected();
            info!("✅ 删除了 {} 条消息和 {} 个对话", deleted_messages, deleted_conversations);
            collector.add_success(format!("删除了 {} 条消息和 {} 个对话", deleted_messages, deleted_conversations));
        }
        _ => {
            collector.add_error("删除对话或消息数据时出错".to_string());
        }
    }
    
    info!("🗑️ 删除其他测试数据...");
    let _ = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM employees").execute(&state.db).await;
    
    collector.add_success("清理了激活订单和员工数据".to_string());
    
    let extra_data = json!({
        "kept_user": {
            "username": keep_username,
            "id": keep_user_id
        }
    });
    
    let combined_data = json!({
        "success": collector.is_success(),
        "kept_user": extra_data["kept_user"],
        "cleanup_results": collector.successes,
        "errors": collector.errors,
        "summary": {
            "operations_count": collector.successes.len(),
            "errors_count": collector.errors.len()
        }
    });
    
    let status_msg = collector.status_message(
        "🎉 测试数据清理完成", 
        "⚠️ 测试数据清理部分完成，有错误"
    );
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: collector.is_success(),
        data: Some(combined_data),
        message: format!("测试数据清理完成，保留用户: {}", keep_username),
    }))
}

pub async fn force_clean_shops(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    // 仅超级管理员可以执行
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let role: String = role_row.get("role");
    if role != "super_admin" { return Err(StatusCode::FORBIDDEN); }
    info!("🧹 强制清理所有店铺数据");
    
    let mut collector = OperationCollector::new();
    
    let disable_fk_result = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk_result.is_err() {
        collector.add_error("禁用外键约束失败".to_string());
    } else {
        collector.add_success("已禁用外键约束".to_string());
    }
    
    let delete_shops_result = sqlx::query("DELETE FROM shops").execute(&state.db).await;
    match delete_shops_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 强制删除了 {} 个店铺", deleted_count);
            collector.add_success(format!("强制删除了 {} 个店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 强制删除店铺失败: {}", e);
            collector.add_error(format!("强制删除店铺失败: {}", e));
        }
    }
    
    let delete_orders_result = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    match delete_orders_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            collector.add_success(format!("删除了 {} 个激活订单", deleted_count));
        }
        Err(e) => {
            collector.add_error(format!("删除激活订单失败: {}", e));
        }
    }
    
    let enable_fk_result = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk_result.is_err() {
        collector.add_error("重新启用外键约束失败".to_string());
    } else {
        collector.add_success("已重新启用外键约束".to_string());
    }
    
    let result = json!({
        "success": collector.is_success(),
        "cleanup_results": collector.successes,
        "errors": collector.errors,
        "summary": {
            "operations_count": collector.successes.len(),
            "errors_count": collector.errors.len()
        }
    });
    
    let status_msg = collector.status_message(
        "🎉 店铺强制清理完成",
        "⚠️ 店铺强制清理部分完成，有错误"
    );
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: collector.is_success(),
        data: Some(result),
        message: "店铺强制清理完成".to_string(),
    }))
}

pub async fn reset_database(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔄 执行数据库完全重置");
    
    let mut collector = OperationCollector::new();
    
    let disable_fk = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk.is_err() {
        collector.add_error("禁用外键约束失败".to_string());
    }
    
    let tables = vec!["messages", "conversations", "customers", "employees", "activation_orders", "shops", "admins"];
    
    for table in &tables {
        let delete_result = sqlx::query(&format!("DELETE FROM {}", table)).execute(&state.db).await;
        match delete_result {
            Ok(result) => {
                let deleted_count = result.rows_affected();
                collector.add_success(format!("清空表 {}: {} 条记录", table, deleted_count));
                info!("✅ 清空表 {}: {} 条记录", table, deleted_count);
            }
            Err(e) => {
                collector.add_error(format!("清空表 {} 失败: {}", table, e));
                error!("❌ 清空表 {} 失败: {}", table, e);
            }
        }
    }
    
    let enable_fk = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk.is_err() {
        collector.add_error("重新启用外键约束失败".to_string());
    }
    
    let mut verification = Vec::new();
    for table in &tables {
        let count_result = sqlx::query(&format!("SELECT COUNT(*) as count FROM {}", table)).fetch_one(&state.db).await;
        match count_result {
            Ok(row) => {
                let count: i64 = row.get("count");
                verification.push(format!("{}: {} 条记录", table, count));
            }
            Err(_) => {
                verification.push(format!("{}: 查询失败", table));
            }
        }
    }
    
    let result = json!({
        "success": collector.is_success(),
        "reset_results": collector.successes,
        "errors": collector.errors,
        "verification": verification,
        "summary": {
            "tables_processed": tables.len(),
            "errors_count": collector.errors.len()
        }
    });
    
    let status_msg = collector.status_message(
        "🎉 数据库完全重置成功",
        "⚠️ 数据库重置部分完成，有错误"
    );
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: collector.is_success(),
        data: Some(result),
        message: "数据库完全重置完成".to_string(),
    }))
}

pub async fn create_test_user(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    let user_id = Uuid::new_v4().to_string();
    let username = "testuser";
    let email = "test@example.com";
    let password_hash = "hash_testuser";
    
    info!("🔧 创建测试用户: {} (ID: {})", username, user_id);
    
    let result = sqlx::query(
        "INSERT INTO admins (id, username, email, password_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
    )
    .bind(&user_id)
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .execute(&state.db)
    .await;
    
    match result {
        Ok(_) => {
            info!("✅ 测试用户创建成功: {}", user_id);
            
            let response_data = json!({
                "user_id": user_id,
                "username": username,
                "email": email,
                "token": user_id,
                "message": "测试用户创建成功，可以直接使用此token创建店铺"
            });
            
            Ok(AxumJson(ApiResponse {
                success: true,
                data: Some(response_data),
                message: "测试用户创建成功".to_string(),
            }))
        }
        Err(e) => {
            error!("❌ 创建测试用户失败: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 系统状态摘要：用于首页空态判断 / 首次真实旅程校验
// 提供各核心表计数与 first_run / has_super_admin 等标识
pub async fn state_summary(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    use sqlx::Row;
    // 采用单条聚合查询，减少往返；若未来表增加，可扩展
    let query = r#"
        SELECT
            (SELECT COUNT(*) FROM shops)            AS shops,
            (SELECT COUNT(*) FROM conversations)    AS conversations,
            (SELECT COUNT(*) FROM messages)         AS messages,
            (SELECT COUNT(*) FROM customers)        AS customers,
            (SELECT COUNT(*) FROM employees)        AS employees,
            (SELECT COUNT(*) FROM admins)           AS admins,
            (SELECT COUNT(*) FROM activation_orders) AS activation_orders,
            (SELECT COUNT(*) FROM sessions)         AS sessions
    "#; // sessions/activation_orders 可辅助判断是否已有真实交互
    // 若 activation_orders / sessions 等表尚未创建，完整查询会报错，这里加一次回退：
    // 回退时直接省略缺表列并以 0 代替，避免 500 影响首次体验。
    let (shops, conversations, messages, customers, employees, admins, activation_orders, sessions): (i64,i64,i64,i64,i64,i64,i64,i64) = match sqlx::query(query).fetch_one(&state.db).await {
        Ok(row) => (
            row.get::<i64,_>("shops"),
            row.get::<i64,_>("conversations"),
            row.get::<i64,_>("messages"),
            row.get::<i64,_>("customers"),
            row.get::<i64,_>("employees"),
            row.get::<i64,_>("admins"),
            row.get::<i64,_>("activation_orders"),
            row.get::<i64,_>("sessions")
        ),
        Err(e) => {
            warn!("state_summary 完整查询失败，采用回退查询: {e}");
            let fallback = r#"
                SELECT
                    (SELECT COUNT(*) FROM shops)         AS shops,
                    (SELECT COUNT(*) FROM conversations) AS conversations,
                    (SELECT COUNT(*) FROM messages)      AS messages,
                    (SELECT COUNT(*) FROM customers)     AS customers,
                    (SELECT COUNT(*) FROM employees)     AS employees,
                    (SELECT COUNT(*) FROM admins)        AS admins
            "#;
            match sqlx::query(fallback).fetch_one(&state.db).await {
                Ok(r2) => (
                    r2.get("shops"),
                    r2.get("conversations"),
                    r2.get("messages"),
                    r2.get("customers"),
                    r2.get("employees"),
                    r2.get("admins"),
                    0_i64, // activation_orders 缺表
                    0_i64  // sessions 缺表
                ),
                Err(e2) => {
                    error!("state_summary 回退查询仍失败，将返回空统计: {e2}");
                    (0,0,0,0,0,0,0,0)
                }
            }
        }
    };

    // 逻辑判定
    let first_run = shops == 0 && conversations == 0 && messages == 0 && customers == 0 && employees == 0;
    let has_super_admin = admins > 0; // 系统应至少保留一个超级管理员

    let mut recommended_actions = Vec::new();
    if !has_super_admin { recommended_actions.push("recover-super-admin"); }
    if shops == 0 { recommended_actions.push("create-first-shop"); }
    if shops > 0 && employees == 0 { recommended_actions.push("invite-employees"); }
    if shops > 0 && activation_orders == 0 { recommended_actions.push("create-activation-order"); }
    if conversations == 0 { recommended_actions.push("initiate-first-conversation"); }

    let summary = json!({
        "counts": {
            "shops": shops,
            "conversations": conversations,
            "messages": messages,
            "customers": customers,
            "employees": employees,
            "admins": admins,
            "activation_orders": activation_orders,
            "sessions": sessions
        },
        "flags": {
            "first_run": first_run,
            "has_super_admin": has_super_admin,
        },
        "recommended_actions": recommended_actions
    });

    Ok(AxumJson(ApiResponse {
        success: true,
        data: Some(summary),
        message: "系统状态摘要获取成功".to_string(),
    }))
}
