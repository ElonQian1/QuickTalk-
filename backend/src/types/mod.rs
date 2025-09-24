pub mod entities;
pub mod ws;
#[allow(dead_code)]
pub mod dto {
	pub mod conversations;
	pub mod messages;
	pub mod shops;
	pub mod payments;
	pub mod employees;
	pub mod auth;
	pub mod embed;
	pub mod common;
}

pub use entities::*; // frequently used domain-neutral entities
pub use ws::*;       // websocket message types remain easily accessible

use serde::{Serialize, Deserialize};
// Standard API wrapper (remains here; AppState moved to bootstrap::app_state)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApiResponse<T> { pub success: bool, pub data: Option<T>, pub message: String }
