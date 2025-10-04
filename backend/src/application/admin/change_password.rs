use crate::domain::admin::repository::{AdminRepository, AdminRepoError};
use crate::domain::admin::model::AdminId;

#[derive(Debug,thiserror::Error)]
pub enum ChangePasswordError {
    #[error(transparent)] Repo(#[from] AdminRepoError),
    #[error("validation: password too short")] Short,
}

pub struct ChangePasswordInput { pub admin_id: String, pub new_hash: String }

pub async fn change_password<R: AdminRepository>(repo: &R, input: ChangePasswordInput) -> Result<(), ChangePasswordError> {
    if input.new_hash.len() < 10 { return Err(ChangePasswordError::Short); }
    let id = AdminId(input.admin_id);
    repo.update_password_hash(&id, &input.new_hash).await?;
    repo.invalidate_sessions(&id).await?;
    Ok(())
}
