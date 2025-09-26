pub mod types; // folder module with entities/dto/ws
pub mod api;
pub mod web;
pub mod ws;
pub mod bootstrap;
pub mod domain;
pub mod db;
pub mod application;
pub mod auth; // 暴露鉴权模块供 API 使用

// Re-export commonly used types at crate root for backward compatibility
pub use types::{ApiResponse, entities::*, ws::*};
// DTO 不再全部顶层导出，按需路径: crate::types::dto::<module>::Type
pub use bootstrap::app_state::AppState; // ensure re-export
