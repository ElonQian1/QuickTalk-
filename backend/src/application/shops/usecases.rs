use sqlx::{SqlitePool, Row};
use crate::domain::shop::ShopAggregate;
use crate::domain::shop::shop_errors::ShopDomainError;

#[derive(Debug,thiserror::Error)]
pub enum ShopUseCaseError {
    #[error(transparent)] Domain(#[from] ShopDomainError),
    #[error("domain already exists")] DomainExists,
    #[error("not found")] NotFound,
    #[error("forbidden")] Forbidden,
    #[error("internal error")] Internal,
    #[error("nothing to update")] NothingToUpdate,
}

pub struct CreateShopInput {
    pub owner_id: String,
    pub name: String,
    pub domain: String,
}

pub struct CreateShopOutput { pub id: String, pub api_key: String, pub created_at: String }

pub async fn create_shop(db: &SqlitePool, input: CreateShopInput) -> Result<CreateShopOutput, ShopUseCaseError> {
    // 域名唯一性预检测
    if !input.domain.is_empty() {
        let existing = sqlx::query("SELECT 1 FROM shops WHERE domain = ?")
            .bind(&input.domain)
            .fetch_optional(db).await.map_err(|_| ShopUseCaseError::Internal)?;
        if existing.is_some() { return Err(ShopUseCaseError::DomainExists); }
    }
    let agg = ShopAggregate::create(input.owner_id, input.name, input.domain)?;
    let api_key = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO shops (id, name, domain, api_key, owner_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&agg.id.0)
        .bind(&agg.name)
        .bind(&agg.domain)
        .bind(&api_key)
        .bind(&agg.owner_id)
        .bind(&agg.status)
        .bind(agg.created_at.to_rfc3339())
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
    Ok(CreateShopOutput { id: agg.id.0, api_key, created_at: agg.created_at.to_rfc3339() })
}

pub struct UpdateShopInput { pub shop_id: String, pub actor_id: String, pub name: Option<String>, pub domain: Option<String> }

pub async fn update_shop(db: &SqlitePool, input: UpdateShopInput) -> Result<(), ShopUseCaseError> {
    // 读取并授权（简化：owner 或 super_admin）
    let row = sqlx::query("SELECT owner_id, name, domain FROM shops WHERE id = ?")
        .bind(&input.shop_id)
        .fetch_optional(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?
        .ok_or(ShopUseCaseError::NotFound)?;
    let owner_id: String = row.get("owner_id");
    let mut current_name: String = row.get("name");
    let mut current_domain: String = row.get("domain");
    if owner_id != input.actor_id {
        let role_row = sqlx::query("SELECT role FROM admins WHERE id = ?").bind(&input.actor_id).fetch_one(db).await.map_err(|_| ShopUseCaseError::Internal)?;
        let role: String = role_row.get("role");
        if role != "super_admin" { return Err(ShopUseCaseError::Forbidden); }
    }
    if input.name.is_none() && input.domain.is_none() { return Err(ShopUseCaseError::NothingToUpdate); }

    if let Some(ref n) = input.name { crate::domain::shop::shop_validation::validate_name(n).map_err(ShopUseCaseError::from)?; current_name = n.clone(); }
    if let Some(ref d) = input.domain { crate::domain::shop::shop_validation::validate_domain(d).map_err(ShopUseCaseError::from)?; current_domain = d.clone(); }
    if let Some(ref d) = input.domain { // 域名变更唯一性
        let exists = sqlx::query("SELECT 1 FROM shops WHERE domain = ? AND id != ?")
            .bind(d)
            .bind(&input.shop_id)
            .fetch_optional(db)
            .await
            .map_err(|_| ShopUseCaseError::Internal)?;
        if exists.is_some() { return Err(ShopUseCaseError::DomainExists); }
    }
    sqlx::query("UPDATE shops SET name = ?, domain = ? WHERE id = ?")
        .bind(&current_name)
        .bind(&current_domain)
        .bind(&input.shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
    Ok(())
}

// From impl not needed: handled by #[from] in enum variant