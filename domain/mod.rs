// 领域层模块 - Domain Layer
// 包含所有领域实体、值对象、仓储接口和领域服务

pub mod customer;
pub mod shop;
pub mod message;
pub mod conversation;

// 重新导出常用类型
pub use customer::{Customer, CustomerRepository};
pub use shop::{Shop, ShopRepository};
pub use message::{Message, MessageRepository, MessageType, SenderType};
pub use conversation::{Conversation, ConversationRepository, ConversationStatus};