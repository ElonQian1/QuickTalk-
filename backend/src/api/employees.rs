use axum::{
    extract::{State, Query, Path},
    response::Json,
};
use sqlx::Row;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;
use chrono::Utc;

use crate::api::errors::{ApiResult, ApiError, success, success_empty};
use crate::api::input_validators::InputValidators;
use crate::types::dto::common::{EmployeeInvitation, User};
use crate::types::dto::employees::{AddEmployeeRequest, UpdateEmployeeRequest, InviteEmployeeRequest};
use crate::types::Employee;
use crate::bootstrap::app_state::AppState;


// 员工管理
pub async fn get_employees(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> ApiResult<Vec<Employee>> {
    match sqlx::query("SELECT * FROM employees WHERE shop_id = ?")
        .bind(&shop_id)
        .fetch_all(&state.db)
        .await
    {
        Ok(rows) => {
            let employees: Vec<Employee> = rows
                .iter()
                .map(|row| super::data_mappers::row_to_employee(row))
                .collect();
                
            info!("Retrieved {} employees for shop {}", employees.len(), shop_id);
            success(employees, "Employees retrieved successfully")
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_list_error(e))
        }
    }
}

pub async fn add_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<AddEmployeeRequest>,
) -> ApiResult<()> {
    let employee_id = Uuid::new_v4().to_string();
    // 统一从 email 提取本地部分作为显示名，便于与管理员用户名匹配（/api/shops 中有 e.name = admin_username 的匹配规则）
    let display_name = payload
        .email
        .split('@')
        .next()
        .unwrap_or(payload.email.as_str())
        .to_string();

    match sqlx::query("INSERT INTO employees (id, shop_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&employee_id)
        .bind(&shop_id)
        .bind(&display_name)
        .bind(&payload.email)
        .bind(&payload.role)
        .bind("active")
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Employee {} added to shop {}", payload.email, shop_id);
            success_empty("Employee added successfully")
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_add_error(e))
        }
    }
}

pub async fn remove_employee(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
) -> ApiResult<()> {
    match sqlx::query("DELETE FROM employees WHERE id = ? AND shop_id = ?")
        .bind(&employee_id)
        .bind(&shop_id)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee {} removed from shop {}", employee_id, shop_id);
                success_empty("Employee removed successfully")
            } else {
                Err(ApiError::NotFound("Employee not found".to_string()))
            }
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_remove_error(e))
        }
    }
}

pub async fn update_employee_role(
    State(state): State<Arc<AppState>>,
    Path((shop_id, employee_id)): Path<(String, String)>,
    Json(payload): Json<UpdateEmployeeRequest>,
) -> ApiResult<()> {
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
                success_empty("Employee role updated successfully")
            } else {
                Err(ApiError::NotFound("Employee not found".to_string()))
            }
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_role_update_error(e))
        }
    }
}

// 新增员工邀请和管理功能

// 搜索用户
pub async fn search_users(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Vec<User>> {
    let keyword = params.get("q").unwrap_or(&String::new()).clone();
    let exclude_shop_id = params.get("exclude_shop_id");

    InputValidators::validate_search_keyword(&keyword)?;

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

            success(users, "Users retrieved successfully")
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_user_search_error(e))
        }
    }
}

// 获取用户资料
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<String>,
) -> ApiResult<User> {
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

            success(user, "User profile retrieved successfully")
        }
        Err(_) => {
            warn!("Failed to get user profile for user_id: {}", user_id);
            Err(ApiError::not_found("User not found"))
        }
    }
}

// 邀请员工
pub async fn invite_employee(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Json(payload): Json<InviteEmployeeRequest>,
) -> ApiResult<EmployeeInvitation> {
    // 生成邀请令牌
    let invitation_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::days(7); // 7天后过期

    // 查找被邀请的用户ID（如果已注册）
    let invitee_id = sqlx::query("SELECT id FROM users WHERE email = ? AND status = 'active'")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_fetch_error(e, "invitee user"))?
        .map(|row| row.get::<String, _>("id"));

    // 检查是否已经是员工或有待处理的邀请
    if let Some(uid) = &invitee_id {
        let existing = sqlx::query("SELECT COUNT(*) as count FROM employees WHERE shop_id = ? AND user_id = ? AND status IN ('active', 'pending')")
            .bind(&shop_id)
            .bind(uid)
            .fetch_one(&state.db)
            .await
            .map_err(|e| super::errors::db_helpers::handle_fetch_error(e, "existing employee"))?;
        
        let count: i64 = existing.get("count");
        if count > 0 {
            return Err(ApiError::bad_request("User is already an employee or has pending invitation"));
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
            
            success(invitation, "Employee invitation sent successfully")
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_invitation_error(e))
        }
    }
}

// 获取店铺的邀请列表
pub async fn get_employee_invitations(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
) -> ApiResult<Vec<EmployeeInvitation>> {
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

            success(invitations, "Employee invitations retrieved successfully")
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_invitation_error(e))
        }
    }
}

// 接受邀请
pub async fn accept_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> ApiResult<Employee> {
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
        Err(_) => return Err(ApiError::not_found("Invitation not found or expired")),
    };

    // 确保用户已注册
    let user_id = if let Some(uid) = invitation.invitee_id {
        uid
    } else {
        return Err(ApiError::bad_request("User needs to register first"));
    };

    // 创建员工记录
    let employee_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // 开始事务
    let mut tx = state.db.begin().await.map_err(|e| super::errors::db_helpers::handle_transaction_error(e, "begin transaction"))?;

    // 插入员工记录
    if let Err(e) = sqlx::query("INSERT INTO employees (id, shop_id, user_id, invited_by, role, status, hired_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)")
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
        return Err(super::errors::db_helpers::handle_employee_add_error(e));
    }

    // 更新邀请状态
    if let Err(e) = sqlx::query("UPDATE employee_invitations SET status = 'accepted', responded_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&invitation.id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        return Err(super::errors::db_helpers::handle_employee_invitation_error(e));
    }

    // 提交事务
    if let Err(e) = tx.commit().await {
        return Err(super::errors::db_helpers::handle_transaction_error(e, "commit transaction"));
    }

    // 获取用户信息构建Employee响应
    let user = sqlx::query("SELECT name, email FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| super::errors::db_helpers::handle_fetch_error(e, "user information"))?;

    let employee = super::data_mappers::create_employee_from_invitation(
        employee_id,
        invitation.shop_id.clone(),
        user.get("name"),
        user.get("email"),
        invitation.role.clone(),
        now
    );

    info!("Employee invitation accepted: {} joined shop {}", invitation.invitee_email, invitation.shop_id);

    success(employee, "Invitation accepted successfully")
}

// 拒绝邀请
pub async fn reject_invitation(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> ApiResult<()> {
    match sqlx::query("UPDATE employee_invitations SET status = 'rejected', responded_at = ? WHERE token = ? AND status = 'pending'")
        .bind(Utc::now())
        .bind(&token)
        .execute(&state.db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                info!("Employee invitation rejected: token {}", token);
                success_empty("Invitation rejected successfully")
            } else {
                Err(ApiError::not_found("Invitation not found"))
            }
        }
        Err(e) => {
            Err(super::errors::db_helpers::handle_employee_invitation_error(e))
        }
    }
}
