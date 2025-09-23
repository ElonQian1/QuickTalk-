use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::Json as AxumJson,
};
use serde_json::json;
use sqlx::Row;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;

use crate::types::{AppState, ApiResponse};

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
    
    let result = json!({
        "fixed_count": fixed_shops.len(),
        "error_count": fix_errors.len(),
        "default_owner_id": default_owner_id,
        "fixed_shops": fixed_shops,
        "errors": fix_errors
    });
    
    info!("🎉 店铺所有者修复完成: 成功 {}, 失败 {}", fixed_shops.len(), fix_errors.len());
    
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
    
    let mut validation_errors = Vec::new();
    let mut validation_warnings = Vec::new();
    
    let orphaned_shops = sqlx::query("SELECT id, name, owner_id FROM shops WHERE owner_id = '' OR owner_id = 'default_owner' OR owner_id NOT IN (SELECT id FROM admins)")
        .fetch_all(&state.db)
        .await;
    
    match orphaned_shops {
        Ok(shops) => {
            if !shops.is_empty() {
                for shop in &shops {
                    let shop_name = shop.get::<String, _>("name");
                    let owner_id = shop.get::<String, _>("owner_id");
                    validation_errors.push(format!("店铺 '{}' 的所有者ID '{}' 无效或不存在", shop_name, owner_id));
                }
            }
        }
        Err(e) => {
            validation_errors.push(format!("查询孤立店铺时出错: {}", e));
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
                validation_warnings.push(format!("店铺名称 '{}' 重复 {} 次", name, count));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查重复店铺名称时出错: {}", e));
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
                validation_warnings.push(format!("店铺域名 '{}' 重复 {} 次", domain, count));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查重复域名时出错: {}", e));
        }
    }
    
    let admin_integrity = sqlx::query("SELECT id, username FROM admins WHERE username = '' OR username IS NULL")
        .fetch_all(&state.db)
        .await;
    
    match admin_integrity {
        Ok(invalid_admins) => {
            for admin in &invalid_admins {
                let admin_id = admin.get::<String, _>("id");
                validation_errors.push(format!("管理员账号 '{}' 缺少用户名", admin_id));
            }
        }
        Err(e) => {
            validation_errors.push(format!("检查管理员数据完整性时出错: {}", e));
        }
    }
    
    let validation_result = json!({
        "is_valid": validation_errors.is_empty(),
        "errors": validation_errors,
        "warnings": validation_warnings,
        "summary": {
            "error_count": validation_errors.len(),
            "warning_count": validation_warnings.len(),
            "status": if validation_errors.is_empty() { "通过" } else { "失败" }
        }
    });
    
    let status_msg = if validation_errors.is_empty() {
        "✅ 数据完整性验证通过"
    } else {
        "❌ 数据完整性验证失败"
    };
    
    info!("{}: {} 个错误, {} 个警告", status_msg, validation_errors.len(), validation_warnings.len());
    
    Ok(AxumJson(ApiResponse {
        success: validation_errors.is_empty(),
        data: Some(validation_result),
        message: format!("数据完整性验证完成: {} 个错误, {} 个警告", validation_errors.len(), validation_warnings.len()),
    }))
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
    
    let mut cleanup_results = Vec::new();
    let mut cleanup_errors = Vec::new();
    
    info!("🗑️ 删除其他管理员账号...");
    let delete_admins_result = sqlx::query("DELETE FROM admins WHERE id != ?")
        .bind(&keep_user_id)
        .execute(&state.db)
        .await;
    
    match delete_admins_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 删除了 {} 个其他管理员账号", deleted_count);
            cleanup_results.push(format!("删除了 {} 个其他管理员账号", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除管理员账号失败: {}", e);
            cleanup_errors.push(format!("删除管理员账号失败: {}", e));
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
            cleanup_results.push(format!("删除了 {} 个测试店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除店铺失败: {}", e);
            cleanup_errors.push(format!("删除店铺失败: {}", e));
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
            cleanup_results.push(format!("删除了 {} 个客户记录", deleted_count));
        }
        Err(e) => {
            error!("❌ 删除客户数据失败: {}", e);
            cleanup_errors.push(format!("删除客户数据失败: {}", e));
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
            cleanup_results.push(format!("删除了 {} 条消息和 {} 个对话", deleted_messages, deleted_conversations));
        }
        _ => {
            cleanup_errors.push("删除对话或消息数据时出错".to_string());
        }
    }
    
    info!("🗑️ 删除其他测试数据...");
    let _ = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    let _ = sqlx::query("DELETE FROM employees").execute(&state.db).await;
    
    cleanup_results.push("清理了激活订单和员工数据".to_string());
    
    let result = json!({
        "success": cleanup_errors.is_empty(),
        "kept_user": {
            "username": keep_username,
            "id": keep_user_id
        },
        "cleanup_results": cleanup_results,
        "errors": cleanup_errors,
        "summary": {
            "operations_count": cleanup_results.len(),
            "errors_count": cleanup_errors.len()
        }
    });
    
    let status_msg = if cleanup_errors.is_empty() {
        "🎉 测试数据清理完成"
    } else {
        "⚠️ 测试数据清理部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: cleanup_errors.is_empty(),
        data: Some(result),
        message: format!("测试数据清理完成，保留用户: {}", keep_username),
    }))
}

