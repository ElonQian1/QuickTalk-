// Purpose: WebSocket 消息处理（客户/客服）与解析辅助函数
// Input: WebSocketIncomingMessage、上下文 CustomerWsCtx（包含状态、发送通道、用户与会话缓存）
// Output: 通过 UnboundedSender<Message> 发送序列化后的 WebSocketMessage 给对应连接；广播到 ConnectionManager
// Errors: 解析失败（payload 无效/字段缺失）、数据库查询失败、持久化失败
use anyhow::Result;
use axum::extract::ws::Message;
use chrono::Utc;
use serde_json::{json, Map, Value};
use tokio::sync::mpsc;

use crate::{
    models::{Customer, Session, WebSocketIncomingMessage, WebSocketMessage},
    services::chat::{ChatService, MessagePayload},
    AppState,
};

pub struct CustomerWsCtx<'a> {
    pub state: &'a AppState,
    pub chat: &'a ChatService<'a>,
    pub shop_id: i64,
    pub customer_code: &'a str,
    pub outbound: &'a mpsc::UnboundedSender<Message>,
    pub customer: &'a mut Option<Customer>,
    pub session: &'a mut Option<Session>,
}

pub async fn handle_customer_ws_message(
    ctx: &mut CustomerWsCtx<'_>,
    incoming: WebSocketIncomingMessage,
) -> Result<()> {
    eprintln!("🔍 [Customer WS] 收到消息: type={}, content={:?}", 
              incoming.message_type, 
              incoming.content.as_ref().map(|c| &c[..c.len().min(50)]));
    
    // 🔧 添加详细的消息内容检查
    eprintln!("📋 [Customer WS] 原始消息详情:");
    eprintln!("   - message_type: {}", incoming.message_type);
    eprintln!("   - content: {:?}", incoming.content);
    eprintln!("   - content长度: {}", incoming.content.as_ref().map(|c| c.len()).unwrap_or(0));
    eprintln!("   - file_name: {:?}", incoming.file_name);
    eprintln!("   - file_url: {:?}", incoming.file_url);
    eprintln!("   - metadata: {:?}", incoming.metadata);
    
    let meta_ref = incoming.metadata.as_ref();

    match incoming.message_type.as_str() {
        crate::constants::ws_incoming::PING => {
            // 简单心跳响应：仅回发 pong 给客户连接
            let pong = WebSocketMessage {
                message_type: crate::constants::ws_events::PONG.to_string(),
                content: None,
                session_id: None,
                sender_id: None,
                sender_type: Some("system".to_string()),
                timestamp: Some(Utc::now()),
                metadata: None,
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };
            if let Ok(payload) = serde_json::to_string(&pong) {
                let _ = ctx.outbound.send(Message::Text(payload));
            }
        }
        crate::constants::ws_incoming::AUTH => {
            let (name, email, avatar, ip, user_agent) = extract_customer_profile(meta_ref);
            let profile = crate::services::chat::CustomerProfile {
                name: name.as_deref(),
                email: email.as_deref(),
                avatar: avatar.as_deref(),
                ip: ip.as_deref(),
                user_agent: user_agent.as_deref(),
            };

            let (cust, sess) = ctx
                .chat
                .ensure_customer_session(ctx.shop_id, ctx.customer_code, profile)
                .await?;

            *ctx.customer = Some(cust.clone());
            *ctx.session = Some(sess.clone());

            let auth_success = WebSocketMessage {
                message_type: crate::constants::ws_events::AUTH_SUCCESS.to_string(),
                content: Some("认证成功，欢迎使用客服系统".to_string()),
                session_id: Some(sess.id),
                sender_id: None,
                sender_type: Some("system".to_string()),
                timestamp: Some(Utc::now()),
                metadata: Some(json!({
                    "sessionId": sess.id,
                    "customerId": cust.id,
                    "customerCode": cust.customer_id,
                    "shopId": ctx.shop_id
                })),
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };

            if let Ok(payload) = serde_json::to_string(&auth_success) {
                let _ = ctx.outbound.send(Message::Text(payload));
            }

            let mut manager = ctx.state.connections.lock().unwrap();
            manager.broadcast_to_staff(ctx.shop_id, &auth_success);
        }
        crate::constants::ws_incoming::SEND_MESSAGE => {
            eprintln!("📨 [Customer WS] 处理发送消息请求");
            
            let (cust, sess) = ensure_customer_context(
                ctx.chat,
                ctx.shop_id,
                ctx.customer_code,
                ctx.customer,
                ctx.session,
            )
            .await?;

            eprintln!("✅ [Customer WS] 客户上下文: customer_id={}, session_id={}", cust.id, sess.id);

            let message_type = extract_message_kind(meta_ref);
            let mut metadata = incoming
                .metadata
                .clone()
                .unwrap_or_else(|| Value::Object(Map::new()));

            if let Value::Object(ref mut map) = metadata {
                map.insert("customerId".to_string(), json!(cust.id));
                map.insert("customerCode".to_string(), json!(cust.customer_id));
                map.insert("shopId".to_string(), json!(ctx.shop_id));
            }

            // 从 metadata 中提取 mediaUrl 作为 file_url
            let file_url = if let Some(metadata_obj) = metadata.as_object() {
                metadata_obj.get("mediaUrl").and_then(|v| v.as_str()).map(|s| s.to_string())
            } else {
                None
            }.or(incoming.file_url.clone());

            let payload = MessagePayload {
                content: incoming.content.clone(),
                message_type,
                file_url,
                file_name: incoming.file_name.clone(),
                file_size: incoming.file_size,
                media_duration: incoming.media_duration,
                metadata: Some(metadata),
            };

            eprintln!("💾 [Customer WS] 准备持久化消息: content={:?}", 
                      payload.content.as_ref().map(|c| &c[..c.len().min(50)]));

            let persisted = ctx
                .chat
                .persist_customer_message(ctx.shop_id, &cust, &sess, payload)
                .await?;

            eprintln!("✅ [Customer WS] 消息已保存到数据库: message_id={}", persisted.message.id);

            if let Ok(payload) = serde_json::to_string(&persisted.ws_message) {
                let _ = ctx.outbound.send(Message::Text(payload.clone()));
                eprintln!("📤 [Customer WS] 消息已回显给客户");
            }

            let mut manager = ctx.state.connections.lock().unwrap();
            manager.broadcast_to_staff(ctx.shop_id, &persisted.ws_message);
            eprintln!("📡 [Customer WS] 消息已广播给店铺 {} 的所有客服", ctx.shop_id);
        }
        crate::constants::ws_incoming::TYPING => {
            if let Some(sess) = ctx.session.as_ref() {
                let mut metadata = incoming
                    .metadata
                    .clone()
                    .unwrap_or_else(|| Value::Object(Map::new()));

                if let Value::Object(ref mut map) = metadata {
                    if let Some(cust) = ctx.customer.as_ref() {
                        map.insert("customerId".to_string(), json!(cust.id));
                        map.insert("customerCode".to_string(), json!(cust.customer_id.clone()));
                    }
                    map.insert("shopId".to_string(), json!(ctx.shop_id));
                }

                let typing_message = WebSocketMessage {
                    message_type: crate::constants::ws_events::TYPING.to_string(),
                    content: incoming.content.clone(),
                    session_id: Some(sess.id),
                    sender_id: ctx.customer.as_ref().map(|c| c.id),
                    sender_type: Some("customer".to_string()),
                    timestamp: Some(Utc::now()),
                    metadata: Some(metadata),
                    file_url: None,
                    file_name: None,
                    file_size: None,
                    media_duration: None,
                };

                let mut manager = ctx.state.connections.lock().unwrap();
                manager.broadcast_to_staff(ctx.shop_id, &typing_message);
            }
        }
        other => {
            tracing::warn!("Unsupported customer message type: {other}");
        }
    }

    Ok(())
}

