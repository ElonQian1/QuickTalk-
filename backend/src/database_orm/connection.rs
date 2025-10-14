//! 数据库连接管理
//! 
//! 封装 Sea-ORM DatabaseConnection，提供统一的访问接口

use anyhow::Result;
use sea_orm::{Database as SeaDatabase, DatabaseConnection, DbErr};
use tracing::info;

/// Sea-ORM 数据库连接包装器
#[derive(Clone)]
pub struct Database {
    connection: DatabaseConnection,
}

impl Database {
    /// 创建新的数据库连接
    /// 
    /// # Arguments
    /// * `database_url` - 数据库连接字符串，如 "sqlite:./customer_service.db"
    /// 
    /// # Returns
    /// * `Result<Self>` - 成功返回 Database 实例
    pub async fn new(database_url: &str) -> Result<Self> {
        info!("🔌 Connecting to database: {}", database_url);
        
        let connection = SeaDatabase::connect(database_url).await?;
        
        info!("✅ Database connection established");
        
        Ok(Database { connection })
    }
    
    /// 获取底层的 DatabaseConnection 引用
    /// 
    /// 用于直接执行 Sea-ORM 查询
    pub fn get_connection(&self) -> &DatabaseConnection {
        &self.connection
    }
    
    /// 克隆连接（用于多线程环境）
    pub fn clone_connection(&self) -> DatabaseConnection {
        self.connection.clone()
    }
    
    /// 检查数据库连接是否正常
    pub async fn ping(&self) -> Result<(), DbErr> {
        self.connection.ping().await
    }
}

// 为了向后兼容，提供与旧 database.rs 相同的接口
impl Database {
    /// 向后兼容：获取连接池（实际返回 DatabaseConnection）
    #[deprecated(note = "使用 get_connection() 代替")]
    pub fn pool(&self) -> &DatabaseConnection {
        &self.connection
    }
}
