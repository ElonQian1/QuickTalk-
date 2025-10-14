//! Services 业务逻辑层
//! 
//! 职责：
//! - 协调多个 Repository 的调用
//! - 实现业务规则和验证
//! - 处理权限控制
//! - 提供高级查询和统计

pub mod chat;
pub mod dashboard;
pub mod staff;
pub mod metrics;
pub mod shop_utils;
pub mod permissions;

// 新的模块化 Services
pub mod user_service;
pub mod shop_service;
pub mod customer_service;
pub mod session_service;
pub mod message_service;

// 统一导出
pub use user_service::UserService;
pub use shop_service::ShopService;
pub use customer_service::CustomerService;
pub use session_service::SessionService;
pub use message_service::MessageService;
