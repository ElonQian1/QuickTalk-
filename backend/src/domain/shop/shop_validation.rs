use regex::Regex;
use super::shop_errors::ShopDomainError;

pub fn validate_name(name: &str) -> Result<(), ShopDomainError> {
    if name.trim().is_empty() { return Err(ShopDomainError::InvalidName("名称不能为空".into())); }
    if name.len() > 100 { return Err(ShopDomainError::InvalidName("名称长度不能超过100".into())); }
    Ok(())
}

pub fn validate_domain(domain: &str) -> Result<(), ShopDomainError> {
    if domain.trim().is_empty() { return Err(ShopDomainError::InvalidDomain("域名不能为空".into())); }
    if domain.len() > 120 { return Err(ShopDomainError::InvalidDomain("域名长度不能超过120".into())); }
    // 允许内部保留值 no-domain
    if domain == "no-domain" { return Ok(()); }
    let re = Regex::new(r"^[a-zA-Z0-9][a-zA-Z0-9\-]{1,60}(\.[a-zA-Z0-9\-]{1,25}){0,3}$").unwrap();
    if !re.is_match(domain) { return Err(ShopDomainError::InvalidDomain("域名格式不合法".into())); }
    Ok(())
}
