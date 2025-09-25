#[derive(thiserror::Error, Debug)]
pub enum ShopDomainError {
    #[error("无效店铺名称: {0}")] InvalidName(String),
    #[error("无效域名: {0}")] InvalidDomain(String),
}
