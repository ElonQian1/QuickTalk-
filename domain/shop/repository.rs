// 商店仓储接口
use async_trait::async_trait;
use crate::domain::shop::entity::Shop;

#[async_trait]
pub trait ShopRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Shop>, Box<dyn std::error::Error>>;
    async fn find_by_api_key(&self, api_key: &str) -> Result<Option<Shop>, Box<dyn std::error::Error>>;
    async fn find_by_domain(&self, domain: &str) -> Result<Option<Shop>, Box<dyn std::error::Error>>;
    async fn save(&self, shop: &Shop) -> Result<(), Box<dyn std::error::Error>>;
    async fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>>;
    async fn find_all(&self) -> Result<Vec<Shop>, Box<dyn std::error::Error>>;
}