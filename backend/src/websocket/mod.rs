// Purpose: WebSocket 模块入口与公共导出
// Exports: ConnectionManager, handle_customer_ws_message, handle_staff_ws_message, CustomerWsCtx

pub mod manager;
pub mod handlers;

pub use manager::ConnectionManager;
pub use handlers::{handle_customer_ws_message, handle_staff_ws_message, CustomerWsCtx};
