use async_trait::async_trait;
use sqlx::{SqlitePool, Row};
use crate::application::queries::conversation_queries::{ConversationQueries, ConversationSearchResult, ConversationSummaryView, QueryError};

pub struct ConversationReadModelSqlx { pub pool: SqlitePool }

#[async_trait]
impl ConversationQueries for ConversationReadModelSqlx {
    async fn search(&self, shop_id: Option<&str>, term: Option<&str>) -> Result<Vec<ConversationSearchResult>, QueryError> {
        let like = format!("%{}%", term.unwrap_or(""));
        let rows = if let Some(sid) = shop_id {
            sqlx::query(
                "SELECT c.id, c.shop_id, c.customer_id, c.status, c.created_at, c.updated_at \
                 FROM conversations c \
                 LEFT JOIN customers cu ON c.customer_id = cu.id \
                 WHERE c.shop_id = ? AND (cu.name LIKE ? OR cu.email LIKE ?)"
            )
            .bind(sid).bind(&like).bind(&like)
            .fetch_all(&self.pool).await.map_err(|e| QueryError::Database(e.to_string()))?
        } else {
            sqlx::query(
                "SELECT c.id, c.shop_id, c.customer_id, c.status, c.created_at, c.updated_at \
                 FROM conversations c \
                 LEFT JOIN customers cu ON c.customer_id = cu.id \
                 WHERE (cu.name LIKE ? OR cu.email LIKE ?)"
            )
            .bind(&like).bind(&like)
            .fetch_all(&self.pool).await.map_err(|e| QueryError::Database(e.to_string()))?
        };
        let mut out = Vec::with_capacity(rows.len());
        for r in rows { out.push(ConversationSearchResult { id: r.get("id"), shop_id: r.get("shop_id"), customer_id: r.get("customer_id"), status: r.get("status"), created_at: r.get("created_at"), updated_at: r.get("updated_at") }); }
        Ok(out)
    }

    async fn summary(&self, id: &str) -> Result<ConversationSummaryView, QueryError> {
        let row_opt = sqlx::query(
            "SELECT c.id, c.shop_id, c.customer_id, c.status, c.created_at, c.updated_at, \
                    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count, \
                    (SELECT MAX(timestamp) FROM messages WHERE conversation_id = c.id) as last_message_time \
             FROM conversations c WHERE c.id = ?"
        )
        .bind(id)
        .fetch_optional(&self.pool).await.map_err(|e| QueryError::Database(e.to_string()))?;
        match row_opt {
            Some(r) => Ok(ConversationSummaryView {
                id: r.get("id"),
                shop_id: r.get("shop_id"),
                customer_id: r.get("customer_id"),
                status: r.get("status"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
                message_count: r.get::<i64,_>("message_count"),
                last_message_time: r.try_get("last_message_time").ok(),
            }),
            None => Err(QueryError::NotFound)
        }
    }
}
