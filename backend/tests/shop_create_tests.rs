use quicktalk_pure_rust::domain::shop::{shop_errors::ShopDomainError, ShopAggregate};

#[test]
fn create_shop_success() {
    let agg = ShopAggregate::create("owner1".into(), "测试店铺".into(), "example.com".into()).unwrap();
    assert_eq!(agg.status, "pending");
}

#[test]
fn invalid_name_rejected() {
    let err = ShopAggregate::create("o".into(), "".into(), "example.com".into()).unwrap_err();
    match err { ShopDomainError::InvalidName(_) => {}, _ => panic!("期待 InvalidName") }
}

#[test]
fn invalid_domain_rejected() {
    let err = ShopAggregate::create("o".into(), "店铺".into(), "@@@".into()).unwrap_err();
    match err { ShopDomainError::InvalidDomain(_) => {}, _ => panic!("期待 InvalidDomain") }
}
