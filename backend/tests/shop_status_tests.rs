use quicktalk_pure_rust::domain::shop::ShopAggregate;
use quicktalk_pure_rust::domain::conversation::DomainEvent; // 临时事件枚举位置
use quicktalk_pure_rust::domain::shop::shop_errors::ShopDomainError;

#[test]
fn approve_happy_path() {
    let mut s = ShopAggregate::create("o1".into(), "Name".into(), "domain.com".into()).unwrap();
    let created_events = s.take_events();
    assert!(matches!(created_events[0], DomainEvent::ShopCreated { .. }));
    s.approve().unwrap();
    let evs = s.take_events();
    assert!(evs.iter().any(|e| matches!(e, DomainEvent::ShopStatusChanged { new_status, .. } if new_status == "approved")));
    assert_eq!(s.status, "approved");
}

#[test]
fn approve_invalid_transition() {
    let mut s = ShopAggregate::create("o1".into(), "Name".into(), "domain.com".into()).unwrap();
    s.reject().unwrap();
    // consume events
    s.take_events();
    let e = s.approve().unwrap_err();
    matches!(e, ShopDomainError::InvalidStatusTransition(_));
}

#[test]
fn activate_requires_approved_or_inactive() {
    let mut s = ShopAggregate::create("o1".into(), "Name".into(), "domain.com".into()).unwrap();
    // pending -> active 不允许
    let e = s.activate().unwrap_err();
    matches!(e, ShopDomainError::InvalidStatusTransition(_));
    s.approve().unwrap();
    s.take_events(); // drop approve event
    s.activate().unwrap();
    assert_eq!(s.status, "active");
    s.deactivate().unwrap();
    assert_eq!(s.status, "inactive");
    s.activate().unwrap();
    assert_eq!(s.status, "active");
}
