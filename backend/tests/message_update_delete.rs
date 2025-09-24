use quicktalk_pure_rust::domain::conversation::{MessageId, Message};
use quicktalk_pure_rust::application::usecases::update_message::{UpdateMessageUseCase, UpdateMessageInput, UpdateMessageError};
use quicktalk_pure_rust::application::usecases::delete_message::{DeleteMessageUseCase, DeleteMessageInput, DeleteMessageError};

// 由于 update/delete 用例依赖 MessageRepository trait 的 SQLx 实现而非 InMemoryConversationRepo（未实现 MessageRepository），
// 这里进行纯领域层构造不足以执行（需要实际数据库）。为保持轻量，当前测试聚焦错误分支/空内容校验逻辑：
// 1. UpdateMessageUseCase 空内容 -> Empty 错误（通过一个 stub repository 来模拟）
// 2. Delete/Update NotFound 分支

use quicktalk_pure_rust::domain::conversation::{MessageRepository, RepoError};
use async_trait::async_trait;

struct StubMessageRepo;
#[async_trait]
impl MessageRepository for StubMessageRepo {
    async fn find(&self, _id: &MessageId) -> Result<Option<Message>, RepoError> { Ok(None) }
    async fn update_content(&self, _id: &MessageId, _new_content: &str) -> Result<(), RepoError> { Ok(()) }
    async fn soft_delete(&self, _id: &MessageId) -> Result<(), RepoError> { Ok(()) }
    async fn hard_delete(&self, _id: &MessageId) -> Result<(), RepoError> { Ok(()) }
}

#[tokio::test]
async fn update_message_empty_content_rejected() {
    let uc = UpdateMessageUseCase::new(StubMessageRepo);
    let res = uc.exec(UpdateMessageInput { message_id: "m1".into(), new_content: "   ".into() }).await;
    assert!(matches!(res, Err(UpdateMessageError::Empty)));
}

#[tokio::test]
async fn update_message_not_found() {
    let uc = UpdateMessageUseCase::new(StubMessageRepo);
    let res = uc.exec(UpdateMessageInput { message_id: "m2".into(), new_content: "ok".into() }).await;
    assert!(matches!(res, Err(UpdateMessageError::NotFound)));
}

#[tokio::test]
async fn delete_message_not_found() {
    let uc = DeleteMessageUseCase::new(StubMessageRepo);
    let res = uc.exec(DeleteMessageInput { message_id: "m3".into(), hard: false }).await;
    assert!(matches!(res, Err(DeleteMessageError::NotFound)));
}
