use anyhow::{anyhow, Result};
use chrono::Utc;
use serde_json::{Map, Value};

use crate::{
    models::{Customer, CustomerUpsert, Message, Session, WebSocketMessage},
    AppState,
};

#[derive(Clone, Debug, Default)]
pub struct CustomerProfile<'a> {
    pub name: Option<&'a str>,
    pub email: Option<&'a str>,
    pub avatar: Option<&'a str>,
    pub ip: Option<&'a str>,
    pub user_agent: Option<&'a str>,
}

#[derive(Clone, Debug)]
pub struct MessagePayload {
    pub content: Option<String>,
    pub message_type: String,
    pub file_url: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub media_duration: Option<f64>,
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug)]
pub struct PersistedMessage {
    pub message: Message,
    pub ws_message: WebSocketMessage,
}

pub struct ChatService<'a> {
    state: &'a AppState,
}

impl<'a> ChatService<'a> {
    pub fn new(state: &'a AppState) -> Self {
        Self { state }
    }

    pub async fn ensure_customer_session(
        &self,
        shop_id: i64,
        external_customer_id: &str,
        profile: CustomerProfile<'_>,
    ) -> Result<(Customer, Session)> {
        let upsert = CustomerUpsert {
            name: profile.name,
            email: profile.email,
            avatar: profile.avatar,
            ip: profile.ip,
            user_agent: profile.user_agent,
        };

        let customer = self
            .state
            .customer_service
            .create_or_update_customer(shop_id as i32, external_customer_id.to_string(), serde_json::to_value(upsert)?)
            .await?;

        let session = match self
            .state
            .session_service
            .get_session_by_shop_customer(shop_id as i32, customer.id)
            .await?
        {
            Some(session) => session,
            None => self.state.session_service.create_session(shop_id as i32, customer.id).await?,
        };

        Ok((customer.into(), session.into()))
    }

    pub async fn persist_customer_message(
        &self,
        _shop_id: i64,  // 暂时未使用（等unread_counts表修复后启用）
        customer: &Customer,
        session: &Session,
        payload: MessagePayload,
    ) -> Result<PersistedMessage> {
        let persisted = self
            .persist_message(session, "customer", Some(customer.id), &payload)
            .await?;

        // TODO: 修复unread_counts表schema后启用
        // crate::repositories::UnreadCountRepository::update_unread_count(
        //     &self.state.db_connection,
        //     shop_id,
        //     customer.id,
        //     1
        // ).await?;

        Ok(PersistedMessage {
            message: persisted,
            ws_message: self.build_ws_message(
                &payload,
                Some("customer".to_string()),
                None,
                session.id,
            ),
        })
    }

    pub async fn persist_staff_message(
        &self,
        session: &Session,
        staff_id: i64,
        payload: MessagePayload,
        customer: &Customer,
    ) -> Result<PersistedMessage> {
        let persisted = self
            .persist_message(session, "staff", Some(staff_id), &payload)
            .await?;

        // TODO: 修复unread_counts表schema后启用
        // crate::repositories::UnreadCountRepository::reset_unread_count(
        //     &self.state.db_connection,
        //     session.shop_id as i64,
        //     customer.id
        // ).await?;

        Ok(PersistedMessage {
            message: persisted,
            ws_message: self.build_ws_message(
                &payload,
                Some("staff".to_string()),
                Some(staff_id),
                session.id,
            ),
        })
    }

    async fn persist_message(
        &self,
        session: &Session,
        sender_type: &str,
        sender_id: Option<i64>,
        payload: &MessagePayload,
    ) -> Result<Message> {
        let content = payload.content.clone().unwrap_or_default();
        let message_type = if payload.message_type.is_empty() {
            "text".to_string()
        } else {
            payload.message_type.clone()
        };

        let message = crate::repositories::MessageRepository::create(
            &self.state.db_connection,
            session.id as i32,
            sender_type.to_string(),
            sender_id.map(|id| id.to_string()),  // 转换为String
            Some(content),
            message_type,
            payload.file_url.clone().unwrap_or_default(),
            payload.file_url.clone(), // file_url
            None, // file_name - 可能需要从 metadata 或其他地方获取
        ).await?;

        Ok(message.into())
    }

    pub fn build_ws_message(
        &self,
        payload: &MessagePayload,
        sender_type: Option<String>,
        sender_id: Option<i64>,
        session_id: i64,
    ) -> WebSocketMessage {
        let mut meta_map = match payload.metadata.clone() {
            Some(Value::Object(map)) => map,
            _ => Map::new(),
        };
        // 内容类型保留在 metadata.messageType
        meta_map.insert(
            "messageType".to_string(),
            Value::String(payload.message_type.clone()),
        );
        if let Some(size) = payload.file_size {
            meta_map.insert("fileSize".to_string(), Value::Number(size.into()));
        }
        if let Some(duration) = payload.media_duration {
            if let Some(num) = serde_json::Number::from_f64(duration) {
                meta_map.insert("duration".to_string(), Value::Number(num));
            }
        }

        WebSocketMessage {
            // 顶层事件名统一为 new_message
            message_type: crate::constants::ws_events::NEW_MESSAGE.to_string(),
            content: payload.content.clone(),
            session_id: Some(session_id),
            sender_id,
            sender_type,
            timestamp: Some(Utc::now()),
            metadata: Some(Value::Object(meta_map)),
            file_url: payload.file_url.clone(),
            file_name: payload.file_name.clone(),
            file_size: payload.file_size,
            media_duration: payload.media_duration,
        }
    }

    pub async fn resolve_session(&self, session_id: i64) -> Result<(crate::entities::sessions::Model, crate::entities::customers::Model)> {
        let session = crate::repositories::SessionRepository::find_by_id(
            &self.state.db_connection,
            session_id as i32
        ).await?
            .ok_or_else(|| anyhow!("session not found"))?;
        let customer = crate::repositories::CustomerRepository::find_by_id(
            &self.state.db_connection,
            session.customer_id
        ).await?
            .ok_or_else(|| anyhow!("customer not found"))?;
        Ok((session, customer))
    }
}
