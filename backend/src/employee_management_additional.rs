// 员工管理API的其余函数 - 这些函数需要添加到main.rs中

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