pub async fn handle_staff_ws_message(
    state: &AppState,
    chat_service: &ChatService<'_>,
    user_id: i64,
    outbound: &mpsc::UnboundedSender<Message>,
    connection_id: &mut Option<String>,
    active_shop: &mut Option<i64>,
    incoming: WebSocketIncomingMessage,
) -> Result<()> {
    let meta_ref = incoming.metadata.as_ref();

    match incoming.message_type.as_str() {
        crate::constants::ws_incoming::PING => {
            let pong = WebSocketMessage {
                message_type: crate::constants::ws_events::PONG.to_string(),
                content: None,
                session_id: None,
                sender_id: Some(user_id),
                sender_type: Some("system".to_string()),
                timestamp: Some(Utc::now()),
                metadata: None,
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };
            if let Ok(payload) = serde_json::to_string(&pong) {
                let _ = outbound.send(Message::Text(payload));
            }
        }
        crate::constants::ws_incoming::AUTH => {
            let Some(shop_id) = extract_shop_id(meta_ref) else {
                tracing::warn!("Staff auth missing shop_id");
                return Ok(());
            };

            if connection_id.is_none() {
                let mut manager = state.connections.lock().unwrap();
                let id = manager.add_staff_connection(user_id, shop_id, outbound.clone());
                *connection_id = Some(id);
            }

            *active_shop = Some(shop_id);

            let auth_success = WebSocketMessage {
                message_type: crate::constants::ws_events::AUTH_SUCCESS.to_string(),
                content: Some("客服认证成功".to_string()),
                session_id: None,
                sender_id: Some(user_id),
                sender_type: Some("staff".to_string()),
                timestamp: Some(Utc::now()),
                metadata: Some(json!({
                    "shopId": shop_id,
                    "userId": user_id
                })),
                file_url: None,
                file_name: None,
                file_size: None,
                media_duration: None,
            };

            if let Ok(payload) = serde_json::to_string(&auth_success) {
                let _ = outbound.send(Message::Text(payload));
            }
        }
        crate::constants::ws_incoming::SEND_MESSAGE => {
            let Some(session_id) = incoming.session_id else {
                tracing::warn!("Staff send_message missing session_id");
                return Ok(());
            };

            let (session, customer) = chat_service.resolve_session(session_id).await?;

            let message_type = extract_message_kind(meta_ref);
            let mut metadata = incoming
                .metadata
                .clone()
                .unwrap_or_else(|| Value::Object(Map::new()));

            if let Value::Object(ref mut map) = metadata {
                map.insert("customerId".to_string(), json!(customer.id));
                map.insert("customerCode".to_string(), json!(customer.customer_id));
                map.insert("shopId".to_string(), json!(session.shop_id));
                map.insert("staffId".to_string(), json!(user_id));
            }

            // 从 metadata 中提取 mediaUrl 作为 file_url
            let file_url = if let Some(metadata_obj) = metadata.as_object() {
                metadata_obj.get("mediaUrl").and_then(|v| v.as_str()).map(|s| s.to_string())
            } else {
                None
            }.or(incoming.file_url.clone());

            let payload = MessagePayload {
                content: incoming.content.clone(),
                message_type,
                file_url,
                file_name: incoming.file_name.clone(),
                file_size: incoming.file_size,
                media_duration: incoming.media_duration,
                metadata: Some(metadata),
            };

            let persisted = chat_service
                .persist_staff_message(&session.clone().into(), user_id, payload, &customer.clone().into())
                .await?;

            let mut manager = state.connections.lock().unwrap();
            manager.send_to_customer(
                session.shop_id as i64,
                &customer.customer_id,
                &persisted.ws_message,
            );
            manager.broadcast_to_staff(session.shop_id as i64, &persisted.ws_message);
        }
        crate::constants::ws_incoming::TYPING => {
            if let Some(session_id) = incoming.session_id {
                let (session, customer) = chat_service.resolve_session(session_id).await?;

                let mut metadata = incoming
                    .metadata
                    .clone()
                    .unwrap_or_else(|| Value::Object(Map::new()));

                if let Value::Object(ref mut map) = metadata {
                    map.insert("customerId".to_string(), json!(customer.id));
                    map.insert("customerCode".to_string(), json!(customer.customer_id));
                    map.insert("shopId".to_string(), json!(session.shop_id));
                    map.insert("staffId".to_string(), json!(user_id));
                }

                let typing_message = WebSocketMessage {
                    message_type: crate::constants::ws_events::TYPING.to_string(),
                    content: incoming.content.clone(),
                    session_id: Some(session_id),
                    sender_id: Some(user_id),
                    sender_type: Some("staff".to_string()),
                    timestamp: Some(Utc::now()),
                    metadata: Some(metadata),
                    file_url: None,
                    file_name: None,
                    file_size: None,
                    media_duration: None,
                };

                let mut manager = state.connections.lock().unwrap();
                manager.send_to_customer(session.shop_id as i64, &customer.customer_id, &typing_message);
                manager.broadcast_to_staff(session.shop_id as i64, &typing_message);
            }
        }
        other => {
            tracing::warn!("Unsupported staff message type: {other}");
        }
    }

    Ok(())
}

