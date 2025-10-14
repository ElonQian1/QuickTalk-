//! Message Repository - 消息数据访问层

use anyhow::Result;
use sea_orm::{*, sea_query::Expr};
use crate::entities::{messages, prelude::*};

pub struct MessageRepository;

impl MessageRepository {
    /// 创建新消息
    pub async fn create(
        db: &DatabaseConnection,
        session_id: i32,
        sender_type: String,
        sender_id: Option<i32>,
        sender_name: Option<String>,
        message_type: String,
        content: String,
    ) -> Result<messages::Model> {
        let message = messages::ActiveModel {
            session_id: Set(session_id),
            sender_type: Set(sender_type),
            sender_id: Set(sender_id),
            sender_name: Set(sender_name),
            message_type: Set(message_type),
            content: Set(content),
            is_read: Set(false),
            is_deleted: Set(false),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(Some(chrono::Utc::now().naive_utc())),
            ..Default::default()
        };
        
        Ok(message.insert(db).await?)
    }
    
    /// 获取会话的所有消息
    pub async fn find_by_session(
        db: &DatabaseConnection,
        session_id: i32,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        let mut query = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_asc(messages::Column::CreatedAt);
        
        if let Some(l) = limit {
            query = query.limit(l);
        }
        
        Ok(query.all(db).await?)
    }
    
    /// 标记消息为已读
    pub async fn mark_as_read(db: &DatabaseConnection, message_ids: Vec<i32>) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        Messages::update_many()
            .filter(messages::Column::Id.is_in(message_ids))
            .col_expr(messages::Column::IsRead, Expr::value(true))
            .col_expr(messages::Column::ReadAt, Expr::value(chrono::Utc::now().naive_utc()))
            .exec(db)
            .await?;
        
        Ok(())
    }
    
    /// 获取未读消息数量
    pub async fn count_unread(db: &DatabaseConnection, session_id: i32, user_type: &str) -> Result<u64> {
        let count = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsRead.eq(false))
            .filter(messages::Column::IsDeleted.eq(false))
            .filter(messages::Column::SenderType.ne(user_type)) // 不包括自己发的消息
            .count(db)
            .await?;
        
        Ok(count)
    }
    
    /// 创建消息（完整版，对应 database.rs 中的 create_message）
    pub async fn create_full(
        db: &DatabaseConnection,
        session_id: i32,
        sender_type: &str,
        sender_id: Option<i32>,
        content: &str,
        message_type: &str,
        file_url: Option<&str>,
    ) -> Result<messages::Model> {
        // 将 file_url 存储在 metadata 中（因为实体中没有单独的 file_url 字段）
        let metadata = file_url.map(|url| {
            serde_json::json!({
                "file_url": url
            })
        });
        
        let message = messages::ActiveModel {
            session_id: Set(session_id),
            sender_type: Set(sender_type.to_string()),
            sender_id: Set(sender_id),
            content: Set(content.to_string()),
            message_type: Set(message_type.to_string()),
            metadata: Set(metadata),
            is_read: Set(false),
            is_deleted: Set(false),
            created_at: Set(chrono::Utc::now().naive_utc()),
            updated_at: Set(Some(chrono::Utc::now().naive_utc())),
            ..Default::default()
        };
        
        Ok(message.insert(db).await?)
    }
    
    /// 根据 ID 查找消息
    pub async fn find_by_id(db: &DatabaseConnection, id: i32) -> Result<Option<messages::Model>> {
        let message = Messages::find_by_id(id).one(db).await?;
        Ok(message)
    }
    
    /// 软删除消息
    pub async fn soft_delete(db: &DatabaseConnection, message_id: i32) -> Result<()> {
        let mut message: messages::ActiveModel = Messages::find_by_id(message_id)
            .one(db)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Message not found"))?
            .into();
        
        message.is_deleted = Set(true);
        message.updated_at = Set(Some(chrono::Utc::now().naive_utc()));
        message.update(db).await?;
        
        Ok(())
    }
    
    /// 批量软删除消息
    pub async fn soft_delete_many(db: &DatabaseConnection, message_ids: Vec<i32>) -> Result<()> {
        if message_ids.is_empty() {
            return Ok(());
        }
        
        Messages::update_many()
            .filter(messages::Column::Id.is_in(message_ids))
            .col_expr(messages::Column::IsDeleted, Expr::value(true))
            .col_expr(messages::Column::UpdatedAt, Expr::value(chrono::Utc::now().naive_utc()))
            .exec(db)
            .await?;
        
        Ok(())
    }
    
    /// 获取会话的最后一条消息
    pub async fn find_last_by_session(db: &DatabaseConnection, session_id: i32) -> Result<Option<messages::Model>> {
        let message = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_desc(messages::Column::CreatedAt)
            .one(db)
            .await?;
        
        Ok(message)
    }
    
    /// 获取会话的消息（分页）
    pub async fn find_by_session_paginated(
        db: &DatabaseConnection,
        session_id: i32,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<messages::Model>, u64)> {
        let paginator = Messages::find()
            .filter(messages::Column::SessionId.eq(session_id))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_desc(messages::Column::CreatedAt)
            .paginate(db, page_size);
        
        let total = paginator.num_items().await?;
        let messages = paginator.fetch_page(page).await?;
        
        Ok((messages, total))
    }
    
    /// 搜索消息
    pub async fn search(
        db: &DatabaseConnection,
        shop_id: i32,
        keyword: &str,
        limit: Option<u64>,
    ) -> Result<Vec<messages::Model>> {
        let mut query = Messages::find()
            .filter(messages::Column::Content.contains(keyword))
            .filter(messages::Column::IsDeleted.eq(false))
            .order_by_desc(messages::Column::CreatedAt);
        
        if let Some(l) = limit {
            query = query.limit(l);
        }
        
        Ok(query.all(db).await?)
    }
}
