use std::sync::Arc;
use sqlx::{SqlitePool, Row};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use crate::domain::shop::{repository::{ShopRepository, ShopRepoError}, ShopAggregate};
use crate::domain::shared::ids::ShopId;

#[derive(Clone)]
pub struct ShopRepositorySqlx {
    pub pool: SqlitePool,
}

impl ShopRepositorySqlx {
    pub fn new(pool: SqlitePool) -> Self { Self { pool } }
}

#[async_trait]
impl ShopRepository for ShopRepositorySqlx {
    async fn find_by_id(&self, id: &ShopId) -> Result<ShopAggregate, ShopRepoError> {
        let row = sqlx::query("SELECT id, owner_id, name, domain, status, created_at FROM shops WHERE id = ?")
            .bind(&id.0)
            .fetch_optional(&self.pool)
            .await
            .map_err(|_| ShopRepoError::Internal)?
            .ok_or(ShopRepoError::NotFound)?;
        let created_at_str: String = row.get("created_at");
        let created_at: DateTime<Utc> = created_at_str.parse().unwrap_or_else(|_| Utc::now());
        Ok(ShopAggregate::reconstruct(
            ShopId(row.get::<String,_>("id")),
            row.get("owner_id"),
            row.get("name"),
            row.get("domain"),
            row.get("status"),
            created_at,
        ))
    }
    async fn save(&self, shop: &ShopAggregate) -> Result<(), ShopRepoError> {
        let res = sqlx::query("UPDATE shops SET owner_id = ?, name = ?, domain = ?, status = ? WHERE id = ?")
            .bind(&shop.owner_id)
            .bind(&shop.name)
            .bind(&shop.domain)
            .bind(&shop.status)
            .bind(&shop.id.0)
            .execute(&self.pool)
            .await
            .map_err(|_| ShopRepoError::Internal)?;
        if res.rows_affected() == 0 {
            // 插入
            sqlx::query("INSERT INTO shops (id, owner_id, name, domain, status, created_at, api_key) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT api_key FROM shops WHERE id = ?), ''))")
                .bind(&shop.id.0)
                .bind(&shop.owner_id)
                .bind(&shop.name)
                .bind(&shop.domain)
                .bind(&shop.status)
                .bind(shop.created_at.to_rfc3339())
                .bind(&shop.id.0)
                .execute(&self.pool)
                .await
                .map_err(|_| ShopRepoError::Internal)?;
        }
        Ok(())
    }
    async fn exists_domain(&self, domain: &str, exclude_id: Option<&ShopId>) -> Result<bool, ShopRepoError> {
        let mut q = sqlx::QueryBuilder::new("SELECT 1 FROM shops WHERE domain = ");
        q.push_bind(domain);
        if let Some(eid) = exclude_id { q.push(" AND id != ").push_bind(&eid.0); }
        let row = q.build().fetch_optional(&self.pool).await.map_err(|_| ShopRepoError::Internal)?;
        Ok(row.is_some())
    }
}

// Arc helper
pub type ShopRepoArc = Arc<ShopRepositorySqlx>;