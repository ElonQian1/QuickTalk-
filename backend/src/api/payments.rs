use axum::{extract::{State, Json, Path}, http::StatusCode, response::Json as AxumJson};
use chrono::Utc;
use sqlx::Row;
use std::sync::Arc;
use tracing::{info, error};

use crate::types::{AppState, ApiResponse, ActivationPaymentRequest, ActivationQRResponse, ActivationOrderStatusResponse, ActivationOrder};

pub async fn generate_activation_payment_qr(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
    Json(payload): Json<ActivationPaymentRequest>,
) -> Result<AxumJson<ApiResponse<ActivationQRResponse>>, StatusCode> {
    // 验证订单是否存在且状态为pending
    let order = match sqlx::query("SELECT * FROM activation_orders WHERE id = ? AND status = 'pending'")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => ActivationOrder {
            id: row.get("id"),
            shop_id: row.get("shop_id"),
            order_number: row.get("order_number"),
            amount: row.get("amount"),
            currency: row.get("currency"),
            status: row.get("status"),
            payment_method: row.try_get("payment_method").ok(),
            qr_code_url: row.try_get("qr_code_url").ok(),
            expires_at: row.get("expires_at"),
            paid_at: row.try_get("paid_at").ok(),
            created_at: row.get("created_at"),
        },
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    // 检查订单是否过期
    if order.expires_at < Utc::now() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 生成支付二维码（此处可根据实际业务替换为真实生成逻辑）
    let qr_code_url = format!("https://pay.example.com/qr/{}", order.order_number);

    // 更新订单的支付方式和二维码
    match sqlx::query("UPDATE activation_orders SET payment_method = ?, qr_code_url = ? WHERE id = ?")
        .bind(&payload.payment_method)
        .bind(&qr_code_url)
        .bind(&order_id)
        .execute(&state.db)
        .await
    {
        Ok(_) => {
            info!("Generated QR code for activation order {}", order_id);
            Ok(AxumJson(ApiResponse {
                success: true,
                data: Some(ActivationQRResponse {
                    order_id: order_id.clone(),
                    qr_code_url: qr_code_url.clone(),
                    amount: order.amount,
                    payment_method: payload.payment_method,
                }),
                message: "QR code generated successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Failed to update activation order: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_activation_order_status(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<AxumJson<ApiResponse<ActivationOrderStatusResponse>>, StatusCode> {
    match sqlx::query("SELECT * FROM activation_orders WHERE id = ?")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => {
            let order = ActivationOrder {
                id: row.get("id"),
                shop_id: row.get("shop_id"),
                order_number: row.get("order_number"),
                amount: row.get("amount"),
                currency: row.get("currency"),
                status: row.get("status"),
                payment_method: row.try_get("payment_method").ok(),
                qr_code_url: row.try_get("qr_code_url").ok(),
                expires_at: row.get("expires_at"),
                paid_at: row.try_get("paid_at").ok(),
                created_at: row.get("created_at"),
            };

            Ok(AxumJson(ApiResponse {
                success: true,
                data: Some(ActivationOrderStatusResponse {
                    order: order,
                }),
                message: "Order status retrieved successfully".to_string(),
            }))
        }
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn mock_activation_payment_success(
    State(state): State<Arc<AppState>>,
    Path(order_id): Path<String>,
) -> Result<AxumJson<ApiResponse<()>>, StatusCode> {
    // 获取订单信息
    let order = match sqlx::query("SELECT shop_id, status FROM activation_orders WHERE id = ?")
        .bind(&order_id)
        .fetch_one(&state.db)
        .await
    {
        Ok(row) => (row.get::<String, _>("shop_id"), row.get::<String, _>("status")),
        Err(_) => return Err(StatusCode::NOT_FOUND),
    };

    if order.1 != "pending" {
        return Err(StatusCode::BAD_REQUEST);
    }

    // 开始事务
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            error!("Failed to begin transaction: {}", e);
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    // 更新订单状态为已支付
    if let Err(e) = sqlx::query("UPDATE activation_orders SET status = 'paid', paid_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(&order_id)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        error!("Failed to update activation order status: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 自动审核通过店铺并设置为激活状态
    if let Err(e) = sqlx::query("UPDATE shops SET status = 'approved', approval_status = 'approved', approved_at = ?, expires_at = ? WHERE id = ?")
        .bind(Utc::now())
        .bind(Utc::now() + chrono::Duration::days(365)) // 1年有效期
        .bind(&order.0)
        .execute(&mut *tx)
        .await
    {
        let _ = tx.rollback().await;
        error!("Failed to activate shop: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    // 提交事务
    if let Err(e) = tx.commit().await {
        error!("Failed to commit transaction: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    info!("Mock payment successful for activation order {}, shop {} activated", order_id, order.0);
    Ok(AxumJson(ApiResponse {
        success: true,
        data: Some(()),
        message: "Mock payment processed successfully, shop activated".to_string(),
    }))
}
