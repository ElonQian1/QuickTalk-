#[derive(thiserror::Error, Debug)]
pub enum ShopDomainError {
    #[error("无效店铺名称: {0}")] InvalidName(String),
    #[error("无效域名: {0}")] InvalidDomain(String),
    #[error("当前状态不允许该操作: {0}")] InvalidStatusTransition(String),
}
