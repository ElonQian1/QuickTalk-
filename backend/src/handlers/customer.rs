use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};

use crate::{models::*, AppState};

pub async fn get_customers(
    State(state): State<AppState>,
    Path(shop_id): Path<i64>,
) -> Result<Json<Vec<CustomerWithSession>>, StatusCode> {
    let customers = match state.db.get_customers_by_shop(shop_id).await {
        Ok(customers) => customers,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };

    let mut customers_with_session = Vec::new();

    for customer in customers {
        // 获取会话信息
        let session = state
            .db
            .get_session_by_shop_customer(shop_id, customer.id)
            .await
            .unwrap_or(None);

        // 获取最后一条消息
        let last_message = if let Some(ref sess) = session {
            let messages = state
                .db
                .get_messages_by_session(sess.id, Some(1), Some(0))
                .await
                .unwrap_or_default();
            messages.into_iter().next()
        } else {
            None
        };

        // 获取未读消息数
        let unread_count = state
            .db
            .get_unread_count(shop_id, customer.id)
            .await
            .unwrap_or(0);

        customers_with_session.push(CustomerWithSession {
            customer,
            session,
            last_message,
            unread_count,
        });
    }

    Ok(Json(customers_with_session))
}
