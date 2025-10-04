use crate::domain::admin::repository::{AdminRepository, AdminRepoError};
use crate::domain::admin::model::{AdminId, Email};

#[derive(Debug,thiserror::Error)]
pub enum UpdateProfileError {
    #[error(transparent)] Repo(#[from] AdminRepoError),
    #[error("email invalid: {0}")] EmailInvalid(&'static str),
}

pub struct UpdateProfileInput { pub admin_id: String, pub email: Option<String> }

pub async fn update_profile<R: AdminRepository>(repo: &R, input: UpdateProfileInput) -> Result<(), UpdateProfileError> {
    let id = AdminId(input.admin_id);
    let email_vo = if let Some(e) = input.email { Some(Email::parse(&e).map_err(UpdateProfileError::EmailInvalid)?) } else { None };
    repo.update_email(&id, email_vo).await?;
    Ok(())
}
