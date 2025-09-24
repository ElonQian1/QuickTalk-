use chrono::Utc;
use quicktalk_pure_rust::domain::conversation::*;
use quicktalk_pure_rust::application::usecases::send_message::{SendMessageUseCase, SendMessageInput};
use quicktalk_pure_rust::application::usecases::update_message::{UpdateMessageUseCase, UpdateMessageInput};
use quicktalk_pure_rust::application::usecases::delete_message::{DeleteMessageUseCase, DeleteMessageInput};
use quicktalk_pure_rust::application::events::serialization::serialize_event;
use quicktalk_pure_rust::db::in_memory::InMemoryMessageRepository;
use quicktalk_pure_rust::domain::conversation::InMemoryConversationRepo;

fn seed_conversation(repo: &InMemoryConversationRepo) -> ConversationId {
    let cid = ConversationId("c-seed".into());
    let convo = Conversation::new(cid.clone(), "shop1".into(), "cust1".into(), "active".into(), Utc::now());
    repo.insert(convo);
    cid
}

#[tokio::test]
async fn send_update_delete_flow_generates_events_with_metadata() {
    // 1. 会话 + 发送消息 (触发 MessageAppended 领域事件)
    let conv_repo = InMemoryConversationRepo::new();
    let cid = seed_conversation(&conv_repo);
    let send_uc = SendMessageUseCase::new(conv_repo);
    let out = send_uc.exec(SendMessageInput { conversation_id: cid.0.clone(), sender_id: "u1".into(), sender_type: "customer".into(), content: "hello".into(), message_type: "text".into() }).await.expect("send message");
    assert_eq!(out.events.len(), 1, "append should emit single event");
    let msg_id = out.message_id.clone();

    // 2. 构造消息存储并执行更新 (MessageUpdated)
    let msg_repo_for_update = InMemoryMessageRepository::new();
    let domain_msg = Message::new(
        MessageId(msg_id.clone()),
        ConversationId(cid.0.clone()),
        "u1".into(),
        SenderType::Customer,
        "hello".into(),
        "text".into(),
        Utc::now()
    ).unwrap();
    msg_repo_for_update.store().insert_domain(&domain_msg);
    let update_uc = UpdateMessageUseCase::new(msg_repo_for_update);
    let upd = update_uc.exec(UpdateMessageInput { message_id: msg_id.clone(), new_content: "edited".into() }).await.expect("update");
    let update_event = upd.events[0].clone();
    matches!(&update_event, DomainEvent::MessageUpdated { .. });

    // 3. 单独的新仓库模拟已经更新后的消息再执行软删除 (MessageDeleted)
    let msg_repo_for_delete = InMemoryMessageRepository::new();
    let updated_msg = Message::new(
        MessageId(msg_id.clone()),
        ConversationId(cid.0.clone()),
        "u1".into(),
        SenderType::Customer,
        "edited".into(),
        "text".into(),
        Utc::now()
    ).unwrap();
    msg_repo_for_delete.store().insert_domain(&updated_msg);
    let delete_uc = DeleteMessageUseCase::new(msg_repo_for_delete);
    let del = delete_uc.exec(DeleteMessageInput { message_id: msg_id.clone(), hard: false }).await.expect("delete");
    let delete_event = del.events[0].clone();
    match &delete_event { DomainEvent::MessageDeleted { soft, .. } => assert!(*soft, "should be soft delete"), _ => panic!("unexpected event kind") }

    // 4. 序列化两个事件 -> Envelope v1，断言 event_id / emitted_at 格式与时间顺序 (非严格 <，允许同一毫秒)
    let env_update = serialize_event(update_event, None);
    let env_delete = serialize_event(delete_event, None);
    let id1 = env_update["event_id"].as_str().unwrap();
    let id2 = env_delete["event_id"].as_str().unwrap();
    assert_ne!(id1, id2, "event ids must differ");
    let t1 = env_update["emitted_at"].as_str().unwrap();
    let t2 = env_delete["emitted_at"].as_str().unwrap();
    assert!(t1 <= t2, "emitted_at should be non-decreasing");
}

