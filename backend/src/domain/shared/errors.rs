use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("empty message content")] EmptyMessage,
    #[error("invalid state transition")] InvalidState,
}
