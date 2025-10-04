#[derive(Debug,thiserror::Error)]
pub enum AdminDomainError {
    #[error("email invalid: {0}")] EmailInvalid(&'static str),
}
