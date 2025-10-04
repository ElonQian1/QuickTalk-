use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Username(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(pub String);

impl Email {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.is_empty() { return Err("email empty"); }
        if !raw.contains('@') { return Err("email format invalid"); }
        Ok(Self(raw.to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdminRole { SuperAdmin, User, Other(String) }

impl AdminRole {
    pub fn from_str(s: &str) -> Self {
        match s { "super_admin" => Self::SuperAdmin, "user" => Self::User, other => Self::Other(other.to_string()) }
    }
    pub fn as_str(&self) -> &str { match self { Self::SuperAdmin => "super_admin", Self::User => "user", Self::Other(o) => o.as_str() } }
}

#[derive(Debug, Clone)]
pub struct Admin {
    pub id: AdminId,
    pub username: Username,
    pub role: AdminRole,
    pub email: Option<Email>,
    pub created_at: DateTime<Utc>,
}

impl Admin {
    pub fn update_email(&mut self, email: Option<Email>) { self.email = email; }
}
