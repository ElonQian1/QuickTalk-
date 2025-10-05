use axum::{extract::{Query, State}, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use std::sync::Arc;
use sqlx::Row;

use crate::bootstrap::app_state::AppState;
use crate::db::workbench_read_model_sqlx::WorkbenchReadModelSqlx;
use crate::auth::SessionExtractor;

#[derive(Debug, Deserialize)]
pub struct SummaryParams {
    pub shop_id: Option<String>,
    pub days: Option<i64>,
}

pub async fn get_workbench_summary(
    State(state): State<Arc<AppState>>,
    SessionExtractor(session): SessionExtractor,
    Query(params): Query<SummaryParams>,
) -> impl IntoResponse {
    let reader = WorkbenchReadModelSqlx { pool: state.db.clone() };
    let days = params.days.unwrap_or(7);
    
    // 获取管理员权限和关联店铺
    let admin_row = match sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(&session.admin_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => row,
        Err(_) => return (StatusCode::FORBIDDEN, Json(serde_json::json!({
            "success": false,
            "error": "无效的管理员账户"
        }))).into_response(),
    };
    
    let role: String = admin_row.get("role");
    
    // 确定查询范围：super_admin 可以查看所有数据，普通管理员只能查看自己的店铺
    let effective_shop_id = if role == "super_admin" {
        params.shop_id
    } else {
        // 对于普通管理员，需要验证他们是否有权限访问指定店铺
        if let Some(requested_shop_id) = &params.shop_id {
            // 验证管理员是否拥有或有权限访问该店铺
            let has_access = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM shops WHERE id = ? AND (owner_id = ? OR id IN (
                    SELECT shop_id FROM employees WHERE status = 'active' AND user_id IN (
                        SELECT id FROM users WHERE email = (SELECT email FROM admins WHERE id = ?)
                    )
                ))"
            )
            .bind(requested_shop_id)
            .bind(&session.admin_id)
            .bind(&session.admin_id)
            .fetch_one(&state.db)
            .await
            .unwrap_or(0);
            
            if has_access > 0 {
                params.shop_id
            } else {
                return (StatusCode::FORBIDDEN, Json(serde_json::json!({
                    "success": false,
                    "error": "无权限访问指定店铺的数据"
                }))).into_response();
            }
        } else {
            // 如果没有指定shop_id，返回管理员所有可访问店铺的汇总数据
            None
        }
    };
    
    match reader.summary(effective_shop_id.as_deref(), days).await {
        Ok(summary) => (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "data": summary
        }))).into_response(),
        Err(e) => {
            tracing::error!(error=%e, "工作台数据查询失败");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "success": false,
                "error": "加载工作台数据失败，请稍后重试"
            }))).into_response()
        }
    }
}
