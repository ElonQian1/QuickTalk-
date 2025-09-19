// 消息仓储接口
use async_trait::async_trait;
use crate::domain::message::entity::Message;

#[async_trait]
pub trait MessageRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<Message>, Box<dyn std::error::Error>>;
    async fn find_by_conversation(&self, conversation_id: &str) -> Result<Vec<Message>, Box<dyn std::error::Error>>;
    async fn find_by_shop(&self, shop_id: &str, limit: Option<u32>) -> Result<Vec<Message>, Box<dyn std::error::Error>>;
    async fn save(&self, message: &Message) -> Result<(), Box<dyn std::error::Error>>;
    async fn delete(&self, id: &str) -> Result<(), Box<dyn std::error::Error>>;
    async fn count_unread_by_conversation(&self, conversation_id: &str) -> Result<u64, Box<dyn std::error::Error>>;
    async fn mark_as_read(&self, conversation_id: &str, reader_id: &str) -> Result<(), Box<dyn std::error::Error>>;
}