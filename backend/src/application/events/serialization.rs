// 事件序列化：将领域事件转换为统一 Envelope JSON。
// Envelope v1 (扩展版) 结构：
// {
//   "version": "v1",
//   "type": "domain.event.message_appended",
//   "event_id": "<UUID v4>",          // 全局唯一，客户端可用于去重 / 幂等
//   "emitted_at": "<RFC3339 UTC>",    // 服务端生成的发送时间；排序辅助字段
//   "data": { ... 事件特定载荷 ... }
// }
// 新增 event_id / emitted_at 为兼容性增强（纯新增字段，不修改 version）。
// 客户端策略建议：
// 1. 去重：维护最近 N 个 event_id (LRU / Set)
// 2. 排序：同会话内优先按业务字段（如 message.timestamp），相同时间再按 emitted_at
// 3. 容错：未知字段忽略，未知 type 跳过
use crate::domain::conversation::{DomainEvent, ConversationId, MessageId};
use super::event_types::{
    MESSAGE_APPENDED, MESSAGE_UPDATED, MESSAGE_DELETED,
    CONVERSATION_OPENED, CONVERSATION_CLOSED, CONVERSATION_REOPENED
};
use serde_json::Value;
use chrono::Utc;
use uuid::Uuid;

// 事件版本号：v1 (Envelope: {version,type,data})
const EVENT_VERSION: &str = "v1";

pub fn serialize_event(ev: DomainEvent, enrich: Option<Value>) -> Value {
    match ev {
        DomainEvent::MessageAppended { conversation_id, message_id } => base(MESSAGE_APPENDED, conversation_id, message_id, enrich),
        DomainEvent::MessageUpdated { conversation_id, message_id } => base(MESSAGE_UPDATED, conversation_id, message_id, enrich),
        DomainEvent::MessageDeleted { conversation_id, message_id, soft } => {
            let mut data = enrich.unwrap_or_else(|| serde_json::json!({}));
            merge_core(&mut data, &conversation_id, &message_id);
            data["soft"] = serde_json::json!(soft);
            envelope(MESSAGE_DELETED, data)
        }
        DomainEvent::ConversationOpened { conversation_id } => simple_no_msg(CONVERSATION_OPENED, conversation_id),
        DomainEvent::ConversationClosed { conversation_id } => simple_no_msg(CONVERSATION_CLOSED, conversation_id),
        DomainEvent::ConversationReopened { conversation_id } => simple_no_msg(CONVERSATION_REOPENED, conversation_id),
    }
}

fn base(event_type: &str, conversation_id: ConversationId, message_id: MessageId, enrich: Option<Value>) -> Value {
    let mut data = enrich.unwrap_or_else(|| serde_json::json!({}));
    merge_core(&mut data, &conversation_id, &message_id);
    envelope(event_type, data)
}

fn merge_core(target: &mut Value, conversation_id: &ConversationId, message_id: &MessageId) {
    target["conversation_id"] = serde_json::json!(conversation_id.0);
    target["message_id"] = serde_json::json!(message_id.0);
}

fn simple_no_msg(event_type: &str, conversation_id: ConversationId) -> Value {
    envelope(event_type, serde_json::json!({"conversation_id": conversation_id.0}))
}

fn envelope(event_type: &str, data: Value) -> Value {
    let event_id = Uuid::new_v4().to_string();
    let emitted_at = Utc::now().to_rfc3339();
    serde_json::json!({
        "version": EVENT_VERSION,
        "type": event_type,
        "event_id": event_id,
        "emitted_at": emitted_at,
        "data": data,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_envelope_structure() {
        let cid = ConversationId("c1".into());
        let mid = MessageId("m1".into());
        let v = serialize_event(DomainEvent::MessageAppended { conversation_id: cid, message_id: mid }, None);
        assert_eq!(v["version"], "v1");
    assert_eq!(v["type"], MESSAGE_APPENDED);
        assert!(v["data"].is_object());
        assert!(v["event_id"].as_str().unwrap().len() > 10);
        assert!(v["emitted_at"].as_str().unwrap().contains('T'));
    }
}
