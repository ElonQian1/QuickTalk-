pub mod shop_validation; // submodules declared here
pub mod shop_errors;
use crate::domain::shared::ids::ShopId;
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
}

impl ShopAggregate {
    pub fn create(owner_id: String, name: String, domain: String) -> Result<Self, ShopDomainError> {
        validate_name(&name)?;
        validate_domain(&domain)?;
        Ok(Self { id: ShopId::new(), owner_id, name, domain, status: "pending".into(), created_at: Utc::now() })
    }

    pub fn rename(&mut self, new_name: String) -> Result<(), ShopDomainError> {
        validate_name(&new_name)?;
        self.name = new_name;
        Ok(())
    }

    pub fn change_domain(&mut self, new_domain: String) -> Result<(), ShopDomainError> {
        validate_domain(&new_domain)?;
        self.domain = new_domain;
        Ok(())
    }
}
