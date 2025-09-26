use serde::Serialize;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize)]
pub struct DayStat {
    pub date: String, // YYYY-MM-DD (localtime)
    pub messages: i64,
    pub conversations_started: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkbenchTotals {
    pub conversations: i64,
    pub active_conversations: i64,
    pub waiting_customers: i64,
    pub overdue_conversations: i64,
    pub messages_today: i64,
    pub messages_7d: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkbenchSummary {
    pub shop_id: Option<String>,
    pub totals: WorkbenchTotals,
    pub by_day: Vec<DayStat>,
}

#[derive(Clone)]
pub struct WorkbenchReadModelSqlx {
    pub pool: SqlitePool,
}

impl WorkbenchReadModelSqlx {
    #[allow(dead_code)]
    pub fn new(pool: SqlitePool) -> Self { Self { pool } }

    pub async fn summary(&self, shop_id: Option<&str>, days: i64) -> Result<WorkbenchSummary, sqlx::Error> {
        let days = if days <= 0 { 7 } else { days.min(90) }; // 上限保护

        // 1) 总会话数 / 活跃会话数
        let conversations_total: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as("SELECT COUNT(*) FROM conversations WHERE shop_id = ?")
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM conversations")
                .fetch_one(&self.pool)
                .await?
        };

        let active_conversations: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as("SELECT COUNT(*) FROM conversations WHERE shop_id = ? AND status IN ('active','open','pending')")
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as("SELECT COUNT(*) FROM conversations WHERE status IN ('active','open','pending')")
                .fetch_one(&self.pool)
                .await?
        };

        // 2) 待回复(最近一条消息来自客户，且会话未关闭)
        let waiting_sql = r#"
            WITH last_msg AS (
                SELECT m.conversation_id,
                       MAX(m.timestamp) AS max_ts
                FROM messages m
                WHERE 1=1
                GROUP BY m.conversation_id
            )
            SELECT COUNT(1)
            FROM last_msg lm
            JOIN messages m ON m.conversation_id = lm.conversation_id AND m.timestamp = lm.max_ts
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.sender_type = 'customer' AND c.status != 'closed'
        "#;

        let waiting_customers: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as(&format!("{} AND c.shop_id = ?", waiting_sql))
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as(waiting_sql)
                .fetch_one(&self.pool)
                .await?
        };

        // 3) 超时(>2小时未回复，且最后消息来自客户)
        let overdue_sql = r#"
            WITH last_msg AS (
                SELECT m.conversation_id,
                       MAX(m.timestamp) AS max_ts
                FROM messages m
                GROUP BY m.conversation_id
            )
            SELECT COUNT(1)
            FROM last_msg lm
            JOIN messages m ON m.conversation_id = lm.conversation_id AND m.timestamp = lm.max_ts
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.sender_type = 'customer' AND c.status != 'closed'
              AND datetime(m.timestamp) <= datetime('now', '-2 hours')
        "#;
        let overdue_conversations: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as(&format!("{} AND c.shop_id = ?", overdue_sql))
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as(overdue_sql)
                .fetch_one(&self.pool)
                .await?
        };

        // 4) 今日消息数 / 近7天消息数
        let msgs_today_sql = "SELECT COUNT(*) FROM messages WHERE date(timestamp, 'localtime') = date('now','localtime')";
        let messages_today: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as(&format!("{} AND shop_id = ?", msgs_today_sql))
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as(msgs_today_sql)
                .fetch_one(&self.pool)
                .await?
        };

        let msgs_7d_sql = "SELECT COUNT(*) FROM messages WHERE datetime(timestamp) >= datetime('now', '-7 days')";
        let messages_7d: (i64,) = if let Some(sid) = shop_id {
            sqlx::query_as(&format!("{} AND shop_id = ?", msgs_7d_sql))
                .bind(sid)
                .fetch_one(&self.pool)
                .await?
        } else {
            sqlx::query_as(msgs_7d_sql)
                .fetch_one(&self.pool)
                .await?
        };

        // 5) 近 N 天的分日统计（消息计数 & 新建会话）
        let by_day_msgs_sql = r#"
            SELECT date(timestamp, 'localtime') AS d, COUNT(*) AS cnt
            FROM messages
            WHERE datetime(timestamp) >= datetime('now', ?)
            {shop_filter}
            GROUP BY date(timestamp, 'localtime')
            ORDER BY d ASC
        "#;

        let days_param = format!("-{} days", days);
        let shop_filter = if shop_id.is_some() { "AND shop_id = ?" } else { "" };
        let sql_msgs = by_day_msgs_sql.replace("{shop_filter}", shop_filter);

        let rows_msgs = if let Some(sid) = shop_id {
            sqlx::query(&sql_msgs)
                .bind(&days_param)
                .bind(sid)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query(&sql_msgs)
                .bind(&days_param)
                .fetch_all(&self.pool)
                .await?
        };

        let mut msgs_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        for r in rows_msgs {
            let d: String = r.get("d");
            let cnt: i64 = r.get("cnt");
            msgs_map.insert(d, cnt);
        }

        let by_day_convos_sql = r#"
            SELECT date(created_at, 'localtime') AS d, COUNT(*) AS cnt
            FROM conversations
            WHERE datetime(created_at) >= datetime('now', ?)
            {shop_filter}
            GROUP BY date(created_at, 'localtime')
            ORDER BY d ASC
        "#;
        let sql_conv = by_day_convos_sql.replace("{shop_filter}", shop_filter);
        let rows_conv = if let Some(sid) = shop_id {
            sqlx::query(&sql_conv)
                .bind(&days_param)
                .bind(sid)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query(&sql_conv)
                .bind(&days_param)
                .fetch_all(&self.pool)
                .await?
        };
        let mut conv_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        for r in rows_conv {
            let d: String = r.get("d");
            let cnt: i64 = r.get("cnt");
            conv_map.insert(d, cnt);
        }

        // 合并天维度（仅返回有数据的天；前端可填充缺失天为0）
        let mut keys: Vec<String> = msgs_map.keys().cloned().collect();
        for k in conv_map.keys() { if !keys.contains(k) { keys.push(k.clone()); } }
        keys.sort();

        let by_day = keys.into_iter().map(|d| DayStat {
            date: d.clone(),
            messages: *msgs_map.get(&d).unwrap_or(&0),
            conversations_started: *conv_map.get(&d).unwrap_or(&0),
        }).collect();

        Ok(WorkbenchSummary {
            shop_id: shop_id.map(|s| s.to_string()),
            totals: WorkbenchTotals {
                conversations: conversations_total.0,
                active_conversations: active_conversations.0,
                waiting_customers: waiting_customers.0,
                overdue_conversations: overdue_conversations.0,
                messages_today: messages_today.0,
                messages_7d: messages_7d.0,
            },
            by_day,
        })
    }
}
