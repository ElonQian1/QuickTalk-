// 强类型ID定义
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ConversationId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MessageId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CustomerId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ShopId(pub String);

impl ConversationId { pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) } }
impl MessageId { pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) } }
impl CustomerId { pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) } }
impl ShopId { pub fn new() -> Self { Self(uuid::Uuid::new_v4().to_string()) } }
