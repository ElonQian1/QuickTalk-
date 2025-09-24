// 客户仓储接口
use async_trait::async_trait;
use crate::domain::customer::entity::Customer;

#[async_trait]
pub trait CustomerRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Customer>, Box<dyn std::error::Error>>;
    async fn find_by_email(&self, email: &str) -> Result<Option<Customer>, Box<dyn std::error::Error>>;
    async fn save(&self, customer: &Customer) -> Result<(), Box<dyn std::error::Error>>;
    async fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>>;
    async fn find_all(&self) -> Result<Vec<Customer>, Box<dyn std::error::Error>>;
}