pub async fn force_clean_shops(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🧹 强制清理所有店铺数据");
    
    let mut cleanup_results = Vec::new();
    let mut cleanup_errors = Vec::new();
    
    let disable_fk_result = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk_result.is_err() {
        cleanup_errors.push("禁用外键约束失败".to_string());
    } else {
        cleanup_results.push("已禁用外键约束".to_string());
    }
    
    let delete_shops_result = sqlx::query("DELETE FROM shops").execute(&state.db).await;
    match delete_shops_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            info!("✅ 强制删除了 {} 个店铺", deleted_count);
            cleanup_results.push(format!("强制删除了 {} 个店铺", deleted_count));
        }
        Err(e) => {
            error!("❌ 强制删除店铺失败: {}", e);
            cleanup_errors.push(format!("强制删除店铺失败: {}", e));
        }
    }
    
    let delete_orders_result = sqlx::query("DELETE FROM activation_orders").execute(&state.db).await;
    match delete_orders_result {
        Ok(result) => {
            let deleted_count = result.rows_affected();
            cleanup_results.push(format!("删除了 {} 个激活订单", deleted_count));
        }
        Err(e) => {
            cleanup_errors.push(format!("删除激活订单失败: {}", e));
        }
    }
    
    let enable_fk_result = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk_result.is_err() {
        cleanup_errors.push("重新启用外键约束失败".to_string());
    } else {
        cleanup_results.push("已重新启用外键约束".to_string());
    }
    
    let result = json!({
        "success": cleanup_errors.is_empty(),
        "cleanup_results": cleanup_results,
        "errors": cleanup_errors,
        "summary": {
            "operations_count": cleanup_results.len(),
            "errors_count": cleanup_errors.len()
        }
    });
    
    let status_msg = if cleanup_errors.is_empty() {
        "🎉 店铺强制清理完成"
    } else {
        "⚠️ 店铺强制清理部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: cleanup_errors.is_empty(),
        data: Some(result),
        message: "店铺强制清理完成".to_string(),
    }))
}

pub async fn reset_database(
    State(state): State<Arc<AppState>>,
) -> Result<AxumJson<ApiResponse<serde_json::Value>>, StatusCode> {
    info!("🔄 执行数据库完全重置");
    
    let mut reset_results = Vec::new();
    let mut reset_errors = Vec::new();
    
    let disable_fk = sqlx::query("PRAGMA foreign_keys = OFF").execute(&state.db).await;
    if disable_fk.is_err() {
        reset_errors.push("禁用外键约束失败".to_string());
    }
    
    let tables = vec!["messages", "conversations", "customers", "employees", "activation_orders", "shops", "admins"];
    
    for table in &tables {
        let delete_result = sqlx::query(&format!("DELETE FROM {}", table)).execute(&state.db).await;
        match delete_result {
            Ok(result) => {
                let deleted_count = result.rows_affected();
                reset_results.push(format!("清空表 {}: {} 条记录", table, deleted_count));
                info!("✅ 清空表 {}: {} 条记录", table, deleted_count);
            }
            Err(e) => {
                reset_errors.push(format!("清空表 {} 失败: {}", table, e));
                error!("❌ 清空表 {} 失败: {}", table, e);
            }
        }
    }
    
    let enable_fk = sqlx::query("PRAGMA foreign_keys = ON").execute(&state.db).await;
    if enable_fk.is_err() {
        reset_errors.push("重新启用外键约束失败".to_string());
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
        "success": reset_errors.is_empty(),
        "reset_results": reset_results,
        "errors": reset_errors,
        "verification": verification,
        "summary": {
            "tables_processed": tables.len(),
            "errors_count": reset_errors.len()
        }
    });
    
    let status_msg = if reset_errors.is_empty() {
        "🎉 数据库完全重置成功"
    } else {
        "⚠️ 数据库重置部分完成，有错误"
    };
    
    info!("{}", status_msg);
    
    Ok(AxumJson(ApiResponse {
        success: reset_errors.is_empty(),
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
