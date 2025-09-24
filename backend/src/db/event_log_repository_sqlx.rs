use sqlx::{SqlitePool, Row};
use serde_json::Value;

// EventLogRepository: 持久化 Envelope 事件(JSON 字符串) 并支持顺序重放
// 表结构见迁移 202509240005_create_event_log.sql

#[derive(Clone)]
pub struct EventLogRepositorySqlx { pub pool: SqlitePool }

pub struct PersistedEvent {
    pub event_id: String,
    pub event_type: String,
    pub emitted_at: String,
    pub payload_json: String,
}

impl EventLogRepositorySqlx {
    pub fn new(pool: SqlitePool) -> Self { Self { pool } }

    pub async fn append_batch(&self, events: &[Value]) -> Result<(), sqlx::Error> {
        if events.is_empty() { return Ok(()); }
        let mut tx = self.pool.begin().await?;
        for v in events {
            let event_id = v["event_id"].as_str().unwrap_or("");
            let event_type = v["type"].as_str().unwrap_or("");
            let emitted_at = v["emitted_at"].as_str().unwrap_or("");
            let payload_json = v.to_string();
            sqlx::query("INSERT OR IGNORE INTO event_log(event_id,event_type,emitted_at,payload_json) VALUES(?,?,?,?)")
                .bind(event_id)
                .bind(event_type)
                .bind(emitted_at)
                .bind(payload_json)
                .execute(&mut *tx).await?;
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn replay_since(&self, since_event_id: Option<&str>, limit: i64) -> Result<Vec<PersistedEvent>, sqlx::Error> {
        // 策略：若提供 since_event_id，先查其 emitted_at，再以 emitted_at + id 排序过滤
        if let Some(eid) = since_event_id {
            if let Some(anchor) = sqlx::query("SELECT emitted_at, id FROM event_log WHERE event_id = ?")
                .bind(eid)
                .fetch_optional(&self.pool).await? {
                let anchor_emitted: String = anchor.get("emitted_at");
                let anchor_row_id: i64 = anchor.get("id");
                let rows = sqlx::query("SELECT event_id,event_type,emitted_at,payload_json FROM event_log WHERE (emitted_at > ? OR (emitted_at = ? AND id > ?)) ORDER BY emitted_at, id LIMIT ?")
                    .bind(&anchor_emitted)
                    .bind(&anchor_emitted)
                    .bind(anchor_row_id)
                    .bind(limit)
                    .fetch_all(&self.pool).await?;
                return Ok(rows.into_iter().map(row_to_persisted).collect());
            }
        }
        let rows = sqlx::query("SELECT event_id,event_type,emitted_at,payload_json FROM event_log ORDER BY emitted_at, id LIMIT ?")
            .bind(limit)
            .fetch_all(&self.pool).await?;
        Ok(rows.into_iter().map(row_to_persisted).collect())
    }
}

fn row_to_persisted(r: sqlx::sqlite::SqliteRow) -> PersistedEvent {
    PersistedEvent {
        event_id: r.get("event_id"),
        event_type: r.get("event_type"),
        emitted_at: r.get("emitted_at"),
        payload_json: r.get("payload_json"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    #[tokio::test]
    async fn append_and_replay() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query("CREATE TABLE event_log (id INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT UNIQUE,event_type TEXT,emitted_at TEXT,payload_json TEXT);").execute(&pool).await.unwrap();
        let repo = EventLogRepositorySqlx::new(pool.clone());
        let e1 = serde_json::json!({"version":"v1","type":"t1","event_id":"e1","emitted_at":"2025-09-24T08:00:00Z","data":{}});
        let e2 = serde_json::json!({"version":"v1","type":"t2","event_id":"e2","emitted_at":"2025-09-24T08:00:01Z","data":{}});
        repo.append_batch(&[e1,e2]).await.unwrap();
        let first = repo.replay_since(None, 10).await.unwrap();
        assert_eq!(first.len(), 2);
        let next = repo.replay_since(Some("e1"), 10).await.unwrap();
        assert_eq!(next.len(), 1);
        assert_eq!(next[0].event_id, "e2");
    }
}
