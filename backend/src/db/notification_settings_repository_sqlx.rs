use sqlx::{SqlitePool, Row};
use chrono::Utc;

#[derive(Debug, Clone)]
pub struct NotificationSettings {
    pub admin_id: String,
    pub new_message: bool,
    pub employee_joined: bool,
    pub shop_updated: bool,
    pub system_notice: bool,
    pub updated_at: String,
}

pub struct NotificationSettingsRepositorySqlx { pub pool: SqlitePool }

impl NotificationSettingsRepositorySqlx {
    pub fn new(pool: SqlitePool) -> Self { Self { pool } }

    pub async fn get(&self, admin_id: &str) -> sqlx::Result<Option<NotificationSettings>> {
        let row = sqlx::query(
            "SELECT admin_id, new_message, employee_joined, shop_updated, system_notice, updated_at FROM admin_notification_settings WHERE admin_id = ?"
        )
        .bind(admin_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|r| NotificationSettings {
            admin_id: r.get("admin_id"),
            new_message: r.get::<i64,_>("new_message") == 1,
            employee_joined: r.get::<i64,_>("employee_joined") == 1,
            shop_updated: r.get::<i64,_>("shop_updated") == 1,
            system_notice: r.get::<i64,_>("system_notice") == 1,
            updated_at: r.get("updated_at"),
        }))
    }

    pub async fn upsert(&self, s: &NotificationSettings) -> sqlx::Result<()> {
        let now = Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO admin_notification_settings (admin_id, new_message, employee_joined, shop_updated, system_notice, updated_at) VALUES (?, ?, ?, ?, ?, ?) \
             ON CONFLICT(admin_id) DO UPDATE SET new_message=excluded.new_message, employee_joined=excluded.employee_joined, shop_updated=excluded.shop_updated, system_notice=excluded.system_notice, updated_at=excluded.updated_at"
        )
        .bind(&s.admin_id)
        .bind(if s.new_message {1} else {0})
        .bind(if s.employee_joined {1} else {0})
        .bind(if s.shop_updated {1} else {0})
        .bind(if s.system_notice {1} else {0})
        .bind(&now)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
