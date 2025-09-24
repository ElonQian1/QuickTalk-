use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
pub struct CreateMessageRequest { pub conversation_id: String, pub sender_id: String, pub sender_type: String, pub content: String, pub message_type: String }

#[derive(Deserialize)]
pub struct UpdateMessageRequest { pub content: String }
