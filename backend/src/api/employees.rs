use axum::{
    extract::{State, Query, Path},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::types::*;
use crate::AppState;

#[derive(Deserialize)]
pub struct AddEmployeeRequest {
    pub email: String,
    pub role: String,
}

#[derive(Deserialize)]
pub struct UpdateEmployeeRequest {
    pub role: String,
}

#[derive(Deserialize)]
pub struct InviteEmployeeRequest {
    pub email: String,
    pub role: String,
    pub message: String,
}

// 员工管理
pub async fn get_employees(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<Employee>>>, StatusCode> {
    match sqlx::query("SELECT * FROM employees WHERE shop_id = ?")
        .bind(&shop_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let employees: Vec<Employee> = rows
                .iter()
                .map(|row| Employee {
                    id: row.get("id"),
                    shop_id: row.get("shop_id"),
                    name: row.get("name"),
                    email: row.get("email"),
                    role: row.get("role"),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                })
                .collect();
                
            info!("Retrieved {} employees for shop {}", employees.len(), shop_id);
            Ok(Json(ApiResponse {
                success: true,
                data: Some(employees),
                message: "Employees retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get employees: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn add_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<AddEmployeeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    let employee_id = Uuid::new_v4().to_string();
    match sqlx::query("INSERT INTO employees (id, shop_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&employee_id)
        .bind(&shop_id)
        .bind(&payload.email) // 暂用邮箱作为显示名
        .bind(&payload.email)
        .bind(&payload.role)
        .bind("active")
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Employee {} added to shop {}", payload.email, shop_id);
            Ok(Json(ApiResponse { success: true, data: Some(()), message: "Employee added successfully".into() }))
        }
        Err(e) => {
            warn!("Failed to add employee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn remove_employee(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("DELETE FROM employees WHERE id = ? AND shop_id = ?")
        .bind(&employee_id)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee {} removed from shop {}", employee_id, shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Employee removed successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to remove employee: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn update_employee_role(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
    Json(payload): Json<UpdateEmployeeRequest>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE employees SET role = ? WHERE id = ? AND shop_id = ?")
        .bind(&payload.role)
        .bind(&employee_id)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee {} role updated in shop {}", employee_id, shop_id);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Employee role updated successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to update employee role: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 新增员工邀请和管理功能

// 搜索用户
pub async fn search_users(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<User>>>, StatusCode> {
    let keyword = params.get("q").unwrap_or(&String::new()).clone();
    let exclude_shop_id = params.get("exclude_shop_id");

    if keyword.len() < 2 {
        return Ok(Json(ApiResponse {
            success: true,
            data: Some(vec![]),
            message: "Search keyword too short".to_string(),
        }));
    }

    let mut query = String::from("SELECT * FROM users WHERE (username LIKE ? OR email LIKE ? OR name LIKE ?) AND role != 'super_admin' AND role != 'admin' AND status = 'active'");
    let mut binds = vec![
        format!("%{}%", keyword),
        format!("%{}%", keyword),
        format!("%{}%", keyword),
    ];

    // 排除已经是某店铺员工的用户
    if let Some(shop_id) = exclude_shop_id {
        query.push_str(" AND id NOT IN (SELECT user_id FROM employees WHERE shop_id = ? AND status = 'active')");
        binds.push(shop_id.clone());
    }

    query.push_str(" LIMIT 10");

    let mut sqlx_query = sqlx::query(&query);
    for bind in &binds {
        sqlx_query = sqlx_query.bind(bind);
    }

    match sqlx_query.fetch_all(&state.db).await {
        Ok(rows) => {
            let users: Vec<User> = rows
                .iter()
                .map(|row| User {
                    id: row.get("id"),
                    username: row.get("username"),
                    email: row.get("email"),
                    name: row.get("name"),
                    phone: row.try_get("phone").ok(),
                    avatar: row.try_get("avatar").ok(),
                    role: row.get("role"),
                    status: row.get("status"),
                    created_at: row.get("created_at"),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(users),
                message: "Users retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to search users: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取用户资料
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> Result<Json<ApiResponse<User>>, StatusCode> {
    match sqlx::query("SELECT * FROM users WHERE id = ? AND status = 'active'")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let user = User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                name: row.get("name"),
                phone: row.try_get("phone").ok(),
                avatar: row.try_get("avatar").ok(),
                role: row.get("role"),
                status: row.get("status"),
                created_at: row.get("created_at"),
            };

            Ok(Json(ApiResponse {
                success: true,
                data: Some(user),
                message: "User profile retrieved successfully".to_string(),
            }))
        }
        Err(_) => {
            warn!("Failed to get user profile for user_id: {}", user_id);
            Err(StatusCode::NOT_FOUND)
        }
    }
}

// 邀请员工
pub async fn invite_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<InviteEmployeeRequest>,
) -> Result<Json<ApiResponse<EmployeeInvitation>>, StatusCode> {
    // 生成邀请令牌
    let invitation_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::days(7); // 7天后过期

    // 查找被邀请的用户ID（如果已注册）
    let invitee_id = sqlx::query("SELECT id FROM users WHERE email = ? AND status = 'active'")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .map(|row| row.get::<String, _>("id"));

    // 检查是否已经是员工或有待处理的邀请
    if let Some(uid) = &invitee_id {
        let existing = sqlx::query("SELECT COUNT(*) as count FROM employees WHERE shop_id = ? AND user_id = ? AND status IN ('active', 'pending')")
            .bind(&shop_id)
            .bind(uid)
            .fetch_one(&state.db)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        
        let count: i64 = existing.get("count");
        if count > 0 {
            return Err(StatusCode::CONFLICT); // 已经是员工或有待处理邀请
        }
    }

    // 创建邀请记录
    match sqlx::query("INSERT INTO employee_invitations (id, shop_id, inviter_id, invitee_email, invitee_id, role, message, token, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)")
        .bind(&invitation_id)
        .bind(&shop_id)
        .bind("shop_owner_001") // TODO: 从JWT或session获取实际的邀请人ID
        .bind(&payload.email)
        .bind(&invitee_id)
        .bind(&payload.role)
        .bind(&payload.message)
        .bind(&token)
        .bind(&expires_at)
        .bind(Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            let invitation = EmployeeInvitation {
                id: invitation_id,
                shop_id: shop_id.clone(),
                inviter_id: "shop_owner_001".to_string(),
                invitee_email: payload.email.clone(),
                invitee_id,
                role: payload.role.clone(),
                message: Some(payload.message.clone()),
                token: token.clone(),
                status: "pending".to_string(),
                expires_at,
                created_at: Utc::now(),
                responded_at: None,
            };

            info!("Employee invitation sent to {} for shop {}", payload.email, shop_id);
            
            // TODO: 发送邀请邮件
            
            Ok(Json(ApiResponse {
                success: true,
                data: Some(invitation),
                message: "Employee invitation sent successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to create employee invitation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取店铺的邀请列表
pub async fn get_employee_invitations(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> Result<Json<ApiResponse<Vec<EmployeeInvitation>>>, StatusCode> {
    match sqlx::query("SELECT * FROM employee_invitations WHERE shop_id = ? ORDER BY created_at DESC")
        .bind(&shop_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let invitations: Vec<EmployeeInvitation> = rows
                .iter()
                .map(|row| EmployeeInvitation {
                    id: row.get("id"),
                    shop_id: row.get("shop_id"),
                    inviter_id: row.get("inviter_id"),
                    invitee_email: row.get("invitee_email"),
                    invitee_id: row.try_get("invitee_id").ok(),
                    role: row.get("role"),
                    message: row.try_get("message").ok(),
                    token: row.get("token"),
                    status: row.get("status"),
                    expires_at: row.get("expires_at"),
                    created_at: row.get("created_at"),
                    responded_at: row.try_get("responded_at").ok(),
                })
                .collect();

            Ok(Json(ApiResponse {
                success: true,
                data: Some(invitations),
                message: "Employee invitations retrieved successfully".to_string(),
            }))
        }
        Err(e) => {
            warn!("Failed to get employee invitations: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 接受邀请
pub async fn accept_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<ApiResponse<Employee>>, StatusCode> {
    // 查找邀请
    let invitation = match sqlx::query("SELECT * FROM employee_invitations WHERE token = ? AND status = 'pending' AND expires_at > ?")
        .bind(&token)
        .bind(Utc::now())
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => EmployeeInvitation {
            id: row.get("id"),
            shop_id: row.get("shop_id"),
            inviter_id: row.get("inviter_id"),
            invitee_email: row.get("invitee_email"),
            invitee_id: row.try_get("invitee_id").ok(),
            role: row.get("role"),
            message: row.try_get("message").ok(),
            token: row.get("token"),
            status: row.get("status"),
            expires_at: row.get("expires_at"),
            created_at: row.get("created_at"),
            responded_at: row.try_get("responded_at").ok(),
        },
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    // 确保用户已注册
    let user_id = if let Some(uid) = invitation.invitee_id {
        uid
    } else {
        return Err(StatusCode::BAD_REQUEST); // 用户需要先注册
    };

    // 创建员工记录
    let employee_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // 开始事务
    let mut tx = state.db.begin().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 插入员工记录
    if let Err(_) = sqlx::query("INSERT INTO employees (id, shop_id, user_id, invited_by, role, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)")
        .bind(&employee_id)
        .bind(&invitation.shop_id)
        .bind(&user_id)
        .bind(&invitation.inviter_id)
        .bind(&invitation.role)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 更新邀请状态
    if let Err(_) = sqlx::query("UPDATE employee_invitations SET status = 'accepted', responded_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&invitation.id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 提交事务
    if tx.commit().await.is_err() {
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 获取用户信息构建Employee响应
    let user = sqlx::query("SELECT name, email FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let employee = Employee {
        id: employee_id,
        shop_id: invitation.shop_id.clone(),
        name: user.get("name"),
        email: user.get("email"),
        role: invitation.role.clone(),
        status: "active".to_string(),
        created_at: now,
    };

    info!("Employee invitation accepted: {} joined shop {}", invitation.invitee_email, invitation.shop_id);

    Ok(Json(ApiResponse {
        success: true,
        data: Some(employee),
        message: "Invitation accepted successfully".to_string(),
    }))
}

// 拒绝邀请
pub async fn reject_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<ApiResponse<()>>, StatusCode> {
    match sqlx::query("UPDATE employee_invitations SET status = 'rejected', responded_at = ? WHERE token = ? AND status = 'pending'")
        .bind(Utc::now())
        .bind(&token)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee invitation rejected: token {}", token);
                Ok(Json(ApiResponse {
                    success: true,
                    data: Some(()),
                    message: "Invitation rejected successfully".to_string(),
                }))
            } else {
                Err(StatusCode::NOT_FOUND)
            }
        }
        Err(e) => {
            warn!("Failed to reject invitation: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}
