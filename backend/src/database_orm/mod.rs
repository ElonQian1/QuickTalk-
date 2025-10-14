//! Sea-ORM 数据库连接和配置模块
//! 
//! 职责：
//! - 管理 DatabaseConnection
//! - 运行迁移
//! - 提供统一的数据库访问接口

pub mod connection;
pub mod migration;

pub use connection::Database;
pub use migration::run_migrations;
