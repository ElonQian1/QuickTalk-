use tokio::sync::broadcast;
use crate::domain::conversation::DomainEvent;
use crate::application::events::serialization::serialize_event;

// 简单内存事件总线：当前实现为直接把事件序列化为 JSON 字符串通过 broadcast channel 发送
#[derive(Clone)]
#[allow(dead_code)] // 目前主路径使用 EventBusWithDb，保留该精简实现以供纯内存/测试或未来 fallback
pub struct InMemoryEventBus {
    sender: broadcast::Sender<String>,
}

impl InMemoryEventBus {
    #[allow(dead_code)]
    pub fn new(sender: broadcast::Sender<String>) -> Self { Self { sender } }
    #[allow(dead_code)]
    pub fn publish(&self, events: Vec<DomainEvent>) {
        for ev in events {
            let payload_value = serialize_event(ev, None);
            let _ = self.sender.send(payload_value.to_string());
        }
    }
}

// 供应用层用例 trait（后续可替换为更复杂实现）
#[allow(dead_code)]
pub trait EventPublisher: Send + Sync { fn publish(&self, events: Vec<DomainEvent>); }
impl EventPublisher for InMemoryEventBus { fn publish(&self, events: Vec<DomainEvent>) { self.publish(events); } }
