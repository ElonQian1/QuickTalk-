use sqlx::Row;
use sqlx::SqlitePool;
use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::domain::admin::repository::{AdminRepository, AdminRepoError};
use crate::domain::admin::model::{Admin, AdminId, Username, Email, AdminRole};

pub struct SqlxAdminRepository { pub pool: SqlitePool }

#[async_trait]
impl AdminRepository for SqlxAdminRepository {
    async fn find_by_id(&self, id: &AdminId) -> Result<Admin, AdminRepoError> {
        let row = sqlx::query("SELECT id, username, role, email, created_at FROM admins WHERE id = ?")
            .bind(&id.0)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| AdminRepoError::Db(e.to_string()))?;
        let row = row.ok_or(AdminRepoError::NotFound)?;
        let created_raw: String = row.get("created_at");
        let created_at: DateTime<Utc> = created_raw.parse().unwrap_or_else(|_| Utc::now());
        Ok(Admin {
            id: AdminId(row.get("id")),
            username: Username(row.get("username")),
            role: AdminRole::from_str(row.get::<String,_>("role").as_str()),
            email: row.try_get::<String,_>("email").ok().map(Email),
            created_at,
        })
    }

    async fn update_email(&self, id: &AdminId, email: Option<Email>) -> Result<(), AdminRepoError> {
        sqlx::query("UPDATE admins SET email = ? WHERE id = ?")
            .bind(email.as_ref().map(|e| e.0.clone()))
            .bind(&id.0)
            .execute(&self.pool)
            .await
            .map_err(|e| AdminRepoError::Db(e.to_string()))?;
        Ok(())
    }

    async fn update_password_hash(&self, id: &AdminId, new_hash: &str) -> Result<(), AdminRepoError> {
        sqlx::query("UPDATE admins SET password_hash = ? WHERE id = ?")
            .bind(new_hash)
            .bind(&id.0)
            .execute(&self.pool)
            .await
            .map_err(|e| AdminRepoError::Db(e.to_string()))?;
        Ok(())
    }

    async fn invalidate_sessions(&self, id: &AdminId) -> Result<(), AdminRepoError> {
        sqlx::query("DELETE FROM sessions WHERE admin_id = ?")
            .bind(&id.0)
            .execute(&self.pool)
            .await
            .map_err(|e| AdminRepoError::Db(e.to_string()))?;
        Ok(())
    }
}
