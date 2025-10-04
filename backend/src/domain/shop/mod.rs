pub mod shop_validation; // submodules declared here
pub mod shop_errors;
pub mod repository;
use crate::domain::shared::ids::ShopId;
use crate::domain::conversation::DomainEvent; // 临时与现有事件枚举共用，后续可抽取到统一模块
use chrono::{DateTime, Utc};
use crate::domain::shop::shop_validation::{validate_name, validate_domain};
use crate::domain::shop::shop_errors::ShopDomainError;

#[derive(Debug, Clone)]
pub struct ShopAggregate {
    pub id: ShopId,
    pub owner_id: String,
    pub name: String,
    pub domain: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub pending_events: Vec<DomainEvent>,
}

impl ShopAggregate {
    pub fn create(owner_id: String, name: String, domain: String) -> Result<Self, ShopDomainError> {
        validate_name(&name)?;
        validate_domain(&domain)?;
        let mut this = Self { id: ShopId::new(), owner_id, name, domain, status: "pending".into(), created_at: Utc::now(), pending_events: Vec::new() };
        this.pending_events.push(DomainEvent::ShopCreated { shop_id: this.id.0.clone() });
        Ok(this)
    }

    pub fn rename(&mut self, new_name: String) -> Result<(), ShopDomainError> {
        validate_name(&new_name)?;
        if self.name != new_name { // 仅在变更时产生事件
            self.name = new_name;
            self.pending_events.push(DomainEvent::ShopUpdated { shop_id: self.id.0.clone() });
        }
        Ok(())
    }

    pub fn change_domain(&mut self, new_domain: String) -> Result<(), ShopDomainError> {
        validate_domain(&new_domain)?;
        if self.domain != new_domain {
            self.domain = new_domain;
            self.pending_events.push(DomainEvent::ShopUpdated { shop_id: self.id.0.clone() });
        }
        Ok(())
    }

    pub fn approve(&mut self) -> Result<(), ShopDomainError> {
        if self.status != "pending" { return Err(ShopDomainError::InvalidStatusTransition(format!("{} -> approve", self.status))); }
        let old = self.status.clone();
        self.status = "approved".into();
        self.pending_events.push(DomainEvent::ShopStatusChanged { shop_id: self.id.0.clone(), old_status: old, new_status: self.status.clone() });
        Ok(())
    }
    pub fn reject(&mut self) -> Result<(), ShopDomainError> {
        if self.status != "pending" { return Err(ShopDomainError::InvalidStatusTransition(format!("{} -> reject", self.status))); }
        let old = self.status.clone();
        self.status = "rejected".into();
        self.pending_events.push(DomainEvent::ShopStatusChanged { shop_id: self.id.0.clone(), old_status: old, new_status: self.status.clone() });
        Ok(())
    }
    pub fn activate(&mut self) -> Result<(), ShopDomainError> {
        match self.status.as_str() {
            "approved" | "inactive" => { let old = self.status.clone(); self.status = "active".into(); self.pending_events.push(DomainEvent::ShopStatusChanged { shop_id: self.id.0.clone(), old_status: old, new_status: self.status.clone() }); Ok(()) },
            other => Err(ShopDomainError::InvalidStatusTransition(format!("{} -> active", other)))
        }
    }
    pub fn deactivate(&mut self) -> Result<(), ShopDomainError> {
        match self.status.as_str() {
            "active" => { let old = self.status.clone(); self.status = "inactive".into(); self.pending_events.push(DomainEvent::ShopStatusChanged { shop_id: self.id.0.clone(), old_status: old, new_status: self.status.clone() }); Ok(()) },
            other => Err(ShopDomainError::InvalidStatusTransition(format!("{} -> inactive", other)))
        }
    }
}

// 领域内用于从持久化重建聚合（只做必要校验，不触发规则）
impl ShopAggregate {
    pub fn reconstruct(id: ShopId, owner_id: String, name: String, domain: String, status: String, created_at: DateTime<Utc>) -> Self {
        Self { id, owner_id, name, domain, status, created_at, pending_events: Vec::new() }
    }
}

impl ShopAggregate {
    pub fn take_events(&mut self) -> Vec<DomainEvent> { std::mem::take(&mut self.pending_events) }
}
