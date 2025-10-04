use sqlx::{SqlitePool, Row};
use crate::domain::shop::ShopAggregate;
use crate::domain::shop::shop_errors::ShopDomainError;
use crate::domain::shop::repository::ShopRepository; // 新增: 逐步引入仓库抽象
use crate::application::shops::authz::ShopPermissionService;
use crate::domain::conversation::DomainEvent; // 临时复用事件枚举
// NOTE: create_shop 已开始通过传入仓库 trait 对象的方式重构；update_shop 暂保留直连 SQL 以便增量迁移。

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

// 新版本：通过仓库 trait 进行唯一性检查与持久化 (仍需要直接写入 api_key，因此保留一次性插入 SQL，后续再抽象)
pub async fn create_shop<R: ShopRepository>(db: &SqlitePool, repo: &R, input: CreateShopInput) -> Result<(CreateShopOutput, Vec<DomainEvent>), ShopUseCaseError> {
    if !input.domain.is_empty() {
        let exists = repo.exists_domain(&input.domain, None).await.map_err(|_| ShopUseCaseError::Internal)?;
        if exists { return Err(ShopUseCaseError::DomainExists); }
    }
    let mut agg = ShopAggregate::create(input.owner_id, input.name, input.domain)?;
    let api_key = uuid::Uuid::new_v4().to_string();
    // 直接插入（save() 只处理更新/幂等写入，此处需要写 api_key）
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
        .map_err(|e| {
            // 唯一性竞争条件兜底
            if let sqlx::Error::Database(dbe) = &e { if dbe.message().contains("UNIQUE") { return ShopUseCaseError::DomainExists; } }
            ShopUseCaseError::Internal
        })?;
    let events = agg.take_events();
    Ok((CreateShopOutput { id: agg.id.0.clone(), api_key, created_at: agg.created_at.to_rfc3339() }, events))
}

pub struct UpdateShopInput { pub shop_id: String, pub actor_id: String, pub name: Option<String>, pub domain: Option<String> }

