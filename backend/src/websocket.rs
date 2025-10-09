use axum::extract::ws::Message;
use std::collections::HashMap;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::models::WebSocketMessage;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectionUserType {
    Staff,
    Customer,
}

#[derive(Debug)]
pub struct ConnectionHandle {
    pub id: String,
    pub user_type: ConnectionUserType,
    pub sender: UnboundedSender<Message>,
    pub user_id: Option<i64>,
    pub shop_id: Option<i64>,
    pub customer_id: Option<String>,
}

#[derive(Debug)]
pub struct ConnectionManager {
    connections: HashMap<String, ConnectionHandle>,
    staff_connections: HashMap<i64, Vec<String>>, // staff_user_id -> connection_ids
    shop_staff_connections: HashMap<i64, Vec<String>>, // shop_id -> connection_ids
    customer_connections: HashMap<(i64, String), String>, // (shop_id, customer_code) -> connection_id
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            staff_connections: HashMap::new(),
            shop_staff_connections: HashMap::new(),
            customer_connections: HashMap::new(),
        }
    }

    pub fn add_staff_connection(
        &mut self,
        user_id: i64,
        shop_id: i64,
        sender: UnboundedSender<Message>,
    ) -> String {
        let connection_id = Uuid::new_v4().to_string();

        let handle = ConnectionHandle {
            id: connection_id.clone(),
            user_type: ConnectionUserType::Staff,
            sender,
            user_id: Some(user_id),
            shop_id: Some(shop_id),
            customer_id: None,
        };

        self.staff_connections
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(connection_id.clone());
        self.shop_staff_connections
            .entry(shop_id)
            .or_insert_with(Vec::new)
            .push(connection_id.clone());
        self.connections.insert(connection_id.clone(), handle);

        connection_id
    }

    pub fn add_customer_connection(
        &mut self,
        shop_id: i64,
        customer_id: &str,
        sender: UnboundedSender<Message>,
    ) -> String {
        let connection_id = Uuid::new_v4().to_string();

        let handle = ConnectionHandle {
            id: connection_id.clone(),
            user_type: ConnectionUserType::Customer,
            sender,
            user_id: None,
            shop_id: Some(shop_id),
            customer_id: Some(customer_id.to_string()),
        };

        self.customer_connections
            .insert((shop_id, customer_id.to_string()), connection_id.clone());
        self.connections.insert(connection_id.clone(), handle);

        connection_id
    }

    pub fn remove_connection(&mut self, connection_id: &str) {
        if let Some(handle) = self.connections.remove(connection_id) {
            match handle.user_type {
                ConnectionUserType::Staff => {
                    if let Some(user_id) = handle.user_id {
                        if let Some(pool) = self.staff_connections.get_mut(&user_id) {
                            pool.retain(|id| id != connection_id);
                            if pool.is_empty() {
                                self.staff_connections.remove(&user_id);
                            }
                        }
                    }
                    if let Some(shop_id) = handle.shop_id {
                        if let Some(pool) = self.shop_staff_connections.get_mut(&shop_id) {
                            pool.retain(|id| id != connection_id);
                            if pool.is_empty() {
                                self.shop_staff_connections.remove(&shop_id);
                            }
                        }
                    }
                }
                ConnectionUserType::Customer => {
                    if let (Some(shop_id), Some(customer_id)) = (handle.shop_id, handle.customer_id)
                    {
                        self.customer_connections.remove(&(shop_id, customer_id));
                    }
                }
            }
        }
    }

    pub fn is_customer_online(&self, shop_id: i64, customer_id: &str) -> bool {
        self.customer_connections
            .contains_key(&(shop_id, customer_id.to_string()))
    }

    pub fn is_staff_online(&self, user_id: i64) -> bool {
        self.staff_connections
            .get(&user_id)
            .map(|connections| !connections.is_empty())
            .unwrap_or(false)
    }

    pub fn send_to_customer(
        &mut self,
        shop_id: i64,
        customer_id: &str,
        message: &WebSocketMessage,
    ) {
        let conn_key = (shop_id, customer_id.to_string());
        if let Some(connection_id) = self.customer_connections.get(&conn_key) {
            if let Some(handle) = self.connections.get(connection_id) {
                if let Ok(msg) = serialize_message(message) {
                    let _ = handle.sender.send(msg);
                }
            }
        }
    }

    pub fn broadcast_to_staff(&mut self, shop_id: i64, message: &WebSocketMessage) {
        if let Some(connection_ids) = self.shop_staff_connections.get(&shop_id) {
            if let Ok(msg) = serialize_message(message) {
                for connection_id in connection_ids {
                    if let Some(handle) = self.connections.get(connection_id) {
                        let _ = handle.sender.send(msg.clone());
                    }
                }
            }
        }
    }

    pub fn send_to_staff_user(&mut self, user_id: i64, message: &WebSocketMessage) {
        if let Some(connection_ids) = self.staff_connections.get(&user_id) {
            if let Ok(msg) = serialize_message(message) {
                for connection_id in connection_ids {
                    if let Some(handle) = self.connections.get(connection_id) {
                        let _ = handle.sender.send(msg.clone());
                    }
                }
            }
        }
    }
}

fn serialize_message(message: &WebSocketMessage) -> Result<Message, serde_json::Error> {
    let payload = serde_json::to_string(message)?;
    Ok(Message::Text(payload))
}
