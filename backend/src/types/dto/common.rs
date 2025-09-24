use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct User { pub id: String, pub username: String, pub email: String, pub name: String, pub phone: Option<String>, pub avatar: Option<String>, pub role: String, pub status: String, pub created_at: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EmployeeInvitation { pub id: String, pub shop_id: String, pub inviter_id: String, pub invitee_email: String, pub invitee_id: Option<String>, pub role: String, pub message: Option<String>, pub token: String, pub status: String, pub expires_at: DateTime<Utc>, pub created_at: DateTime<Utc>, pub responded_at: Option<DateTime<Utc>> }
