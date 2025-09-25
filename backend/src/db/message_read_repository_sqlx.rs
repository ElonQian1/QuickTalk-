use crate::domain::conversation::{MessageReadRepository, RepoError, ConversationId, Message, MessageId, SenderType};
use async_trait::async_trait;
use sqlx::{SqlitePool, Row};

pub struct MessageReadRepositorySqlx { pub pool: SqlitePool }
impl MessageReadRepositorySqlx { #[allow(dead_code)] pub fn new(pool: SqlitePool) -> Self { Self { pool } } }

#[async_trait]
impl MessageReadRepository for MessageReadRepositorySqlx {
    async fn list_by_conversation(&self, conversation_id: &ConversationId, limit: i64, offset: i64) -> Result<Vec<Message>, RepoError> {
        let rows = sqlx::query("SELECT id, sender_id, sender_type, content, message_type, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?")
            .bind(&conversation_id.0)
            .bind(limit)
            .bind(offset)
            .fetch_all(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let sender_type_str: String = r.get("sender_type");
            let sender_type = SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Customer);
            out.push(Message {
                id: MessageId(r.get::<String,_>("id")),
                conversation_id: ConversationId(conversation_id.0.clone()),
                sender_id: r.get("sender_id"),
                sender_type,
                content: r.get("content"),
                message_type: r.get("message_type"),
                timestamp: r.get("timestamp"),
            });
        }
        Ok(out)
    }

    async fn find_by_id(&self, id: &MessageId) -> Result<Option<Message>, RepoError> {
        let row = sqlx::query("SELECT id, conversation_id, sender_id, sender_type, content, message_type, timestamp FROM messages WHERE id = ? AND deleted_at IS NULL")
            .bind(&id.0)
            .fetch_optional(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        if let Some(r) = row {
            let sender_type_str: String = r.get("sender_type");
            let sender_type = SenderType::from_str(&sender_type_str).unwrap_or(SenderType::Customer);
            Ok(Some(Message {
                id: MessageId(r.get::<String,_>("id")),
                conversation_id: ConversationId(r.get::<String,_>("conversation_id")),
                sender_id: r.get("sender_id"),
                sender_type,
                content: r.get("content"),
                message_type: r.get("message_type"),
                timestamp: r.get("timestamp"),
            }))
        } else { Ok(None) }
    }
}
