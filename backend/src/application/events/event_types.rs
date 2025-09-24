//! 事件类型常量，集中管理，避免硬编码字符串分散。
//! 命名规则：DOMAIN_EVENT_<UPPER_SNAKE>

pub const MESSAGE_APPENDED: &str = "domain.event.message_appended";
pub const MESSAGE_UPDATED: &str = "domain.event.message_updated";
pub const MESSAGE_DELETED: &str = "domain.event.message_deleted";
pub const CONVERSATION_OPENED: &str = "domain.event.conversation_opened";
pub const CONVERSATION_CLOSED: &str = "domain.event.conversation_closed";
pub const CONVERSATION_REOPENED: &str = "domain.event.conversation_reopened";

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn constants_non_empty() {
        assert!(!MESSAGE_APPENDED.is_empty());
        assert!(MESSAGE_APPENDED.starts_with("domain.event."));
    }
}