async fn ensure_customer_context(
    chat_service: &ChatService<'_>,
    shop_id: i64,
    customer_code: &str,
    customer: &mut Option<Customer>,
    session: &mut Option<Session>,
) -> Result<(Customer, Session)> {
    if let (Some(cust), Some(sess)) = (customer.clone(), session.clone()) {
        return Ok((cust, sess));
    }

    let profile = crate::services::chat::CustomerProfile::default();
    let (cust, sess) = chat_service
        .ensure_customer_session(shop_id, customer_code, profile)
        .await?;

    *customer = Some(cust.clone());
    *session = Some(sess.clone());
    Ok((cust, sess))
}

type CustomerProfileTuple = (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
);

fn extract_customer_profile(metadata: Option<&Value>) -> CustomerProfileTuple {
    let name = metadata
        .and_then(|value| value.get("customerName"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let email = metadata
        .and_then(|value| value.get("customerEmail"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let avatar = metadata
        .and_then(|value| value.get("customerAvatar"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let ip = metadata
        .and_then(|value| value.get("ipAddress"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let agent = metadata
        .and_then(|value| value.get("userAgent"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    (name, email, avatar, ip, agent)
}

fn extract_message_kind(metadata: Option<&Value>) -> String {
    metadata
        .and_then(|value| value.get("messageType"))
        .and_then(|value| value.as_str())
        .filter(|val| !val.is_empty())
        .map(|val| val.to_string())
        .unwrap_or_else(|| "text".to_string())
}

fn value_to_i64(value: &Value) -> Option<i64> {
    match value {
        Value::Number(num) => num.as_i64(),
        Value::String(text) => text.parse::<i64>().ok(),
        _ => None,
    }
}

fn extract_shop_id(metadata: Option<&Value>) -> Option<i64> {
    metadata.and_then(|value| value.get("shopId")).and_then(value_to_i64)
}
