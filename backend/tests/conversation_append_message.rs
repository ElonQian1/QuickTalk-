use backend::domain::conversation::{Conversation, ConversationId, Message, MessageId, SenderType};
use chrono::Utc;

#[test]
fn append_message_adds_message_and_event() {
    let mut convo = Conversation::new(ConversationId("c1".into()), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    let msg = Message::new(MessageId("m1".into()), convo.id.clone(), "cust1".into(), SenderType::Customer, "hello".into(), "text".into(), Utc::now()).unwrap();
    assert_eq!(convo.messages.len(), 0);
    convo.append_message(msg).unwrap();
    assert_eq!(convo.messages.len(), 1);
    let events = convo.take_events();
    assert_eq!(events.len(), 1);
}
