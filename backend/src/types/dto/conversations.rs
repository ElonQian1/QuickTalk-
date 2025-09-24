use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
pub struct CreateConversationRequest { pub shop_id: String, pub customer_id: String }

#[derive(Deserialize)]
pub struct UpdateConversationStatusRequest { pub status: String }
