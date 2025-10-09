// 统一的常量与策略，避免散落 magic string/number

pub mod ws_events {
    pub const AUTH_SUCCESS: &str = "auth_success";
    pub const NEW_MESSAGE: &str = "new_message";
    pub const TYPING: &str = "typing";
    pub const SYSTEM: &str = "system";
}

/// WebSocket 入站事件（客户端 -> 服务器）常量
pub mod ws_incoming {
    pub const AUTH: &str = "auth";
    pub const SEND_MESSAGE: &str = "send_message";
    pub const TYPING: &str = "typing";
}

pub mod upload_policy {
    pub const MAX_SIZE_BYTES: i64 = 10 * 1024 * 1024; // 10MB
    pub const ALLOWED_PREFIX: [&str; 5] = [
        "image/png",
        "image/jpeg",
        "image/gif",
        "application/pdf",
        "text/plain",
    ];
}
