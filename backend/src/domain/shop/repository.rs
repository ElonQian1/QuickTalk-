use async_trait::async_trait;
use crate::domain::shared::ids::ShopId;
use super::ShopAggregate;

#[derive(Debug,thiserror::Error)]
pub enum ShopRepoError {
    #[error("not found")] NotFound,
    #[error("internal repo error")] Internal,
    #[error("conflict")] Conflict,
}

#[async_trait]
pub trait ShopRepository: Send + Sync {
    async fn find_by_id(&self, id: &ShopId) -> Result<ShopAggregate, ShopRepoError>;
    async fn save(&self, shop: &ShopAggregate) -> Result<(), ShopRepoError>;
    async fn exists_domain(&self, domain: &str, exclude_id: Option<&ShopId>) -> Result<bool, ShopRepoError>;
}

// 简单内存实现（测试/用例层可用）
pub struct InMemoryShopRepository {
    inner: std::sync::RwLock<std::collections::HashMap<String, ShopAggregate>>,
}
impl InMemoryShopRepository { pub fn new() -> Self { Self { inner: Default::default() } } }
#[async_trait]
impl ShopRepository for InMemoryShopRepository {
    async fn find_by_id(&self, id: &ShopId) -> Result<ShopAggregate, ShopRepoError> {
        self.inner.read().unwrap().get(&id.0).cloned().ok_or(ShopRepoError::NotFound)
    }
    async fn save(&self, shop: &ShopAggregate) -> Result<(), ShopRepoError> {
        self.inner.write().unwrap().insert(shop.id.0.clone(), shop.clone());
        Ok(())
    }
    async fn exists_domain(&self, domain: &str, exclude_id: Option<&ShopId>) -> Result<bool, ShopRepoError> {
        let map = self.inner.read().unwrap();
        Ok(map.values().any(|s| s.domain == domain && exclude_id.map(|e| e.0.as_str()) != Some(s.id.0.as_str())))
    }
}