pub async fn update_shop<R: ShopRepository, P: ShopPermissionService>(db: &SqlitePool, repo: &R, perm: &P, input: UpdateShopInput) -> Result<Vec<DomainEvent>, ShopUseCaseError> {
    // 读取聚合（需 repo.find_by_id 后重查补充 name/domain）
    // 现有 repo 尚未提供直接 load；这里仍通过 SQL 读取一次再重建聚合
    let row = sqlx::query("SELECT owner_id, name, domain, status, created_at FROM shops WHERE id = ?")
        .bind(&input.shop_id)
        .fetch_optional(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?
        .ok_or(ShopUseCaseError::NotFound)?;
    let owner_id: String = row.get("owner_id");
    let mut name: String = row.get("name");
    let mut domain: String = row.get("domain");
    let _status_for_debug: String = row.get("status");
    let _created_at: String = row.get("created_at");
    if owner_id != input.actor_id {
        if !perm.is_super_admin(&input.actor_id).await.map_err(|_| ShopUseCaseError::Internal)? { return Err(ShopUseCaseError::Forbidden); }
    }
    if input.name.is_none() && input.domain.is_none() { return Err(ShopUseCaseError::NothingToUpdate); }

    if let Some(ref n) = input.name { crate::domain::shop::shop_validation::validate_name(n).map_err(ShopUseCaseError::from)?; name = n.clone(); }
    if let Some(ref d) = input.domain { crate::domain::shop::shop_validation::validate_domain(d).map_err(ShopUseCaseError::from)?; domain = d.clone(); }
    if let Some(ref d) = input.domain {
        let exists = repo.exists_domain(d, Some(&crate::domain::shared::ids::ShopId(input.shop_id.clone()))).await.map_err(|_| ShopUseCaseError::Internal)?;
        if exists { return Err(ShopUseCaseError::DomainExists); }
    }
    // 持久化（暂直接 UPDATE; save() 的 upsert 行为不适合部分字段）
    sqlx::query("UPDATE shops SET name = ?, domain = ? WHERE id = ?")
        .bind(&name)
        .bind(&domain)
        .bind(&input.shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
    // 生成事件（聚合暂未完全驱动 update，手动构造）
    let events = vec![DomainEvent::ShopUpdated { shop_id: input.shop_id }];
    Ok(events)
}

// ---- 状态变更用例（暂仍直连 SQL; 下阶段替换为仓库抽象） ----
async fn load_shop_basic(db: &SqlitePool, id: &str) -> Result<(String,String,String,String), ShopUseCaseError> {
    let row = sqlx::query("SELECT owner_id, name, domain, status FROM shops WHERE id = ?")
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?
        .ok_or(ShopUseCaseError::NotFound)?;
    Ok((row.get("owner_id"), row.get("name"), row.get("domain"), row.get("status")))
}

async fn ensure_super_admin_or_owner(db: &SqlitePool, actor: &str, owner_id: &str) -> Result<(), ShopUseCaseError> {
    if owner_id == actor { return Ok(()); }
    let row = sqlx::query("SELECT role FROM admins WHERE id = ?").bind(actor).fetch_one(db).await.map_err(|_| ShopUseCaseError::Internal)?;
    let role: String = row.get("role");
    if role == "super_admin" { Ok(()) } else { Err(ShopUseCaseError::Forbidden) }
}

pub async fn approve_shop<P: ShopPermissionService>(db: &SqlitePool, perm: &P, shop_id: &str, actor: &str) -> Result<Vec<DomainEvent>, ShopUseCaseError> {
    let (owner_id, name, domain, status) = load_shop_basic(db, shop_id).await?;
    if owner_id != actor { if !perm.is_super_admin(actor).await.map_err(|_| ShopUseCaseError::Internal)? { return Err(ShopUseCaseError::Forbidden); } }
    let mut agg = ShopAggregate { id: crate::domain::shared::ids::ShopId(shop_id.to_string()), owner_id, name, domain, status, created_at: chrono::Utc::now(), pending_events: Vec::new() }; // created_at 无需精确
    agg.approve().map_err(ShopUseCaseError::from)?;
    sqlx::query("UPDATE shops SET status = ? WHERE id = ?")
        .bind(&agg.status)
        .bind(shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
    let ev = DomainEvent::ShopStatusChanged { shop_id: shop_id.to_string(), old_status: "pending".into(), new_status: agg.status }; // old_status 粗略（为最小实现）
    Ok(vec![ev])
}

pub async fn reject_shop<P: ShopPermissionService>(db: &SqlitePool, perm: &P, shop_id: &str, actor: &str) -> Result<Vec<DomainEvent>, ShopUseCaseError> {
    let (owner_id, name, domain, status) = load_shop_basic(db, shop_id).await?;
    if owner_id != actor { if !perm.is_super_admin(actor).await.map_err(|_| ShopUseCaseError::Internal)? { return Err(ShopUseCaseError::Forbidden); } }
    let mut agg = ShopAggregate { id: crate::domain::shared::ids::ShopId(shop_id.to_string()), owner_id, name, domain, status, created_at: chrono::Utc::now(), pending_events: Vec::new() };
    agg.reject().map_err(ShopUseCaseError::from)?;
    sqlx::query("UPDATE shops SET status = ? WHERE id = ?")
        .bind(&agg.status)
        .bind(shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
    let ev = DomainEvent::ShopStatusChanged { shop_id: shop_id.to_string(), old_status: "pending".into(), new_status: agg.status };
    Ok(vec![ev])
}

pub async fn activate_shop_usecase<P: ShopPermissionService>(db: &SqlitePool, perm: &P, shop_id: &str, actor: &str) -> Result<Vec<DomainEvent>, ShopUseCaseError> {
    let (owner_id, name, domain, status) = load_shop_basic(db, shop_id).await?;
    if owner_id != actor { if !perm.is_super_admin(actor).await.map_err(|_| ShopUseCaseError::Internal)? { return Err(ShopUseCaseError::Forbidden); } }
    let old_status_clone = status.clone();
    let mut agg = ShopAggregate { id: crate::domain::shared::ids::ShopId(shop_id.to_string()), owner_id, name, domain, status, created_at: chrono::Utc::now(), pending_events: Vec::new() };
    agg.activate().map_err(ShopUseCaseError::from)?;
    sqlx::query("UPDATE shops SET status = ? WHERE id = ?")
        .bind(&agg.status)
        .bind(shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
        let ev = DomainEvent::ShopStatusChanged { shop_id: shop_id.to_string(), old_status: old_status_clone, new_status: agg.status.clone() };
    Ok(vec![ev])
}

pub async fn deactivate_shop_usecase<P: ShopPermissionService>(db: &SqlitePool, perm: &P, shop_id: &str, actor: &str) -> Result<Vec<DomainEvent>, ShopUseCaseError> {
    let (owner_id, name, domain, status) = load_shop_basic(db, shop_id).await?;
    if owner_id != actor { if !perm.is_super_admin(actor).await.map_err(|_| ShopUseCaseError::Internal)? { return Err(ShopUseCaseError::Forbidden); } }
    let old_status_clone2 = status.clone();
    let mut agg = ShopAggregate { id: crate::domain::shared::ids::ShopId(shop_id.to_string()), owner_id, name, domain, status, created_at: chrono::Utc::now(), pending_events: Vec::new() };
    agg.deactivate().map_err(ShopUseCaseError::from)?;
    sqlx::query("UPDATE shops SET status = ? WHERE id = ?")
        .bind(&agg.status)
        .bind(shop_id)
        .execute(db)
        .await
        .map_err(|_| ShopUseCaseError::Internal)?;
        let ev = DomainEvent::ShopStatusChanged { shop_id: shop_id.to_string(), old_status: old_status_clone2, new_status: agg.status.clone() };
    Ok(vec![ev])
}

// From impl not needed: handled by #[from] in enum variant