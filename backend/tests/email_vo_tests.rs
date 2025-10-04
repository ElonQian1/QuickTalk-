use quicktalk_pure_rust::domain::admin::model::Email;

#[test]
fn email_parse_ok() {
    let e = Email::parse("user@example.com").unwrap();
    assert_eq!(e.0, "user@example.com");
}

#[test]
fn email_parse_invalid() {
    assert!(Email::parse("invalid").is_err());
    assert!(Email::parse("").is_err());
}
