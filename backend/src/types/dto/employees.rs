use serde::Deserialize;

#[derive(Deserialize, Debug, Clone)]
pub struct AddEmployeeRequest { pub email: String, pub role: String }

#[derive(Deserialize)]
pub struct UpdateEmployeeRequest { pub role: String }

#[derive(Deserialize, Debug, Clone)]
pub struct InviteEmployeeRequest { pub email: String, pub role: String, pub message: String }
