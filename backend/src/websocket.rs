use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug)]
pub struct Connection {
    pub id: String,
    pub user_type: String, // "staff" 或 "customer"
    pub user_id: Option<i64>,
    pub shop_id: Option<i64>,
    pub customer_id: Option<String>,
}

#[derive(Debug)]
pub struct ConnectionManager {
    connections: HashMap<String, Connection>,
    staff_connections: HashMap<i64, Vec<String>>, // user_id -> connection_ids
    customer_connections: HashMap<(i64, String), String>, // (shop_id, customer_id) -> connection_id
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: HashMap::new(),
            staff_connections: HashMap::new(),
            customer_connections: HashMap::new(),
        }
    }

    pub fn add_staff_connection(&mut self, user_id: i64) -> String {
        let connection_id = Uuid::new_v4().to_string();
        
        let connection = Connection {
            id: connection_id.clone(),
            user_type: "staff".to_string(),
            user_id: Some(user_id),
            shop_id: None,
            customer_id: None,
        };

        self.connections.insert(connection_id.clone(), connection);
        
        self.staff_connections
            .entry(user_id)
            .or_insert_with(Vec::new)
            .push(connection_id.clone());

        connection_id
    }

    pub fn add_customer_connection(&mut self, shop_id: i64, customer_id: &str) -> String {
        let connection_id = Uuid::new_v4().to_string();
        
        let connection = Connection {
            id: connection_id.clone(),
            user_type: "customer".to_string(),
            user_id: None,
            shop_id: Some(shop_id),
            customer_id: Some(customer_id.to_string()),
        };

        self.connections.insert(connection_id.clone(), connection);
        
        let key = (shop_id, customer_id.to_string());
        self.customer_connections.insert(key, connection_id.clone());

        connection_id
    }

    pub fn remove_connection(&mut self, connection_id: &str) {
        if let Some(connection) = self.connections.remove(connection_id) {
            match connection.user_type.as_str() {
                "staff" => {
                    if let Some(user_id) = connection.user_id {
                        if let Some(connections) = self.staff_connections.get_mut(&user_id) {
                            connections.retain(|id| id != connection_id);
                            if connections.is_empty() {
                                self.staff_connections.remove(&user_id);
                            }
                        }
                    }
                }
                "customer" => {
                    if let (Some(shop_id), Some(customer_id)) = (connection.shop_id, &connection.customer_id) {
                        let key = (shop_id, customer_id.clone());
                        self.customer_connections.remove(&key);
                    }
                }
                _ => {}
            }
        }
    }

    pub fn get_staff_connections(&self, user_id: i64) -> Vec<String> {
        self.staff_connections
            .get(&user_id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn get_customer_connection(&self, shop_id: i64, customer_id: &str) -> Option<String> {
        let key = (shop_id, customer_id.to_string());
        self.customer_connections.get(&key).cloned()
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<&Connection> {
        self.connections.get(connection_id)
    }

    pub fn is_online(&self, user_type: &str, user_id: Option<i64>, shop_id: Option<i64>, customer_id: Option<&str>) -> bool {
        match user_type {
            "staff" => {
                if let Some(uid) = user_id {
                    !self.get_staff_connections(uid).is_empty()
                } else {
                    false
                }
            }
            "customer" => {
                if let (Some(sid), Some(cid)) = (shop_id, customer_id) {
                    self.get_customer_connection(sid, cid).is_some()
                } else {
                    false
                }
            }
            _ => false,
        }
    }
}