use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag="type", content="payload")] 
pub enum WsClientMessage { Ping, Pong, Typing { conversation_id: String, user_id: String }, Read { conversation_id: String, message_ids: Vec<String> }, Send { conversation_id: String, content: String, message_type: String }, Auth { token: String }, JoinConversation { conversation_id: String }, LeaveConversation { conversation_id: String }, LoadHistory { conversation_id: String, before: Option<String> }, ErrorAck { error_id: String } }

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag="type", content="payload")] 
pub enum WsServerMessage { Welcome { connection_id: String, time: DateTime<Utc> }, Error { code: String, message: String }, MessageSent { conversation_id: String, message: crate::types::entities::Message }, MessageUpdated { conversation_id: String, message: crate::types::entities::Message }, MessageDeleted { conversation_id: String, message_id: String }, ConversationUpdated { conversation: crate::types::entities::Conversation }, Typing { conversation_id: String, user_id: String }, Read { conversation_id: String, message_ids: Vec<String> }, History { conversation_id: String, messages: Vec<crate::types::entities::Message> }, Pong { time: DateTime<Utc> }, Authenticated { user_id: String }, JoinedConversation { conversation_id: String }, LeftConversation { conversation_id: String } }
