use serde_json::{json, Value};
use chrono::Utc;
use uuid::Uuid;
use crate::bootstrap::app_state::AppState;
use sqlx::Row;

/// 处理客户端消息并广播到管理端
pub async fn handle_customer_message(
    state: &AppState,
    shop_id: &str,
    content: &str,
    sender_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 查找或创建对话
    let conversation_id = crate::ws::find_or_create_conversation(state, shop_id, sender_id).await?;
    
    // 保存客户端消息
    let message_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now();
    
    let _result = sqlx::query(
        "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&message_id)
    .bind(&conversation_id)
    .bind(sender_id)
    .bind("customer")
    .bind(content)
    .bind("text")
    .bind(&timestamp)
    .execute(&state.db)
    .await?;
    
    tracing::info!("客户端消息已保存: {} -> {}", message_id, conversation_id);
    
    // 构建规范化消息对象
    let message = json!({
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_type": "customer",
        "content": content,
        "message_type": "text",
        "timestamp": timestamp,
        "shop_id": shop_id
    });
    
    // 广播给管理端 - 使用多种格式确保兼容性
    broadcast_to_admin(state, &message, &conversation_id, shop_id).await?;
    
    Ok(())
}

/// 处理管理端消息并广播到客户端
pub async fn handle_agent_message(
    state: &AppState,
    conversation_id: &str,
    content: &str,
    sender_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 保存管理端消息
    let message_id = Uuid::new_v4().to_string();
    let timestamp = Utc::now();
    
    let _result = sqlx::query(
        "INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&message_id)
    .bind(conversation_id)
    .bind(sender_id)
    .bind("agent")
    .bind(content)
    .bind("text")
    .bind(&timestamp)
    .execute(&state.db)
    .await?;
    
    tracing::info!("管理端消息已保存: {} -> {}", message_id, conversation_id);
    
    // 获取shop_id
    let shop_id = sqlx::query("SELECT shop_id FROM conversations WHERE id = ?")
        .bind(conversation_id)
        .fetch_one(&state.db)
        .await?
        .get::<String, _>("shop_id");
    
    // 构建规范化消息对象
    let message = json!({
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": sender_id,
        "sender_type": "agent",
        "content": content,
        "message_type": "text",
        "timestamp": timestamp,
        "shop_id": shop_id
    });
    
    // 广播给客户端和管理端
    broadcast_to_all(state, &message, conversation_id, &shop_id).await?;
    
    Ok(())
}

/// 广播消息给管理端（统一领域事件格式）
async fn broadcast_to_admin(
    state: &AppState,
    message: &Value,
    _conversation_id: &str,
    _shop_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 统一使用领域事件格式
    let domain_event = json!({
        "version": "v1",
        "type": "domain.event.message_appended",
        "event_id": Uuid::new_v4().to_string(),
        "emitted_at": Utc::now().to_rfc3339(),
        "data": { "message": message }
    });
    
    // 只广播一种格式，避免重复
    let _ = state.message_sender.send(domain_event.to_string());
    
    Ok(())
}

/// 广播消息给所有连接（统一领域事件格式）
async fn broadcast_to_all(
    state: &AppState,
    message: &Value,
    _conversation_id: &str,
    _shop_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // 统一使用领域事件格式，避免重复广播
    let domain_event = json!({
        "version": "v1",
        "type": "domain.event.message_appended",
        "event_id": Uuid::new_v4().to_string(),
        "emitted_at": Utc::now().to_rfc3339(),
        "data": { "message": message }
    });
    
    // 只发送一种格式，避免重复
    let _ = state.message_sender.send(domain_event.to_string());
    
    tracing::info!("消息已广播到所有连接: {} (统一格式)", message["id"]);
    
    Ok(())
}