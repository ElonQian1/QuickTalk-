//! Repository 数据访问层
//! 
//! 职责：
//! - 封装所有数据库 CRUD 操作
//! - 提供类型安全的查询接口
//! - 隔离业务逻辑与数据访问
//! 
//! 架构：每个实体一个 repository 模块

pub mod user;
pub mod shop;
pub mod customer;
pub mod session;
pub mod message;
pub mod shop_staff;
pub mod unread_count_repository;

pub use user::UserRepository;
pub use shop::ShopRepository;
pub use customer::CustomerRepository;
pub use session::SessionRepository;
pub use message::MessageRepository;
pub use shop_staff::ShopStaffRepository;
pub use unread_count_repository::UnreadCountRepository;
