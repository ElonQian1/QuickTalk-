use sqlx::SqlitePool;
use sqlx::Row;

pub async fn ensure_owner_or_super_admin(db: &SqlitePool, admin_id: &str, shop_id: &str) -> Result<(), AuthzError> {
    let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(admin_id)
        .fetch_one(db)
        .await
        .map_err(|_| AuthzError::Internal)?;
    let role: String = role_row.get("role");
    if role == "super_admin" { return Ok(()); }
    let own_row = sqlx::query("SELECT 1 FROM shops WHERE id = ? AND owner_id = ?")
        .bind(shop_id)
        .bind(admin_id)
        .fetch_optional(db)
        .await
        .map_err(|_| AuthzError::Internal)?;
    if own_row.is_some() { Ok(()) } else { Err(AuthzError::Forbidden) }
}

pub async fn get_role(db: &SqlitePool, admin_id: &str) -> Result<String, AuthzError> {
    let row = sqlx::query("SELECT role FROM admins WHERE id = ?")
        .bind(admin_id)
        .fetch_one(db)
        .await
        .map_err(|_| AuthzError::Internal)?;
    Ok(row.get::<String,_>("role"))
}

#[derive(Debug,thiserror::Error)]
pub enum AuthzError {
    #[error("forbidden")] Forbidden,
    #[error("internal")] Internal,
}