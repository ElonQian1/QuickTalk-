// 对话仓储接口
use async_trait::async_trait;
use crate::domain::conversation::entity::{Conversation, ConversationSummary};

#[async_trait]
pub trait ConversationRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Conversation>, Box<dyn std::error::Error>>;
    async fn find_by_shop(&self, shop_id: &str) -> Result<Vec<Conversation>, Box<dyn std::error::Error>>;
    async fn find_by_customer(&self, shop_id: &str, customer_id: &str) -> Result<Option<Conversation>, Box<dyn std::error::Error>>;
    async fn find_active_by_shop(&self, shop_id: &str) -> Result<Vec<Conversation>, Box<dyn std::error::Error>>;
    async fn save(&self, conversation: &Conversation) -> Result<(), Box<dyn std::error::Error>>;
    async fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>>;
    async fn get_summaries_by_shop(&self, shop_id: &str) -> Result<Vec<ConversationSummary>, Box<dyn std::error::Error>>;
}