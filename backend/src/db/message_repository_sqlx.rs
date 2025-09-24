use crate::domain::conversation::{MessageRepository, RepoError, MessageId, Message, ConversationId, SenderType};
use async_trait::async_trait;
use sqlx::{SqlitePool, Row};

pub struct MessageRepositorySqlx { pub pool: SqlitePool }
impl MessageRepositorySqlx { #[allow(dead_code)] pub fn new(pool: SqlitePool) -> Self { Self { pool } } }

#[async_trait]
impl MessageRepository for MessageRepositorySqlx {
    async fn find(&self, id: &MessageId) -> Result<Option<Message>, RepoError> {
        let row = sqlx::query("SELECT id, conversation_id, sender_id, sender_type, content, message_type, timestamp FROM messages WHERE id = ? AND (deleted_at IS NULL)")
            .bind(&id.0)
            .fetch_optional(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        let Some(r) = row else { return Ok(None) };
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
    }
    async fn update_content(&self, id: &MessageId, new_content: &str) -> Result<(), RepoError> {
        if new_content.trim().is_empty() { return Err(RepoError::Database("content empty".into())); }
        let res = sqlx::query("UPDATE messages SET content = ? WHERE id = ? AND deleted_at IS NULL")
            .bind(new_content)
            .bind(&id.0)
            .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        if res.rows_affected() == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
    async fn soft_delete(&self, id: &MessageId) -> Result<(), RepoError> {
        let res = sqlx::query("UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
            .bind(&id.0)
            .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        if res.rows_affected() == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
    async fn hard_delete(&self, id: &MessageId) -> Result<(), RepoError> {
        let res = sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(&id.0)
            .execute(&self.pool).await.map_err(|e| RepoError::Database(e.to_string()))?;
        if res.rows_affected() == 0 { return Err(RepoError::NotFound); }
        Ok(())
    }
}
