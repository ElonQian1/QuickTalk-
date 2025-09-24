use crate::domain::conversation::{ConversationRepository, Conversation, ConversationId, RepoError, Message, MessageId, SenderType};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{SqlitePool, Row};

pub struct SqlxConversationRepository {
    pub pool: SqlitePool,
}

impl SqlxConversationRepository { #[allow(dead_code)] pub fn new(pool: SqlitePool) -> Self { Self { pool } } }

#[async_trait]
impl ConversationRepository for SqlxConversationRepository {
    async fn find(&self, id: &ConversationId) -> Result<Option<Conversation>, RepoError> {
        // Load conversation row
        let convo_row = match sqlx::query("SELECT id, shop_id, customer_id, status, created_at, updated_at FROM conversations WHERE id = ?")
            .bind(&id.0)
            .fetch_optional(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))? {
            Some(r) => r,
            None => return Ok(None)
        };
        let created_at: DateTime<Utc> = convo_row.get("created_at");
        let updated_at: DateTime<Utc> = convo_row.get("updated_at");
        let mut convo = Conversation {
            id: id.clone(),
            shop_id: convo_row.get("shop_id"),
            customer_id: convo_row.get("customer_id"),
            status: convo_row.get("status"),
            created_at,
            updated_at,
            messages: Vec::new(),
            pending_events: Vec::new(),
        };

        // Load messages
        let msg_rows = sqlx::query("SELECT id, sender_id, sender_type, content, message_type, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC")
            .bind(&id.0)
            .fetch_all(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        for r in msg_rows {
            let sender_type_str: String = r.get("sender_type");
            let sender_type = SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Customer); // fallback
            convo.messages.push(Message {
                id: MessageId(r.get::<String,_>("id")),
                conversation_id: id.clone(),
                sender_id: r.get("sender_id"),
                sender_type,
                content: r.get("content"),
                message_type: r.get("message_type"),
                timestamp: r.get("timestamp"),
            });
        }
        Ok(Some(convo))
    }

    async fn save(&self, convo: &Conversation) -> Result<(), RepoError> {
        // Upsert conversation status/updated_at
        sqlx::query("UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?")
            .bind(&convo.status)
            .bind(&convo.updated_at)
            .bind(&convo.id.0)
            .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;

        // 按消息ID防重插入 (忽略已存在消息) —— 聚合 messages 作为真实来源
        for m in &convo.messages {
            sqlx::query("INSERT OR IGNORE INTO messages (id, conversation_id, sender_id, sender_type, content, message_type, timestamp, shop_id) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT shop_id FROM conversations WHERE id = ?))")
                .bind(&m.id.0)
                .bind(&convo.id.0)
                .bind(&m.sender_id)
                .bind(m.sender_type.as_str())
                .bind(&m.content)
                .bind(&m.message_type)
                .bind(m.timestamp)
                .bind(&convo.id.0)
                .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        }
        Ok(())
    }
    async fn list(&self, shop_id: Option<&str>) -> Result<Vec<Conversation>, RepoError> {
        let rows = if let Some(sid) = shop_id {
            sqlx::query("SELECT id, shop_id, customer_id, status, created_at, updated_at FROM conversations WHERE shop_id = ? ORDER BY updated_at DESC")
                .bind(sid)
                .fetch_all(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?
        } else {
            sqlx::query("SELECT id, shop_id, customer_id, status, created_at, updated_at FROM conversations ORDER BY updated_at DESC")
                .fetch_all(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?
        };
        let mut list = Vec::with_capacity(rows.len());
        for r in rows {
            list.push(Conversation {
                id: ConversationId(r.get("id")),
                shop_id: r.get("shop_id"),
                customer_id: r.get("customer_id"),
                status: r.get("status"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
                messages: Vec::new(),
                pending_events: Vec::new(),
            });
        }
        Ok(list)
    }
    async fn create(&self, convo: &Conversation) -> Result<(), RepoError> {
        sqlx::query("INSERT INTO conversations (id, shop_id, customer_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&convo.id.0)
            .bind(&convo.shop_id)
            .bind(&convo.customer_id)
            .bind(&convo.status)
            .bind(convo.created_at)
            .bind(convo.updated_at)
            .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        Ok(())
    }
}