#[derive(Debug, Clone)]
pub enum AdminEvent {
    ProfileUpdated { admin_id: String },
    PasswordChanged { admin_id: String },
}
