// Service 编译测试
use anyhow::Result;
use sea_orm::DatabaseConnection;

// 只测试 UserService 结构是否正确
#[derive(Clone)]
pub struct UserService {
    pub db: DatabaseConnection,
}

impl UserService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // 简单的测试方法
    pub async fn test_method(&self) -> Result<String> {
        Ok("test".to_string())
    }
}